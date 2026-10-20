import { Response } from 'express';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { Notification } from '../models/Notification.js';
import { AuthRequest } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';

export async function getFarmerPayoutLedger(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const ledgers = await PayoutLedger.find({ farmerId: req.user._id }).sort({ createdAt: -1 });

    const totalGross = ledgers.reduce((acc, curr) => acc + curr.grossProductValuePaise, 0);
    const totalFarmerShare = ledgers.reduce((acc, curr) => acc + curr.farmerPayoutPaise, 0);
    const totalSettled = ledgers
      .filter((l) => l.settlementStatus === 'settled')
      .reduce((acc, curr) => acc + curr.farmerPayoutPaise, 0);
    const pendingSettlement = ledgers
      .filter((l) => ['accrued', 'processing', 'on_hold'].includes(l.settlementStatus))
      .reduce((acc, curr) => acc + curr.farmerPayoutPaise, 0);

    const farmerProfile = await FarmerProfile.findOne({ userId: req.user._id });

    res.json({
      success: true,
      summary: {
        totalGrossPaise: totalGross,
        totalFarmerSharePaise: totalFarmerShare,
        totalSettledPaise: totalSettled,
        pendingSettlementPaise: pendingSettlement,
        bankDetails: farmerProfile?.bankDetails || null,
      },
      ledgers,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getAllPayoutLedgers(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== USER_ROLES.ADMIN) {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }

    const { status, farmerId } = req.query;
    const query: any = {};
    if (status && status !== 'all') query.settlementStatus = status;
    if (farmerId) query.farmerId = farmerId;

    const ledgers = await PayoutLedger.find(query).sort({ createdAt: -1 }).limit(100);

    const totalGross = ledgers.reduce((acc, l) => acc + l.grossProductValuePaise, 0);
    const totalPlatformCommission = ledgers.reduce((acc, l) => acc + l.platformCommissionPaise, 0);
    const totalFarmerPayout = ledgers.reduce((acc, l) => acc + l.farmerPayoutPaise, 0);

    res.json({
      success: true,
      summary: {
        totalGrossPaise: totalGross,
        totalPlatformCommissionPaise: totalPlatformCommission,
        totalFarmerPayoutPaise: totalFarmerPayout,
      },
      ledgers,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function settleFarmerPayout(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== USER_ROLES.ADMIN) {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }

    const { ledgerId } = req.params;
    const { transactionReference, notes } = req.body;

    const ledger = await PayoutLedger.findById(ledgerId);
    if (!ledger) {
      res.status(404).json({ success: false, message: 'Payout ledger record not found' });
      return;
    }

    ledger.settlementStatus = 'settled';
    ledger.transactionReference = transactionReference || `BANK-UTR-${Date.now()}`;
    ledger.settledAt = new Date();
    if (notes) ledger.notes = notes;
    await ledger.save();

    // Notify farmer of verified settlement
    await Notification.create({
      recipientId: ledger.farmerId,
      title: 'Farmer Payout Settled',
      message: `Your payout of ₹${(ledger.farmerPayoutPaise / 100).toFixed(2)} for Order #${ledger.orderNumber} has been settled to your account. UTR: ${ledger.transactionReference}.`,
      type: 'payout',
      link: '/farmer/payouts',
    });

    res.json({ success: true, message: 'Payout settled successfully', ledger });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}
