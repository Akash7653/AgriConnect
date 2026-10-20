import { FarmerProfile } from '../models/FarmerProfile.js';
import { Notification } from '../models/Notification.js';
import { Order } from '../models/Order.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import {
  createRazorpayRouteTransfer,
  fetchRazorpayRouteTransfer,
  findRazorpayRouteTransfer,
} from './razorpay.js';

export async function processAutomaticPayouts(): Promise<number> {
  if (process.env.RAZORPAY_ROUTE_ENABLED !== 'true') return 0;

  const candidates = await PayoutLedger.find({
    entryType: 'sale',
    automaticPayoutEligibleAt: { $exists: true },
    settlementStatus: { $in: ['accrued', 'processing'] },
    $or: [
      { automaticPayoutLeaseUntil: { $exists: false } },
      { automaticPayoutLeaseUntil: { $lte: new Date() } },
    ],
  })
    .sort({ automaticPayoutEligibleAt: 1 })
    .limit(50);

  let settledCount = 0;
  for (const candidate of candidates) {
    const ledger = await PayoutLedger.findOneAndUpdate(
      {
        _id: candidate._id,
        settlementStatus: { $in: ['accrued', 'processing'] },
        $or: [
          { automaticPayoutLeaseUntil: { $exists: false } },
          { automaticPayoutLeaseUntil: { $lte: new Date() } },
        ],
      },
      {
        $set: {
          automaticPayoutLeaseUntil: new Date(Date.now() + 120_000),
          settlementStatus: 'processing',
        },
      },
      { new: true }
    );
    if (!ledger) continue;

    const [order, farmerProfile] = await Promise.all([
      Order.findById(ledger.orderId).select('payment.status payment.transactionId status'),
      FarmerProfile.findOne({ userId: ledger.farmerId }).select('razorpayAccountId'),
    ]);
    if (
      order?.status !== 'delivered' ||
      order.payment.status !== 'captured' ||
      !order.payment.transactionId ||
      !farmerProfile?.razorpayAccountId
    ) {
      console.error(`Automatic payout ${candidate._id} is waiting for a captured delivered order and linked Razorpay account.`);
      continue;
    }

    try {
      let transfer = ledger.razorpayTransferId
        ? await fetchRazorpayRouteTransfer(ledger.razorpayTransferId)
        : await findRazorpayRouteTransfer({
            paymentId: order.payment.transactionId,
            ledgerId: ledger._id.toString(),
          });

      if (!transfer) {
        transfer = await createRazorpayRouteTransfer({
          paymentId: order.payment.transactionId,
          accountId: farmerProfile.razorpayAccountId,
          amountPaise: ledger.farmerPayoutPaise,
          ledgerId: ledger._id.toString(),
        });
      }

      if (transfer.status === 'failed' || transfer.status === 'reversed') {
        await PayoutLedger.updateOne(
          { _id: ledger._id, settlementStatus: 'processing' },
          {
            $set: {
              settlementStatus: 'on_hold',
              razorpayTransferId: transfer.id,
              notes: `Razorpay Route transfer ${transfer.status}; review in the Razorpay dashboard.`,
            },
            $unset: { automaticPayoutLeaseUntil: 1 },
          }
        );
        console.error(`Automatic payout ${ledger._id} requires manual review after transfer ${transfer.status}.`);
        continue;
      }

      if (transfer.status !== 'processed') {
        await PayoutLedger.updateOne(
          { _id: ledger._id, settlementStatus: 'processing' },
          {
            $set: { razorpayTransferId: transfer.id },
            $unset: { automaticPayoutLeaseUntil: 1 },
          }
        );
        continue;
      }

      const settled = await PayoutLedger.findOneAndUpdate(
        { _id: ledger._id, settlementStatus: 'processing' },
        {
          $set: {
            settlementStatus: 'settled',
            razorpayTransferId: transfer.id,
            transactionReference: transfer.id,
            settledAt: new Date(),
          },
          $unset: { automaticPayoutLeaseUntil: 1 },
        },
        { new: true }
      );
      if (!settled) continue;

      await Notification.create({
        recipientId: ledger.farmerId,
        title: 'Farmer Payout Settled',
        message: `Your payout of ₹${(ledger.farmerPayoutPaise / 100).toFixed(2)} for Order #${ledger.orderNumber} has been settled. Transfer: ${transfer.id}.`,
        type: 'payout',
        link: '/farmer/payouts',
      });
      settledCount++;
    } catch (error) {
      console.error(
        `Automatic payout ${ledger._id} could not be reconciled:`,
        error instanceof Error ? error.message : 'Unknown Razorpay error'
      );
    }
  }
  return settledCount;
}
