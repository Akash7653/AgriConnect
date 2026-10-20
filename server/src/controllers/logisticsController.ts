import { Response } from 'express';
import { Order } from '../models/Order.js';
import { Notification } from '../models/Notification.js';
import { AuthRequest } from '../middleware/auth.js';
import { USER_ROLES, ORDER_STATUSES, OrderStatus } from '../config/constants.js';
import { RealtimeNotifier } from '../socket/index.js';
import { AuditLog } from '../models/AuditLog.js';
import { PayoutLedger } from '../models/PayoutLedger.js';

export async function getAvailableDeliveries(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || (req.user.role !== USER_ROLES.LOGISTICS && req.user.role !== USER_ROLES.ADMIN)) {
      res.status(403).json({ success: false, message: 'Logistics access required' });
      return;
    }

    // Orders that are ready for pickup or actively assigned to this partner
    const orders = await Order.find({
      $or: [
        { status: ORDER_STATUSES.READY_FOR_PICKUP, $or: [{ 'logistics.assignedPartnerId': { $exists: false } }, { 'logistics.assignedPartnerId': req.user._id }] },
        { 'logistics.assignedPartnerId': req.user._id, status: { $in: [ORDER_STATUSES.PICKED_UP, ORDER_STATUSES.OUT_FOR_DELIVERY] } },
      ],
    }).sort({ createdAt: -1 });

    if (req.user.role === USER_ROLES.ADMIN) {
      res.json({ success: true, orders });
      return;
    }

    const safeOrders = orders.map((order) => {
      const assignedToMe = order.logistics?.assignedPartnerId?.toString() === req.user!._id.toString();
      if (assignedToMe) return order;

      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        items: order.items.map(({ cropName, quantity, unit }) => ({ cropName, quantity, unit })),
        assigned: false,
      };
    });

    res.json({ success: true, orders: safeOrders });
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
        $or: [
          { 'logistics.assignedPartnerId': { $exists: false } },
          { 'logistics.assignedPartnerId': req.user._id },
        ],
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
            note: 'Claimed by delivery partner',
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
    const { recipientSignature, notes, otp } = req.body;

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

    order.status = ORDER_STATUSES.DELIVERED;
    order.logistics = {
      ...order.logistics,
      deliveredTime: new Date(),
      proofOfDelivery: {
        otpVerified: typeof otp === 'string' && otp.trim().length > 0,
        recipientSignature: recipientSignature.trim(),
        notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : '',
      },
    };

    order.statusHistory.push({
      status: ORDER_STATUSES.DELIVERED,
      note: 'Delivery confirmed with proof of delivery',
      timestamp: new Date(),
      updatedBy: req.user._id,
      role: req.user.role,
    });

    await order.save();

    await PayoutLedger.updateMany(
      { orderId: order._id, entryType: 'sale', settlementStatus: 'accrued' },
      { $set: { settlementStatus: 'processing', automaticPayoutEligibleAt: order.logistics.deliveredTime } }
    );

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

    res.json({ success: true, message: 'Delivery completed and confirmed', order });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}
