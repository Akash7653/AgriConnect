import { Request, Response } from 'express';
import { z } from 'zod';
import { Order, IOrder, IOrderItem, buildSellerFulfilments, recordSellerFulfilmentStatus } from '../models/Order.js';
import { CropListing } from '../models/CropListing.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { Notification } from '../models/Notification.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { AuthRequest } from '../middleware/auth.js';
import { ORDER_STATUSES, DEFAULT_PRICING_CONFIG } from '../config/constants.js';
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPaymentFromRazorpay,
} from '../services/razorpay.js';
import { RealtimeNotifier } from '../socket/index.js';
import { checkServiceability } from '../services/serviceability.js';
import { queueOrderConfirmation } from '../services/email.js';
import { Refund } from '../models/Refund.js';
import { finalizeRefund } from '../services/refunds.js';

async function ensureSalePayoutLedgers(order: IOrder | null, buyerName?: string) {
  if (!order || order.payment.gateway === 'cod_verified' || order.payment.status !== 'captured') return;

  const settings = (await SystemSettings.findOne({ key: 'global_config' })) || {
    farmerSharePct: 90,
    platformCommissionPct: 8,
    opsReservePct: 2,
  };
  const farmerTotals = new Map<string, { farmerName: string; totalPaise: number }>();
  for (const item of order.items) {
    const farmerId = item.farmerId.toString();
    const current = farmerTotals.get(farmerId) || { farmerName: item.farmerName, totalPaise: 0 };
    current.totalPaise += item.totalPaise;
    farmerTotals.set(farmerId, current);
  }

  for (const [farmerId, info] of farmerTotals) {
    const idempotencyKey = `sale:${order._id.toString()}:${farmerId}`;
    const existing = await PayoutLedger.findOne({
      orderId: order._id,
      farmerId,
      entryType: 'sale',
    });
    if (existing) continue;

    const farmerPayoutPaise = Math.round(info.totalPaise * (settings.farmerSharePct / 100));
    const platformCommissionPaise = Math.round(info.totalPaise * (settings.platformCommissionPct / 100));
    try {
      const result = await PayoutLedger.updateOne(
        { idempotencyKey },
        {
          $setOnInsert: {
            idempotencyKey,
            orderId: order._id,
            orderNumber: order.orderNumber,
            farmerId,
            farmerName: info.farmerName,
            grossProductValuePaise: info.totalPaise,
            farmerSharePct: settings.farmerSharePct,
            farmerPayoutPaise,
            platformCommissionPaise,
            operationsReservePaise: info.totalPaise - farmerPayoutPaise - platformCommissionPaise,
            settlementStatus: 'accrued',
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount > 0) {
        RealtimeNotifier.emitNewOrderToFarmer(farmerId, {
          orderId: order._id,
          orderNumber: order.orderNumber,
          amount: info.totalPaise,
          buyerName,
        });
      }
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error;
      const concurrentEntry = await PayoutLedger.findOne({ idempotencyKey });
      if (!concurrentEntry) throw error;
    }
  }
}

export const createPaymentOrderSchema = z.object({
  items: z
    .array(
      z.object({
        listingId: z.string(),
        quantity: z.number().min(1),
      })
    )
    .min(1, 'Order must contain at least one item'),
  deliveryAddress: z.object({
    recipientName: z.string().min(2),
    phone: z.string().min(10),
    addressLine1: z.string().min(3),
    addressLine2: z.string().optional(),
    city: z.string().min(2),
    district: z.string().min(2),
    state: z.string().min(2),
    pinCode: z.string().min(5),
  }),
  deliverySlot: z.object({
    date: z.string(),
    timeWindow: z.string().default('07:00 AM - 11:00 AM'),
  }),
  paymentMethod: z.enum(['razorpay', 'cod']).default('razorpay'),
  idempotencyKey: z.string().optional(),
});

export async function createPaymentOrder(req: AuthRequest, res: Response): Promise<void> {
  const reservedItems: Array<{ listingId: string; quantity: number }> = [];
  let orderCreated = false;

  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const data = createPaymentOrderSchema.parse(req.body);
    if (data.idempotencyKey) {
      const existingOrder = await Order.findOne({
        idempotencyKey: data.idempotencyKey,
        buyerId: req.user._id,
      });
      if (existingOrder) {
        res.json({
          success: true,
          message: 'Order already processed (idempotent)',
          orderId: existingOrder._id,
          orderNumber: existingOrder.orderNumber,
          paymentMethod: existingOrder.payment.gateway === 'cod_verified' ? 'cod' : 'razorpay',
          amountPaise: existingOrder.pricing.finalPayablePaise,
          currency: 'INR',
          ...(existingOrder.payment.paymentOrderId ? { razorpayOrderId: existingOrder.payment.paymentOrderId } : {}),
          ...(existingOrder.payment.gateway !== 'cod_verified' ? { keyId: process.env.RAZORPAY_KEY_ID } : {}),
        });
        return;
      }
    }

    const serviceability = await checkServiceability(data.deliveryAddress);
    if (serviceability.configured && !serviceability.serviceable) {
      res.status(422).json({ success: false, message: serviceability.message });
      return;
    }

    // Concurrency-safe atomic stock reservation
    const orderItems: IOrderItem[] = [];
    let grossProductValuePaise = 0;

    for (const item of data.items) {
      const listing = await CropListing.findOneAndUpdate(
        {
          _id: item.listingId,
          availableQuantity: { $gte: item.quantity },
          status: 'active',
        },
        {
          $inc: {
            availableQuantity: -item.quantity,
            reservedQuantity: item.quantity,
          },
        },
        { new: true }
      ).populate('farmerId', 'name');

      if (!listing) {
        // Rollback already reserved items
        for (const reserved of reservedItems) {
          await CropListing.findByIdAndUpdate(reserved.listingId, {
            $inc: {
              availableQuantity: reserved.quantity,
              reservedQuantity: -reserved.quantity,
            },
          });
        }

        res.status(409).json({
          success: false,
          message: `Insufficient stock for item ${item.listingId}. Please refresh your cart.`,
        });
        return;
      }

      reservedItems.push({ listingId: item.listingId, quantity: item.quantity });
      const itemTotalPaise = listing.pricePerUnitPaise * item.quantity;
      grossProductValuePaise += itemTotalPaise;

      orderItems.push({
        listingId: listing._id as any,
        cropName: listing.cropName,
        variety: listing.variety,
        unit: listing.unit,
        quantity: item.quantity,
        unitPricePaise: listing.pricePerUnitPaise,
        totalPaise: itemTotalPaise,
        farmerId: listing.farmerId._id as any,
        farmerName: (listing.farmerId as any).name || 'Farmer',
        farmLocation: `${listing.location.village}, ${listing.location.district}`,
        qualityGrade: listing.qualityGrade,
      });

      // Emit live inventory update
      RealtimeNotifier.emitInventoryUpdate({
        listingId: listing._id.toString(),
        availableQuantity: listing.availableQuantity,
        status: listing.availableQuantity === 0 ? 'sold_out' : 'active',
      });
    }

    // Server-side transparent pricing calculation
    const settings = (await SystemSettings.findOne({ key: 'global_config' })) || {
      farmerSharePct: DEFAULT_PRICING_CONFIG.farmerSharePct,
      platformCommissionPct: DEFAULT_PRICING_CONFIG.platformCommissionPct,
      opsReservePct: DEFAULT_PRICING_CONFIG.opsReservePct,
      defaultDeliveryFeePaise: DEFAULT_PRICING_CONFIG.defaultDeliveryFeePaise,
      freeDeliveryThresholdPaise: DEFAULT_PRICING_CONFIG.freeDeliveryThresholdPaise,
    };

    const farmerPayoutPaise = Math.round(grossProductValuePaise * (settings.farmerSharePct / 100));
    const platformCommissionPaise = Math.round(grossProductValuePaise * (settings.platformCommissionPct / 100));
    const operationsReservePaise = grossProductValuePaise - farmerPayoutPaise - platformCommissionPaise;

    const deliveryFeePaise =
      grossProductValuePaise >= settings.freeDeliveryThresholdPaise ? 0 : settings.defaultDeliveryFeePaise;

    const finalPayablePaise = grossProductValuePaise + deliveryFeePaise;

    if (finalPayablePaise < 100) {
      for (const reserved of reservedItems) {
        await CropListing.findByIdAndUpdate(reserved.listingId, {
          $inc: {
            availableQuantity: reserved.quantity,
            reservedQuantity: -reserved.quantity,
          },
        });
      }
      res.status(400).json({ success: false, message: 'Payment amount must be at least 100 paise.' });
      return;
    }

    // Generate Order Number
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `AGC-${timestamp}-${randomSuffix}`;

    const rzpOrder = data.paymentMethod === 'razorpay'
      ? await createRazorpayOrder({
        amountPaise: finalPayablePaise,
        currency: 'INR',
        receipt: orderNumber,
        notes: {
          buyerId: req.user._id.toString(),
          buyerEmail: req.user.email,
          orderNumber,
        },
      })
      : undefined;
    const initialOrderStatus = data.paymentMethod === 'cod'
      ? ORDER_STATUSES.CONFIRMED
      : ORDER_STATUSES.PENDING_PAYMENT;

    const order = await Order.create({
      orderNumber,
      buyerId: req.user._id,
      buyerName: req.user.name,
      buyerRole: req.user.role,
      buyerPhone: req.user.phone,
      items: orderItems,
      sellerFulfilments: buildSellerFulfilments(orderItems, initialOrderStatus),
      pricing: {
        grossProductValuePaise,
        farmerPayoutPaise,
        platformCommissionPaise,
        operationsReservePaise,
        deliveryFeePaise,
        finalPayablePaise,
      },
      deliveryAddress: data.deliveryAddress,
      deliverySlot: data.deliverySlot,
      status: initialOrderStatus,
      statusHistory: [
        {
          status: initialOrderStatus,
          note: data.paymentMethod === 'cod'
            ? 'Order confirmed with cash due on delivery'
            : 'Order created, awaiting Razorpay payment authorization',
          timestamp: new Date(),
          updatedBy: req.user._id,
          role: req.user.role,
        },
      ],
      payment: {
        status: 'pending',
        gateway: data.paymentMethod === 'cod' ? 'cod_verified' : 'razorpay_standard',
        ...(rzpOrder ? { paymentOrderId: rzpOrder.id, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } : {}),
      },
      idempotencyKey: data.idempotencyKey,
    });
    orderCreated = true;

    if (data.paymentMethod === 'cod') {
      const farmerTotals = new Map<string, { farmerName: string; totalPaise: number }>();
      for (const item of orderItems) {
        const farmerId = item.farmerId.toString();
        const existing = farmerTotals.get(farmerId) || { farmerName: item.farmerName, totalPaise: 0 };
        existing.totalPaise += item.totalPaise;
        farmerTotals.set(farmerId, existing);
      }
      for (const [farmerId, info] of farmerTotals) {
        await Notification.create({
          recipientId: farmerId,
          title: 'New cash-on-delivery order',
          message: `Order #${order.orderNumber} includes your produce. Payment is due in cash on delivery.`,
          type: 'order',
          link: `/farmer/orders/${order._id}`,
        });
        RealtimeNotifier.emitNewOrderToFarmer(farmerId, {
          orderId: order._id,
          orderNumber: order.orderNumber,
          amount: info.totalPaise,
          buyerName: req.user.name,
        });
      }
      await Notification.create({
        recipientId: req.user._id,
        title: 'Order placed successfully',
        message: `Order #${order.orderNumber} is confirmed. Pay ₹${(finalPayablePaise / 100).toFixed(2)} in cash when it is delivered.`,
        type: 'order',
        link: `/buyer/orders/${order._id}`,
      });
      void queueOrderConfirmation(order._id.toString()).catch(() => console.warn('Order confirmation email could not be queued.'));
      RealtimeNotifier.emitAdminMetricsRefresh({ type: 'cod_order_created' });
    }

    res.status(201).json({
      success: true,
      message: data.paymentMethod === 'cod'
        ? 'Order placed. Cash payment is due on delivery.'
        : 'Payment order created with stock reserved',
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentMethod: data.paymentMethod,
      ...(rzpOrder ? { razorpayOrderId: rzpOrder.id } : {}),
      amountPaise: finalPayablePaise,
      currency: 'INR',
      ...(rzpOrder ? { keyId: process.env.RAZORPAY_KEY_ID } : {}),
    });
  } catch (err: any) {
    if (!orderCreated) {
      for (const reserved of reservedItems) {
        await CropListing.findByIdAndUpdate(reserved.listingId, {
          $inc: {
            availableQuantity: reserved.quantity,
            reservedQuantity: -reserved.quantity,
          },
        });
      }
    }

    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode === 401 ? 401 : statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      message: err.message || 'Could not create Razorpay order.',
    });
  }
}

export async function verifyPayment(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      res.status(400).json({ success: false, message: 'Missing payment verification parameters' });
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    if (order.buyerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'You are not authorized to verify this order.' });
      return;
    }

    // Idempotent check: already paid
    if (order.payment.status === 'captured') {
      await ensureSalePayoutLedgers(order, req.user.name);
      res.json({
        success: true,
        message: 'Payment already verified (idempotent)',
        order,
      });
      return;
    }

    // Confirm Razorpay order id matches stored order
    if (order.payment.paymentOrderId && order.payment.paymentOrderId !== razorpayOrderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID mismatch with stored transaction reference',
      });
      return;
    }

    // Cryptographic HMAC SHA256 Signature Verification
    const isValid = verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      console.warn(`Payment signature verification failed for Order ${order.orderNumber}`);
      order.payment.status = 'failed';
      order.status = ORDER_STATUSES.CANCELLED;
      recordSellerFulfilmentStatus(order, ORDER_STATUSES.CANCELLED, 'Payment verification failed.');
      order.statusHistory.push({
        status: ORDER_STATUSES.CANCELLED,
        note: 'Payment signature verification failed. Stock released.',
        timestamp: new Date(),
        updatedBy: req.user._id,
        role: req.user.role,
      });

      // Release reserved stock back to available inventory
      for (const item of order.items) {
        await CropListing.findByIdAndUpdate(item.listingId, {
          $inc: {
            availableQuantity: item.quantity,
            reservedQuantity: -item.quantity,
          },
        });
      }

      await order.save();
      res.status(400).json({ success: false, message: 'Invalid payment signature' });
      return;
    }

    if (process.env.NODE_ENV !== 'test') {
      const payment = await fetchPaymentFromRazorpay(razorpayPaymentId);
      const paymentMatchesOrder =
        payment &&
        payment.order_id === razorpayOrderId &&
        Number(payment.amount) === order.pricing.finalPayablePaise &&
        payment.currency === 'INR' &&
        payment.status === 'captured';

      if (!paymentMatchesOrder) {
        res.status(400).json({ success: false, message: 'Payment details do not match the stored order.' });
        return;
      }
    }

    // Verified successfully
    order.payment.status = 'captured';
    order.payment.transactionId = razorpayPaymentId;
    order.payment.paidAt = new Date();
    order.status = ORDER_STATUSES.CONFIRMED;
    order.sellerFulfilments = buildSellerFulfilments(order.items, ORDER_STATUSES.CONFIRMED);

    order.statusHistory.push({
      status: ORDER_STATUSES.CONFIRMED,
      note: `Payment verified & captured via Razorpay Standard Checkout (${razorpayPaymentId})`,
      timestamp: new Date(),
      updatedBy: req.user._id,
      role: req.user.role,
    });

    await order.save();
    void queueOrderConfirmation(order._id.toString()).catch(() => console.warn('Order confirmation email could not be queued.'));
    RealtimeNotifier.emitAdminMetricsRefresh({ type: 'payment_verified' });
    await ensureSalePayoutLedgers(order, req.user.name);

    // Notify buyer
    RealtimeNotifier.emitOrderStatusUpdate(order.buyerId.toString(), order._id.toString(), {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: 'Payment verified and order confirmed successfully',
      order,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Fail closed if webhook secret is not configured
  if (!webhookSecret || /^(replace_|your_|change_me|<)/i.test(webhookSecret) || webhookSecret.trim() === '') {
    res.status(503).json({
      success: false,
      message: 'Razorpay webhook verification is not configured on this server.',
    });
    return;
  }

  const signature = req.headers['x-razorpay-signature'] as string;
  if (!signature) {
    res.status(400).json({ success: false, message: 'Missing x-razorpay-signature header' });
    return;
  }

  const rawBody = (req as any).rawBody || req.body;
  const rawBodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody));

  const isSignatureValid = verifyWebhookSignature(rawBodyBuffer, signature, webhookSecret);
  if (!isSignatureValid) {
    res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    return;
  }

  let event: any;
  try {
    event = typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(rawBodyBuffer.toString('utf-8'));
  } catch {
    res.status(400).json({ success: false, message: 'Invalid JSON payload' });
    return;
  }

  const eventId = req.headers['x-razorpay-event-id'] as string || event?.id;
  if (!eventId || typeof eventId !== 'string' || eventId.length > 200) {
    res.status(400).json({ success: false, message: 'Missing or invalid Razorpay event ID.' });
    return;
  }
  const eventType = typeof event.event === 'string' ? event.event : 'unknown';
  const paymentPayload = event.payload?.payment?.entity;
  const orderPayload = event.payload?.order?.entity;
  const refundPayload = event.payload?.refund?.entity;
  const transferPayload = event.payload?.transfer?.entity;
  const razorpayOrderId = paymentPayload?.order_id || (eventType === 'order.paid' ? orderPayload?.id : undefined);

  // Deduplication
  const existingEvent = await WebhookEvent.findOne({ eventId });
  if (existingEvent?.status === 'processed') {
    res.json({ success: true, message: 'Event already processed (duplicate)' });
    return;
  }

  const safePayload = {
    payment: paymentPayload ? {
      id: paymentPayload.id,
      order_id: paymentPayload.order_id,
      amount: paymentPayload.amount,
      currency: paymentPayload.currency,
      status: paymentPayload.status,
      error_code: paymentPayload.error_code,
    } : undefined,
    order: orderPayload ? {
      id: orderPayload.id,
      amount: orderPayload.amount,
      currency: orderPayload.currency,
      status: orderPayload.status,
    } : undefined,
    refund: refundPayload ? {
      id: refundPayload.id,
      payment_id: refundPayload.payment_id,
      amount: refundPayload.amount,
      currency: refundPayload.currency,
      status: refundPayload.status,
    } : undefined,
    transfer: transferPayload ? {
      id: transferPayload.id,
      status: transferPayload.status,
      notes: transferPayload.notes,
    } : undefined,
  };
  try {
    if (existingEvent) {
      await WebhookEvent.updateOne({ eventId }, { $set: { eventType, payload: safePayload, status: 'failed' } });
    } else {
      await WebhookEvent.create({ eventId, eventType, payload: safePayload, status: 'failed' });
    }
  } catch (error: any) {
    if (error?.code === 11000) {
      res.json({ success: true, message: 'Event already processed (duplicate)' });
      return;
    }
    throw error;
  }

  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    if (razorpayOrderId) {
      const order = await Order.findOne({ 'payment.paymentOrderId': razorpayOrderId });
      const paidAmount = Number(paymentPayload?.amount ?? orderPayload?.amount);
      const paidCurrency = paymentPayload?.currency ?? orderPayload?.currency;
      if (!order || paidAmount !== order.pricing.finalPayablePaise || paidCurrency !== 'INR') {
        await WebhookEvent.updateOne({ eventId }, { $set: { status: 'failed' } });
        res.status(400).json({ success: false, message: 'Webhook payment does not match a stored order.' });
        return;
      }
      if (order && order.payment.status !== 'captured') {
        order.payment.status = 'captured';
        order.payment.transactionId = paymentPayload?.id || order.payment.transactionId;
        order.payment.paidAt = new Date();
        order.status = ORDER_STATUSES.CONFIRMED;
        order.sellerFulfilments = buildSellerFulfilments(order.items, ORDER_STATUSES.CONFIRMED);

        order.statusHistory.push({
          status: ORDER_STATUSES.CONFIRMED,
          note: `Webhook verified payment capture (${paymentPayload?.id})`,
          timestamp: new Date(),
          role: 'webhook',
        });

        await order.save();
        void queueOrderConfirmation(order._id.toString()).catch(() => console.warn('Order confirmation email could not be queued.'));
        RealtimeNotifier.emitAdminMetricsRefresh({ type: 'webhook_payment_captured' });
      }
      await ensureSalePayoutLedgers(order);
    }
  } else if (eventType === 'payment.failed') {
    if (razorpayOrderId) {
      const order = await Order.findOne({ 'payment.paymentOrderId': razorpayOrderId });
      // Never overwrite an already captured payment
      if (order && order.payment.status !== 'captured') {
        order.payment.status = 'failed';
        order.status = ORDER_STATUSES.CANCELLED;
        recordSellerFulfilmentStatus(
          order,
          ORDER_STATUSES.CANCELLED,
          `Payment failed: ${paymentPayload?.error_description || 'Transaction failed'}`,
        );
        order.statusHistory.push({
          status: ORDER_STATUSES.CANCELLED,
          note: `Webhook reported payment failure: ${paymentPayload?.error_description || 'Transaction failed'}`,
          timestamp: new Date(),
          role: 'webhook',
        });

        // Release reserved stock safely
        for (const item of order.items) {
          await CropListing.findByIdAndUpdate(item.listingId, {
            $inc: {
              availableQuantity: item.quantity,
              reservedQuantity: -item.quantity,
            },
          });
        }

        await order.save();
        RealtimeNotifier.emitAdminMetricsRefresh({ type: 'webhook_payment_failed' });
      }
    }
  } else if (['refund.created', 'refund.processed', 'refund.failed'].includes(eventType)) {
    const providerRefundId = typeof refundPayload?.id === 'string' ? refundPayload.id : undefined;
    const paymentId = typeof refundPayload?.payment_id === 'string' ? refundPayload.payment_id : undefined;
    const refund = await Refund.findOne({
      $or: [
        ...(providerRefundId ? [{ providerRefundId }] : []),
        ...(paymentId ? [{ paymentId, status: 'pending' }] : []),
      ],
    }).sort({ createdAt: 1 });

    if (!refund) {
      await WebhookEvent.updateOne({ eventId }, { $set: { status: 'ignored' } });
      res.json({ success: true, message: 'Refund event does not match an outstanding AgriConnect refund.' });
      return;
    }
    if (refund.status === 'processed') {
      await WebhookEvent.updateOne({ eventId }, { $set: { status: 'ignored' } });
      res.json({ success: true, message: 'Refund was already reconciled.' });
      return;
    }

    if (eventType === 'refund.failed') {
      refund.providerRefundId = providerRefundId || refund.providerRefundId;
      refund.providerStatus = typeof refundPayload?.status === 'string' ? refundPayload.status : 'failed';
      refund.status = 'failed';
      await refund.save();
    } else if (eventType === 'refund.created') {
      refund.providerRefundId = providerRefundId || refund.providerRefundId;
      refund.providerStatus = typeof refundPayload?.status === 'string' ? refundPayload.status : 'created';
      await refund.save();
    } else {
      if (!providerRefundId) {
        await WebhookEvent.updateOne({ eventId }, { $set: { status: 'failed' } });
        res.status(400).json({ success: false, message: 'Refund webhook is missing its provider refund ID.' });
        return;
      }
      try {
        await finalizeRefund({
          refundId: refund._id.toString(),
          providerRefundId,
          amountPaise: Number(refundPayload?.amount),
          currency: typeof refundPayload?.currency === 'string' ? refundPayload.currency : '',
        });
      } catch (error) {
        await WebhookEvent.updateOne({ eventId }, { $set: { status: 'failed' } });
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : 'Refund reconciliation failed.',
        });
        return;
      }
    }
  } else if (['transfer.processed', 'transfer.failed', 'transfer.reversed'].includes(eventType)) {
    const transferId = typeof transferPayload?.id === 'string' ? transferPayload.id : undefined;
    const ledgerId = typeof transferPayload?.notes?.payout_ledger_id === 'string'
      ? transferPayload.notes.payout_ledger_id
      : undefined;
    const payout = await PayoutLedger.findOne({
      settlementStatus: { $in: ['processing', 'settled'] },
      $or: [
        ...(transferId ? [{ razorpayTransferId: transferId }] : []),
        ...(ledgerId ? [{ _id: ledgerId }] : []),
      ],
    });

    if (!payout) {
      await WebhookEvent.updateOne({ eventId }, { $set: { status: 'ignored' } });
      res.json({ success: true, message: 'Transfer event does not match an eligible payout ledger.' });
      return;
    }

    if (eventType === 'transfer.processed') {
      const settled = await PayoutLedger.findOneAndUpdate(
        { _id: payout._id, settlementStatus: 'processing' },
        {
          $set: {
            settlementStatus: 'settled',
            razorpayTransferId: transferId || payout.razorpayTransferId,
            transactionReference: transferId || payout.transactionReference,
            settledAt: new Date(),
          },
          $unset: { automaticPayoutLeaseUntil: 1 },
        },
        { new: true }
      );
      if (settled) {
        await Notification.create({
          recipientId: settled.farmerId,
          title: 'Farmer Payout Settled',
          message: `Your payout of ₹${(settled.farmerPayoutPaise / 100).toFixed(2)} for Order #${settled.orderNumber} has been settled.`,
          type: 'payout',
          link: '/farmer/payouts',
        });
      }
    } else {
      await PayoutLedger.updateOne(
        { _id: payout._id, settlementStatus: 'processing' },
        {
          $set: {
            settlementStatus: 'on_hold',
            razorpayTransferId: transferId || payout.razorpayTransferId,
            notes: `Razorpay Route transfer ${eventType.slice('transfer.'.length)}; review in the Razorpay dashboard.`,
          },
          $unset: { automaticPayoutLeaseUntil: 1 },
        }
      );
    }
  }

  await WebhookEvent.updateOne({ eventId }, { $set: { status: 'processed' } });
  res.json({ success: true, message: 'Webhook processed' });
}
