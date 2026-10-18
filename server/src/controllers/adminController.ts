import { Response } from 'express';
import { User } from '../models/User.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { CropListing } from '../models/CropListing.js';
import { Order } from '../models/Order.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { AuditLog } from '../models/AuditLog.js';
import { Dispute } from '../models/Dispute.js';
import { AuthRequest } from '../middleware/auth.js';
import { USER_ROLES, ORDER_STATUSES, DEFAULT_PRICING_CONFIG } from '../config/constants.js';

export async function getAdminAnalytics(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== USER_ROLES.ADMIN) {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }

    const [
      totalUsers,
      totalFarmers,
      verifiedFarmers,
      totalListings,
      totalOrders,
      orders,
      settings,
      recentDisputes,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: USER_ROLES.FARMER }),
      User.countDocuments({ role: USER_ROLES.FARMER, isVerified: true }),
      CropListing.countDocuments({ status: 'active' }),
      Order.countDocuments(),
      Order.find().lean(),
      SystemSettings.findOne({ key: 'global_config' }),
      Dispute.find().sort({ createdAt: -1 }).limit(5),
    ]);

    // Financial Metrics computed strictly from real orders
    let totalGMVPaise = 0;
    let totalPlatformCommissionPaise = 0;
    let totalFarmerPayoutsPaise = 0;
    let totalOperationsReservePaise = 0;
    let deliveredOrdersCount = 0;
    let cancelledOrdersCount = 0;

    const categoryBreakdown: Record<string, { count: number; valuePaise: number }> = {};

    for (const ord of orders) {
      if (ord.status !== ORDER_STATUSES.CANCELLED) {
        totalGMVPaise += ord.pricing.grossProductValuePaise;
        totalPlatformCommissionPaise += ord.pricing.platformCommissionPaise;
        totalFarmerPayoutsPaise += ord.pricing.farmerPayoutPaise;
        totalOperationsReservePaise += ord.pricing.operationsReservePaise;
      }

      if (ord.status === ORDER_STATUSES.DELIVERED) {
        deliveredOrdersCount++;
      } else if (ord.status === ORDER_STATUSES.CANCELLED) {
        cancelledOrdersCount++;
      }

      for (const item of ord.items) {
        // category stats
        const key = item.cropName;
        const current = categoryBreakdown[key] || { count: 0, valuePaise: 0 };
        current.count += item.quantity;
        current.valuePaise += item.totalPaise;
        categoryBreakdown[key] = current;
      }
    }

    const fulfillmentRate =
      totalOrders > 0 ? ((deliveredOrdersCount / Math.max(1, totalOrders - cancelledOrdersCount)) * 100).toFixed(1) : '100';

    res.json({
      success: true,
      analytics: {
        totalUsers,
        totalFarmers,
        verifiedFarmers,
        totalListings,
        totalOrders,
        deliveredOrdersCount,
        cancelledOrdersCount,
        fulfillmentRate: `${fulfillmentRate}%`,
        financials: {
          gmvPaise: totalGMVPaise,
          platformRevenuePaise: totalPlatformCommissionPaise,
          farmerPayoutsPaise: totalFarmerPayoutsPaise,
          operationsReservePaise: totalOperationsReservePaise,
        },
        settings: settings || DEFAULT_PRICING_CONFIG,
        recentDisputes,
        topSellingItems: Object.entries(categoryBreakdown)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.valuePaise - a.valuePaise)
          .slice(0, 7),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== USER_ROLES.ADMIN) {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }

    const { role, status, search } = req.query;
    const query: any = {};
    if (role && role !== 'all') query.role = role;
    if (status && status !== 'all') query.status = status;
    if (search && typeof search === 'string') {
      query.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    }

    const users = await User.find(query).select('-passwordHash').sort({ createdAt: -1 });

    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function verifyFarmerKYC(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== USER_ROLES.ADMIN) {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }

    const { userId } = req.params;
    const { status = 'verified' } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    user.isVerified = status === 'verified';
    await user.save();

    await FarmerProfile.findOneAndUpdate(
      { userId },
      {
        $set: {
          'kycDetails.verificationStatus': status,
          'kycDetails.verifiedAt': new Date(),
          'kycDetails.verifiedBy': req.user._id,
        },
      }
    );

    await AuditLog.create({
      action: 'FARMER_VERIFIED',
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      targetResource: 'Farmer',
      resourceId: userId,
      details: { status },
    });

    res.json({ success: true, message: `Farmer KYC updated to ${status}` });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function updateSystemSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== USER_ROLES.ADMIN) {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }

    const {
      farmerSharePct,
      platformCommissionPct,
      opsReservePct,
      defaultDeliveryFeePaise,
      freeDeliveryThresholdPaise,
    } = req.body;

    const totalPct = Number(farmerSharePct) + Number(platformCommissionPct) + Number(opsReservePct);
    if (totalPct !== 100) {
      res.status(400).json({
        success: false,
        message: `Sum of Farmer Share (${farmerSharePct}%), Platform Commission (${platformCommissionPct}%), and Operations Reserve (${opsReservePct}%) must equal exactly 100%. Currently: ${totalPct}%.`,
      });
      return;
    }

    const updated = await SystemSettings.findOneAndUpdate(
      { key: 'global_config' },
      {
        $set: {
          farmerSharePct: Number(farmerSharePct),
          platformCommissionPct: Number(platformCommissionPct),
          opsReservePct: Number(opsReservePct),
          defaultDeliveryFeePaise: Number(defaultDeliveryFeePaise),
          freeDeliveryThresholdPaise: Number(freeDeliveryThresholdPaise),
        },
      },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      action: 'MARKETPLACE_SETTINGS_UPDATED',
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      details: { updated },
    });

    res.json({ success: true, message: 'Platform fee settings updated successfully', settings: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== USER_ROLES.ADMIN) {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }

    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);

    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
