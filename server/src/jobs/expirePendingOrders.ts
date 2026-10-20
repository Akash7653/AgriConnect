import mongoose from 'mongoose';
import { CropListing } from '../models/CropListing.js';
import { Order } from '../models/Order.js';
import { ORDER_STATUSES } from '../config/constants.js';
import { RealtimeNotifier } from '../socket/index.js';

let running = false;

export async function expirePendingOrders(now = new Date()): Promise<number> {
  if (running || mongoose.connection.readyState !== 1) return 0;
  running = true;
  const session = await mongoose.startSession();
  let expiredOrders: Array<{ _id: mongoose.Types.ObjectId; buyerId: mongoose.Types.ObjectId; orderNumber: string }> = [];

  try {
    await session.withTransaction(async () => {
      const candidates = await Order.find({
        status: ORDER_STATUSES.PENDING_PAYMENT,
        'payment.status': 'pending',
        'payment.expiresAt': { $lte: now },
      })
        .select('_id buyerId orderNumber items')
        .sort({ 'payment.expiresAt': 1 })
        .limit(50)
        .session(session);

      expiredOrders = [];
      for (const candidate of candidates) {
        const transitioned = await Order.findOneAndUpdate(
          {
            _id: candidate._id,
            status: ORDER_STATUSES.PENDING_PAYMENT,
            'payment.status': 'pending',
            'payment.expiresAt': { $lte: now },
          },
          {
            $set: {
              status: ORDER_STATUSES.CANCELLED,
              'payment.status': 'failed',
              'sellerFulfilments.$[].status': ORDER_STATUSES.CANCELLED,
            },
            $push: {
              'sellerFulfilments.$[].statusHistory': {
                status: ORDER_STATUSES.CANCELLED,
                note: 'Payment reservation expired before verification.',
                timestamp: now,
              },
              statusHistory: {
                status: ORDER_STATUSES.CANCELLED,
                note: 'Payment reservation expired before verification.',
                timestamp: now,
                role: 'system',
              },
            },
          },
          { new: true, session }
        );
        if (!transitioned) continue;

        for (const item of transitioned.items) {
          const release = await CropListing.updateOne(
            { _id: item.listingId, reservedQuantity: { $gte: item.quantity } },
            { $inc: { availableQuantity: item.quantity, reservedQuantity: -item.quantity } },
            { session }
          );
          if (release.modifiedCount !== 1) {
            throw new Error(`Unable to release expired inventory for order ${transitioned.orderNumber}.`);
          }
        }

        expiredOrders.push({
          _id: transitioned._id,
          buyerId: transitioned.buyerId,
          orderNumber: transitioned.orderNumber,
        });
      }
    });
  } finally {
    await session.endSession();
    running = false;
  }

  for (const order of expiredOrders) {
    RealtimeNotifier.emitUserAlert(order.buyerId.toString(), {
      title: 'Payment window expired',
      message: `Order ${order.orderNumber} expired and its stock reservation was released.`,
      orderId: order._id.toString(),
    });
    RealtimeNotifier.emitAdminMetricsRefresh({ type: 'order_expired' });
  }

  return expiredOrders.length;
}

export function startPendingOrderExpiryJob(): ReturnType<typeof setInterval> {
  const timer = setInterval(() => {
    void expirePendingOrders().catch((error: unknown) => {
      console.error('Pending-order expiry job failed:', error instanceof Error ? error.message : 'Unknown error');
    });
  }, 60_000);
  timer.unref();
  return timer;
}
