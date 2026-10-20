import { Request, Response } from 'express';
import { z } from 'zod';
import { Order, IOrderItem } from '../models/Order.js';
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
  idempotencyKey: z.string().optional(),
});

export async function createPaymentOrder(req: AuthRequest, res: Response): Promise<void> {
  const reservedItems: Array<{ listingId: string; quantity: number }> = [];

  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const data = createPaymentOrderSchema.parse(req.body);

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

    // Create Razorpay Order
    const rzpOrder = await createRazorpayOrder({
      amountPaise: finalPayablePaise,
      currency: 'INR',
      receipt: orderNumber,
      notes: {
        buyerId: req.user._id.toString(),
        buyerEmail: req.user.email,
        orderNumber,
      },
    });

    const order = await Order.create({
      orderNumber,
      buyerId: req.user._id,
      buyerName: req.user.name,
      buyerRole: req.user.role,
      buyerPhone: req.user.phone,
      items: orderItems,
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
      status: ORDER_STATUSES.PENDING_PAYMENT,
      statusHistory: [
        {
          status: ORDER_STATUSES.PENDING_PAYMENT,
          note: 'Order created, awaiting Razorpay test payment authorization',
          timestamp: new Date(),
          updatedBy: req.user._id,
          role: req.user.role,
        },
      ],
      payment: {
        status: 'pending',
        gateway: 'razorpay_standard',
        paymentOrderId: rzpOrder.id,
      },
      idempotencyKey: data.idempotencyKey,
    });

    res.status(201).json({
      success: true,
      message: 'Payment order created with stock reserved',
      orderId: order._id,
      orderNumber: order.orderNumber,
      razorpayOrderId: rzpOrder.id,
      amountPaise: finalPayablePaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    for (const reserved of reservedItems) {
      await CropListing.findByIdAndUpdate(reserved.listingId, {
        $inc: {
          availableQuantity: reserved.quantity,
          reservedQuantity: -reserved.quantity,
        },
      });
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
        ['authorized', 'captured'].includes(payment.status);

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

    order.statusHistory.push({
      status: ORDER_STATUSES.CONFIRMED,
      note: `Payment verified & captured via Razorpay Standard Checkout (${razorpayPaymentId})`,
      timestamp: new Date(),
      updatedBy: req.user._id,
      role: req.user.role,
    });

    await order.save();

    // Create transparent Payout Ledger records for each farmer
    const settings = (await SystemSettings.findOne({ key: 'global_config' })) || {
      farmerSharePct: 90,
      platformCommissionPct: 8,
      opsReservePct: 2,
    };

    const farmerTotals = new Map<string, { farmerName: string; totalPaise: number }>();
    for (const item of order.items) {
      const fId = item.farmerId.toString();
      const existing = farmerTotals.get(fId) || { farmerName: item.farmerName, totalPaise: 0 };
      existing.totalPaise += item.totalPaise;
      farmerTotals.set(fId, existing);
    }

    for (const [farmerId, info] of farmerTotals.entries()) {
      const fPayout = Math.round(info.totalPaise * (settings.farmerSharePct / 100));
      const fComm = Math.round(info.totalPaise * (settings.platformCommissionPct / 100));
      const fOps = info.totalPaise - fPayout - fComm;

      await PayoutLedger.create({
        orderId: order._id,
        orderNumber: order.orderNumber,
        farmerId,
        farmerName: info.farmerName,
        grossProductValuePaise: info.totalPaise,
        farmerSharePct: settings.farmerSharePct,
        farmerPayoutPaise: fPayout,
        platformCommissionPaise: fComm,
        operationsReservePaise: fOps,
        settlementStatus: 'accrued',
      });

      // Realtime alert to farmer
      RealtimeNotifier.emitNewOrderToFarmer(farmerId, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: info.totalPaise,
        buyerName: req.user.name,
      });
    }

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
  const razorpayOrderId = paymentPayload?.order_id || (eventType === 'order.paid' ? orderPayload?.id : undefined);

  // Deduplication
  const existingEvent = await WebhookEvent.findOne({ eventId });
  if (existingEvent) {
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
  };
  try {
    await WebhookEvent.create({ eventId, eventType, payload: safePayload, status: 'processed' });
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

        order.statusHistory.push({
          status: ORDER_STATUSES.CONFIRMED,
          note: `Webhook verified payment capture (${paymentPayload?.id})`,
          timestamp: new Date(),
          role: 'webhook',
        });

        await order.save();
        console.log(`Webhook reconciled Order ${order.orderNumber} as CAPTURED.`);
      }
    }
  } else if (eventType === 'payment.failed') {
    if (razorpayOrderId) {
      const order = await Order.findOne({ 'payment.paymentOrderId': razorpayOrderId });
      // Never overwrite an already captured payment
      if (order && order.payment.status !== 'captured') {
        order.payment.status = 'failed';
        order.status = ORDER_STATUSES.CANCELLED;
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
      }
    }
  }

  res.json({ success: true, message: 'Webhook processed' });
}
