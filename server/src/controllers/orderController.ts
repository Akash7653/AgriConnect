import { Response } from 'express';
import { z } from 'zod';
import { Order, IOrderItem } from '../models/Order.js';
import { CropListing } from '../models/CropListing.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { Notification } from '../models/Notification.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { AuthRequest } from '../middleware/auth.js';
import { ORDER_STATUSES, USER_ROLES, DEFAULT_PRICING_CONFIG, OrderStatus } from '../config/constants.js';
import { RealtimeNotifier } from '../socket/index.js';

export const createOrderSchema = z.object({
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
  paymentMethod: z.enum(['razorpay_sandbox', 'upi_instant', 'cod_verified']).default('razorpay_sandbox'),
  idempotencyKey: z.string().optional(),
});

export async function createOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const data = createOrderSchema.parse(req.body);

    // Check idempotency if key provided
    if (data.idempotencyKey) {
      const existing = await Order.findOne({ idempotencyKey: data.idempotencyKey });
      if (existing) {
        res.json({
          success: true,
          message: 'Order already processed (idempotent)',
          order: existing,
        });
        return;
      }
    }

    // Step 1: Concurrency-safe atomic stock reservation
    const reservedItems: Array<{ listingId: string; quantity: number }> = [];
    const orderItems: IOrderItem[] = [];
    let grossProductValuePaise = 0;

    for (const item of data.items) {
      // Atomic reservation: only succeeds if availableQuantity >= quantity
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
        // Rollback any previously reserved items
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
          message: `Insufficient stock or unavailable item for ID ${item.listingId}. Please refresh your cart.`,
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

      // Emit live inventory update to marketplace
      RealtimeNotifier.emitInventoryUpdate({
        listingId: listing._id.toString(),
        availableQuantity: listing.availableQuantity,
        status: listing.availableQuantity === 0 ? 'sold_out' : 'active',
      });
    }

    // Step 2: Calculate transparent pricing snapshot
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

    // Step 3: Generate order number
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `AGC-${timestamp}-${randomSuffix}`;

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
      status: ORDER_STATUSES.CONFIRMED,
      statusHistory: [
        {
          status: ORDER_STATUSES.CONFIRMED,
          note: 'Order confirmed and payment authorized',
          timestamp: new Date(),
          updatedBy: req.user._id,
          role: req.user.role,
        },
      ],
      payment: {
        status: 'captured',
        gateway: data.paymentMethod,
        transactionId: `TXN-SBX-${Date.now()}`,
        paidAt: new Date(),
      },
      idempotencyKey: data.idempotencyKey,
    });

    // Step 4: Create transparent Payout Ledger entries for each farmer in the order
    const farmerTotals = new Map<string, { farmerName: string; totalPaise: number }>();
    for (const item of orderItems) {
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

      // Create farmer notification
      await Notification.create({
        recipientId: farmerId,
        title: 'New Order Received',
        message: `Order #${order.orderNumber} for ${info.farmerName} crops totaling ₹${(info.totalPaise / 100).toFixed(2)}. Target payout: ₹${(fPayout / 100).toFixed(2)}.`,
        type: 'order',
        link: `/farmer/orders/${order._id}`,
      });

      // Real-time farmer notification
      RealtimeNotifier.emitNewOrderToFarmer(farmerId, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: info.totalPaise,
        buyerName: req.user.name,
      });
    }

    // Step 5: Notify buyer
    await Notification.create({
      recipientId: req.user._id,
      title: 'Order Placed Successfully',
      message: `Your order #${order.orderNumber} for ₹${(finalPayablePaise / 100).toFixed(2)} is confirmed and being prepared.`,
      type: 'order',
      link: `/buyer/orders/${order._id}`,
    });

    res.status(201).json({
      success: true,
      message: 'Order placed and stock reserved successfully',
      order,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function getBuyerOrders(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const orders = await Order.find({ buyerId: req.user._id }).sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getFarmerOrders(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const orders = await Order.find({ 'items.farmerId': req.user._id }).sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getOrderById(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    // Server-enforced authorization check:
    // Only the buyer, a farmer involved in the order, assigned logistics partner, or admin can view
    const isBuyer = order.buyerId.toString() === req.user._id.toString();
    const isFarmerInOrder = order.items.some((i) => i.farmerId.toString() === req.user!._id.toString());
    const isLogisticsAssigned = order.logistics?.assignedPartnerId?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === USER_ROLES.ADMIN;

    if (!isBuyer && !isFarmerInOrder && !isLogisticsAssigned && !isAdmin) {
      res.status(403).json({ success: false, message: 'Access denied to this order' });
      return;
    }

    res.json({ success: true, order });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateOrderStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { status, note, proofOfDelivery } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    const isBuyer = order.buyerId.toString() === req.user._id.toString();
    const isFarmerInOrder = order.items.some((item) => item.farmerId.toString() === req.user!._id.toString());
    const isLogisticsAssigned = order.logistics?.assignedPartnerId?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === USER_ROLES.ADMIN;

    if (!isAdmin && !isBuyer && !isFarmerInOrder && !isLogisticsAssigned) {
      res.status(403).json({ success: false, message: 'Access denied to update this order' });
      return;
    }

    if (isBuyer && status !== ORDER_STATUSES.CANCELLED) {
      res.status(403).json({ success: false, message: 'Buyers may only cancel their own orders' });
      return;
    }
    if (status === ORDER_STATUSES.CANCELLED && order.payment.status === 'captured') {
      res.status(409).json({ success: false, message: 'Paid orders require an approved refund workflow before cancellation.' });
      return;
    }

    // Validate state machine transitions
    const validTransitions: Record<string, string[]> = {
      [ORDER_STATUSES.PENDING_PAYMENT]: [ORDER_STATUSES.CONFIRMED, ORDER_STATUSES.CANCELLED],
      [ORDER_STATUSES.CONFIRMED]: [ORDER_STATUSES.ACCEPTED, ORDER_STATUSES.CANCELLED],
      [ORDER_STATUSES.ACCEPTED]: [ORDER_STATUSES.PREPARING, ORDER_STATUSES.CANCELLED],
      [ORDER_STATUSES.PREPARING]: [ORDER_STATUSES.READY_FOR_PICKUP, ORDER_STATUSES.CANCELLED],
      [ORDER_STATUSES.READY_FOR_PICKUP]: [ORDER_STATUSES.PICKED_UP, ORDER_STATUSES.CANCELLED],
      [ORDER_STATUSES.PICKED_UP]: [ORDER_STATUSES.OUT_FOR_DELIVERY],
      [ORDER_STATUSES.OUT_FOR_DELIVERY]: [ORDER_STATUSES.DELIVERED],
      [ORDER_STATUSES.DELIVERED]: [],
      [ORDER_STATUSES.CANCELLED]: [],
    };

    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from ${order.status} to ${status}`,
      });
      return;
    }

    const farmerStatuses = [ORDER_STATUSES.ACCEPTED, ORDER_STATUSES.PREPARING, ORDER_STATUSES.READY_FOR_PICKUP];
    const logisticsStatuses = [ORDER_STATUSES.PICKED_UP, ORDER_STATUSES.OUT_FOR_DELIVERY, ORDER_STATUSES.DELIVERED];
    if (isFarmerInOrder && !isAdmin && !farmerStatuses.includes(status as any)) {
      res.status(403).json({ success: false, message: 'Farmers can only advance preparation states.' });
      return;
    }
    if (isLogisticsAssigned && !isAdmin && !logisticsStatuses.includes(status as any)) {
      res.status(403).json({ success: false, message: 'Delivery partners can only advance delivery states.' });
      return;
    }

    // If order is cancelled, release reserved stock back to available stock
    if (status === ORDER_STATUSES.CANCELLED && order.status !== ORDER_STATUSES.CANCELLED) {
      for (const item of order.items) {
        await CropListing.findByIdAndUpdate(item.listingId, {
          $inc: {
            availableQuantity: item.quantity,
            reservedQuantity: -item.quantity,
          },
        });

        // Broadcast restored inventory
        const updated = await CropListing.findById(item.listingId);
        if (updated) {
          RealtimeNotifier.emitInventoryUpdate({
            listingId: updated._id.toString(),
            availableQuantity: updated.availableQuantity,
            status: updated.status,
          });
        }
      }

      // Mark payout ledgers as cancelled
      await PayoutLedger.updateMany({ orderId: order._id }, { settlementStatus: 'cancelled' });
    }

    // If order delivered, mark payout ledgers as eligible for settlement
    if (status === ORDER_STATUSES.DELIVERED) {
      await PayoutLedger.updateMany(
        { orderId: order._id, settlementStatus: 'accrued' },
        { settlementStatus: 'processing' }
      );
    }

    order.status = status as OrderStatus;
    order.statusHistory.push({
      status: status as OrderStatus,
      note: note || `Status updated to ${status}`,
      timestamp: new Date(),
      updatedBy: req.user._id,
      role: req.user.role,
    });

    if (proofOfDelivery && order.logistics) {
      order.logistics.proofOfDelivery = proofOfDelivery;
      order.logistics.deliveredTime = new Date();
    }

    await order.save();

    // Notify buyer and emit real-time event
    await Notification.create({
      recipientId: order.buyerId,
      title: `Order Status: ${status.replace('_', ' ').toUpperCase()}`,
      message: `Your order #${order.orderNumber} status changed to ${status.replace('_', ' ')}. ${note || ''}`,
      type: 'order',
      link: `/buyer/orders/${order._id}`,
    });

    RealtimeNotifier.emitOrderStatusUpdate(order.buyerId.toString(), order._id.toString(), {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      note,
      timestamp: new Date(),
    });

    res.json({ success: true, message: 'Order status updated', order });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}
