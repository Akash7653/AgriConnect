import { Response } from 'express';
import { Order } from '../models/Order.js';
import { Notification } from '../models/Notification.js';
import { AuthRequest } from '../middleware/auth.js';
import { USER_ROLES, ORDER_STATUSES, OrderStatus, DEFAULT_PRICING_CONFIG } from '../config/constants.js';
import { RealtimeNotifier } from '../socket/index.js';
import { AuditLog } from '../models/AuditLog.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { queueOrderUpdate } from '../services/email.js';

export async function getAvailableDeliveries(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || (req.user.role !== USER_ROLES.LOGISTICS && req.user.role !== USER_ROLES.ADMIN)) {
      res.status(403).json({ success: false, message: 'Logistics access required' });
      return;
    }

    const orders = req.user.role === USER_ROLES.ADMIN
      ? await Order.find({
        status: { $in: [ORDER_STATUSES.READY_FOR_PICKUP, ORDER_STATUSES.PICKED_UP, ORDER_STATUSES.OUT_FOR_DELIVERY] },
      }).sort({ createdAt: -1 })
      : await Order.find({
        'logistics.assignedPartnerId': req.user._id,
        status: { $in: [ORDER_STATUSES.READY_FOR_PICKUP, ORDER_STATUSES.PICKED_UP, ORDER_STATUSES.OUT_FOR_DELIVERY] },
      }).sort({ createdAt: -1 });

    if (req.user.role === USER_ROLES.ADMIN) {
      res.json({ success: true, orders });
      return;
    }

    res.json({ success: true, orders });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function claimDelivery(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== USER_ROLES.LOGISTICS) {
      res.status(403).json({ success: false, message: 'Only logistics partners can claim deliveries' });
      return;
    }

    const { orderId } = req.params;
    const now = new Date();
    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        status: ORDER_STATUSES.READY_FOR_PICKUP,
        'logistics.assignedPartnerId': req.user._id,
      },
      {
        $set: {
          'logistics.assignedPartnerId': req.user._id,
          'logistics.partnerName': req.user.name,
          'logistics.partnerPhone': req.user.phone,
          'logistics.pickupTime': now,
          status: ORDER_STATUSES.PICKED_UP,
        },
        $push: {
          statusHistory: {
            status: ORDER_STATUSES.PICKED_UP,
            note: 'Assigned delivery partner picked up the order',
            timestamp: now,
            updatedBy: req.user._id,
            role: req.user.role,
          },
        },
      },
      { new: true }
    );

    if (!order) {
      res.status(409).json({ success: false, message: 'Order is unavailable or already assigned.' });
      return;
    }

    await AuditLog.create({
      action: 'DELIVERY_CLAIMED',
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      targetResource: 'Order',
      resourceId: order._id.toString(),
      ipAddress: req.ip,
    });

    await Notification.create({
      recipientId: order.buyerId,
      title: 'Order picked up',
      message: `Your order #${order.orderNumber} has been picked up by ${req.user.name}.`,
      type: 'logistics',
      link: `/buyer/orders/${order._id}`,
    });
    await queueOrderUpdate(
      order._id.toString(),
      `status:${ORDER_STATUSES.PICKED_UP}`,
      `Order ${order.orderNumber} has been picked up by ${req.user.name}.`
    );
    for (const farmerId of new Set(order.items.map((item) => item.farmerId.toString()))) {
      await Notification.create({
        recipientId: farmerId,
        title: 'Order picked up',
        message: `Order #${order.orderNumber} has been picked up by the delivery partner.`,
        type: 'logistics',
        link: `/farmer/orders/${order._id}`,
      });
      RealtimeNotifier.emitOrderStatusUpdate(farmerId, order._id.toString(), {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        partnerName: req.user.name,
      });
    }

    // Realtime alerts
    RealtimeNotifier.emitOrderStatusUpdate(order.buyerId.toString(), order._id.toString(), {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      partnerName: req.user.name,
      partnerPhone: req.user.phone,
    });

    res.json({ success: true, message: 'Delivery claimed successfully', order });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function completeDelivery(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || (req.user.role !== USER_ROLES.LOGISTICS && req.user.role !== USER_ROLES.ADMIN)) {
      res.status(403).json({ success: false, message: 'Logistics access required' });
      return;
    }

    const { orderId } = req.params;
    const { recipientSignature, notes, otp, cashCollected } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    const assignedToCaller = order.logistics?.assignedPartnerId?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === USER_ROLES.ADMIN;
    if (!assignedToCaller && !isAdmin) {
      res.status(403).json({ success: false, message: 'Only the assigned delivery partner or admin can complete this delivery.' });
      return;
    }
    if (![ORDER_STATUSES.PICKED_UP, ORDER_STATUSES.OUT_FOR_DELIVERY].includes(order.status as any)) {
      res.status(409).json({ success: false, message: 'Order is not in a deliverable state.' });
      return;
    }
    if (typeof recipientSignature !== 'string' || recipientSignature.trim().length < 2) {
      res.status(400).json({ success: false, message: 'Recipient confirmation is required.' });
      return;
    }
    const isCashOnDelivery = order.payment.gateway === 'cod_verified';
    if (isCashOnDelivery && order.payment.status !== 'captured' && cashCollected !== true) {
      res.status(400).json({ success: false, message: 'Confirm cash collection before completing this COD delivery.' });
      return;
    }

    const deliveredAt = new Date();
    order.status = ORDER_STATUSES.DELIVERED;
    order.logistics = {
      ...order.logistics,
      deliveredTime: deliveredAt,
      proofOfDelivery: {
        otpVerified: typeof otp === 'string' && otp.trim().length > 0,
        recipientSignature: recipientSignature.trim(),
        notes: [
          typeof notes === 'string' ? notes.trim().slice(0, 500) : '',
          isCashOnDelivery ? 'Cash collected on delivery' : '',
        ].filter(Boolean).join(' · '),
      },
    };
    if (isCashOnDelivery && order.payment.status !== 'captured') {
      order.payment.status = 'captured';
      order.payment.paidAt = deliveredAt;
      order.payment.cashCollectedAt = deliveredAt;
    }

    order.statusHistory.push({
      status: ORDER_STATUSES.DELIVERED,
      note: isCashOnDelivery ? 'Delivery confirmed and cash collected' : 'Delivery confirmed with proof of delivery',
      timestamp: new Date(),
      updatedBy: req.user._id,
      role: req.user.role,
    });

    await order.save();

    if (isCashOnDelivery) {
      const settings = (await SystemSettings.findOne({ key: 'global_config' })) || DEFAULT_PRICING_CONFIG;
      const farmerTotals = new Map<string, { farmerName: string; grossPaise: number }>();
      for (const item of order.items) {
        const farmerId = item.farmerId.toString();
        const current = farmerTotals.get(farmerId) || { farmerName: item.farmerName, grossPaise: 0 };
        current.grossPaise += item.totalPaise;
        farmerTotals.set(farmerId, current);
      }
      for (const [farmerId, total] of farmerTotals) {
        const farmerPayoutPaise = Math.round(total.grossPaise * (settings.farmerSharePct / 100));
        const platformCommissionPaise = Math.round(total.grossPaise * (settings.platformCommissionPct / 100));
        await PayoutLedger.create({
          orderId: order._id,
          orderNumber: order.orderNumber,
          farmerId,
          farmerName: total.farmerName,
          grossProductValuePaise: total.grossPaise,
          farmerSharePct: settings.farmerSharePct,
          farmerPayoutPaise,
          platformCommissionPaise,
          operationsReservePaise: total.grossPaise - farmerPayoutPaise - platformCommissionPaise,
          settlementStatus: 'on_hold',
          notes: 'Cash on delivery collected; settle this payout manually. Online Razorpay Route transfer is not applicable.',
        });
      }
    } else {
      await PayoutLedger.updateMany(
        { orderId: order._id, entryType: 'sale', settlementStatus: 'accrued' },
        { $set: { settlementStatus: 'processing', automaticPayoutEligibleAt: order.logistics.deliveredTime } }
      );
    }

    await AuditLog.create({
      action: 'DELIVERY_COMPLETED',
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      targetResource: 'Order',
      resourceId: order._id.toString(),
      ipAddress: req.ip,
    });

    // Real-time alert
    RealtimeNotifier.emitOrderStatusUpdate(order.buyerId.toString(), order._id.toString(), {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: ORDER_STATUSES.DELIVERED,
      deliveredTime: new Date(),
    });

    // Notify buyer
    await Notification.create({
      recipientId: order.buyerId,
      title: 'Order Delivered!',
      message: `Your produce order #${order.orderNumber} has been delivered. Thank you for supporting direct farm-to-table commerce!`,
      type: 'logistics',
      link: `/buyer/orders/${order._id}`,
    });
    await queueOrderUpdate(
      order._id.toString(),
      `status:${ORDER_STATUSES.DELIVERED}`,
      `Order ${order.orderNumber} has been delivered.`
    );
    for (const farmerId of new Set(order.items.map((item) => item.farmerId.toString()))) {
      await Notification.create({
        recipientId: farmerId,
        title: 'Order delivered',
        message: `Order #${order.orderNumber} was delivered to the buyer.`,
        type: 'logistics',
        link: `/farmer/orders/${order._id}`,
      });
      RealtimeNotifier.emitOrderStatusUpdate(farmerId, order._id.toString(), {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: ORDER_STATUSES.DELIVERED,
        deliveredTime: order.logistics.deliveredTime,
      });
    }

    res.json({ success: true, message: 'Delivery completed and confirmed', order });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}
