import { Response } from 'express';
import { Order } from '../models/Order.js';
import { Notification } from '../models/Notification.js';
import { AuthRequest } from '../middleware/auth.js';
import { USER_ROLES, ORDER_STATUSES, OrderStatus } from '../config/constants.js';
import { RealtimeNotifier } from '../socket/index.js';

export async function getAvailableDeliveries(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || (req.user.role !== USER_ROLES.LOGISTICS && req.user.role !== USER_ROLES.ADMIN)) {
      res.status(403).json({ success: false, message: 'Logistics access required' });
      return;
    }

    // Orders that are ready for pickup or actively assigned to this partner
    const orders = await Order.find({
      $or: [
        { status: ORDER_STATUSES.READY_FOR_PICKUP, 'logistics.assignedPartnerId': { $exists: false } },
        { 'logistics.assignedPartnerId': req.user._id, status: { $ne: ORDER_STATUSES.DELIVERED } },
      ],
    }).sort({ createdAt: -1 });

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
    const order = await Order.findById(orderId);

    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    if (order.logistics?.assignedPartnerId) {
      res.status(400).json({ success: false, message: 'Order is already claimed by another delivery partner' });
      return;
    }

    order.logistics = {
      ...order.logistics,
      assignedPartnerId: req.user._id,
      partnerName: req.user.name,
      partnerPhone: req.user.phone,
      pickupTime: new Date(),
    };

    order.status = ORDER_STATUSES.PICKED_UP;
    order.statusHistory.push({
      status: ORDER_STATUSES.PICKED_UP,
      note: `Claimed and picked up by delivery partner ${req.user.name}`,
      timestamp: new Date(),
      updatedBy: req.user._id,
      role: req.user.role,
    });

    await order.save();

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

    order.status = ORDER_STATUSES.DELIVERED;
    order.logistics = {
      ...order.logistics,
      deliveredTime: new Date(),
      proofOfDelivery: {
        otpVerified: !!otp,
        recipientSignature: recipientSignature || 'Verified on Glass',
        notes: notes || 'Delivered to recipient address in fresh condition.',
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
