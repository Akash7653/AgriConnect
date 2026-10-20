import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog.js';
import { CropListing } from '../models/CropListing.js';
import { Order, recordSellerFulfilmentStatus } from '../models/Order.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { Refund } from '../models/Refund.js';
import { ORDER_STATUSES } from '../config/constants.js';

export async function finalizeRefund(params: {
  refundId: string;
  providerRefundId: string;
  amountPaise: number;
  currency: string;
  actor?: { userId: mongoose.Types.ObjectId; userName: string; role: string; ipAddress?: string };
}): Promise<void> {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const refund = await Refund.findById(params.refundId).session(session);
      if (!refund) throw new Error('Refund record not found.');
      if (params.amountPaise !== refund.amountPaise || params.currency !== refund.currency) {
        throw new Error('Razorpay refund amount or currency does not match the refund record.');
      }
      if (refund.status === 'processed') return;

      const order = await Order.findOne({
        _id: refund.orderId,
        status: ORDER_STATUSES.CONFIRMED,
        'payment.status': 'captured',
      }).session(session);
      if (!order) throw new Error('Order state changed before refund reconciliation.');

      for (const item of order.items) {
        const restored = await CropListing.updateOne(
          { _id: item.listingId, reservedQuantity: { $gte: item.quantity } },
          { $inc: { availableQuantity: item.quantity, reservedQuantity: -item.quantity } },
          { session }
        );
        if (restored.modifiedCount !== 1) throw new Error('Inventory reconciliation failed during refund.');
      }

      const saleEntries = await PayoutLedger.find({
        orderId: order._id,
        entryType: 'sale',
      }).session(session);
      for (const sale of saleEntries) {
        await PayoutLedger.create([{
          orderId: order._id,
          orderNumber: order.orderNumber,
          farmerId: sale.farmerId,
          farmerName: sale.farmerName,
          grossProductValuePaise: -sale.grossProductValuePaise,
          farmerSharePct: sale.farmerSharePct,
          farmerPayoutPaise: -sale.farmerPayoutPaise,
          platformCommissionPaise: -sale.platformCommissionPaise,
          operationsReservePaise: -sale.operationsReservePaise,
          settlementStatus: 'on_hold',
          entryType: 'refund_adjustment',
          relatedEntryId: sale._id,
          notes: `Refund adjustment for ${params.providerRefundId}`,
        }], { session });
      }

      order.status = ORDER_STATUSES.CANCELLED;
      order.payment.status = 'refunded';
      recordSellerFulfilmentStatus(
        order,
        ORDER_STATUSES.CANCELLED,
        `Provider-confirmed refund ${params.providerRefundId}`,
        params.actor?.userId,
      );
      order.statusHistory.push({
        status: ORDER_STATUSES.CANCELLED,
        note: `Provider-confirmed refund ${params.providerRefundId}`,
        timestamp: new Date(),
        updatedBy: params.actor?.userId,
        role: params.actor?.role || 'webhook',
      });
      await order.save({ session });

      refund.providerRefundId = params.providerRefundId;
      refund.providerStatus = 'processed';
      refund.status = 'processed';
      await refund.save({ session });

      await AuditLog.create([{
        action: 'ORDER_REFUND_PROCESSED',
        userId: params.actor?.userId,
        userName: params.actor?.userName,
        role: params.actor?.role || 'webhook',
        targetResource: 'Order',
        resourceId: order._id.toString(),
        details: { refundId: params.providerRefundId, amountPaise: params.amountPaise },
        ipAddress: params.actor?.ipAddress,
      }], { session });
    });
  } finally {
    await session.endSession();
  }
}
