import { Response } from 'express';
import { User } from '../models/User.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { BuyerProfile } from '../models/BuyerProfile.js';
import { CropListing } from '../models/CropListing.js';
import { z } from 'zod';
import { ServiceZone } from '../models/ServiceZone.js';
import mongoose from 'mongoose';
import { RealtimeNotifier } from '../socket/index.js';
import { SEEDED_DEMO_ACCOUNT_EMAILS } from '../config/demoAccounts.js';
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

    const seededUsers = process.env.NODE_ENV === 'production'
      ? await User.find({ email: { $in: SEEDED_DEMO_ACCOUNT_EMAILS } }).select('_id').lean()
      : [];
    const seededUserIds = seededUsers.map((user) => user._id);
    const productionUserFilter = process.env.NODE_ENV === 'production'
      ? { email: { $nin: SEEDED_DEMO_ACCOUNT_EMAILS } }
      : {};

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
      User.countDocuments(productionUserFilter),
      User.countDocuments({ ...productionUserFilter, role: USER_ROLES.FARMER }),
      User.countDocuments({ ...productionUserFilter, role: USER_ROLES.FARMER, isVerified: true }),
      CropListing.countDocuments({ status: 'active', farmerId: { $nin: seededUserIds } }),
      Order.countDocuments({ buyerId: { $nin: seededUserIds } }),
      Order.find({ buyerId: { $nin: seededUserIds } }).lean(),
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

    const filters = z.object({
      role: z.enum(['all', ...Object.values(USER_ROLES)]).optional(),
      status: z.enum(['all', 'active', 'suspended', 'pending_verification']).optional(),
      search: z.string().trim().max(80).optional(),
    }).strict().parse(req.query);
    const { role, status, search } = filters;
    const query: any = process.env.NODE_ENV === 'production'
      ? { email: { $nin: SEEDED_DEMO_ACCOUNT_EMAILS } }
      : {};
    if (role && role !== 'all') query.role = role;
    if (status && status !== 'all') query.status = status;
    if (search && typeof search === 'string') {
      const safeSearch = escapeRegex(search);
      query.$or = [{ name: { $regex: safeSearch, $options: 'i' } }, { email: { $regex: safeSearch, $options: 'i' } }];
    }

    const users = await User.find(query).select('-passwordHash').sort({ createdAt: -1 });

    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

const serviceZoneSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCodes: z.array(z.string().min(5)).min(1),
  active: z.boolean().default(true),
  deliveryFeePaise: z.number().int().min(0).optional(),
  freeDeliveryThresholdPaise: z.number().int().min(0).optional(),
  fulfilmentMethods: z
    .array(z.enum(['supplier_delivery', 'third_party_delivery', 'customer_pickup', 'platform_hub']))
    .min(1)
    .default(['supplier_delivery']),
});

export async function getServiceZones(req: AuthRequest, res: Response): Promise<void> {
  try {
    const zones = await ServiceZone.find().sort({ city: 1, name: 1 });
    res.json({ success: true, zones });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createServiceZone(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = serviceZoneSchema.parse(req.body);
    const zone = await ServiceZone.create(data);

    await AuditLog.create({
      action: 'SERVICE_ZONE_CREATED',
      userId: req.user?._id,
      userName: req.user?.name,
      role: req.user?.role,
      targetResource: 'ServiceZone',
      resourceId: zone._id.toString(),
      details: data,
    });

    res.status(201).json({ success: true, zone });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function updateServiceZone(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = serviceZoneSchema.partial().parse(req.body);
    const zone = await ServiceZone.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!zone) {
      res.status(404).json({ success: false, message: 'Service zone not found' });
      return;
    }

    await AuditLog.create({
      action: 'SERVICE_ZONE_UPDATED',
      userId: req.user?._id,
      userName: req.user?.name,
      role: req.user?.role,
      targetResource: 'ServiceZone',
      resourceId: zone._id.toString(),
      details: data,
    });

    res.json({ success: true, zone });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function deactivateServiceZone(req: AuthRequest, res: Response): Promise<void> {
  try {
    const zone = await ServiceZone.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { new: true });
    if (!zone) {
      res.status(404).json({ success: false, message: 'Service zone not found' });
      return;
    }

    await AuditLog.create({
      action: 'SERVICE_ZONE_DEACTIVATED',
      userId: req.user?._id,
      userName: req.user?.name,
      role: req.user?.role,
      targetResource: 'ServiceZone',
      resourceId: zone._id.toString(),
    });

    res.json({ success: true, zone });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function getAdminOrders(req: AuthRequest, res: Response): Promise<void> {
  try {
    const seededUsers = process.env.NODE_ENV === 'production'
      ? await User.find({ email: { $in: SEEDED_DEMO_ACCOUNT_EMAILS } }).select('_id').lean()
      : [];
    const orders = await Order.find({ buyerId: { $nin: seededUsers.map((user) => user._id) } }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, orders });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

const assignDeliverySchema = z.object({ deliveryAgentId: z.string().refine(mongoose.isValidObjectId, 'Invalid delivery agent ID') });

export async function assignDeliveryAgent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { deliveryAgentId } = assignDeliverySchema.parse(req.body);
    const agent = await User.findOne({ _id: deliveryAgentId, role: USER_ROLES.LOGISTICS, status: 'active' }).select('_id name phone');
    if (!agent) {
      res.status(404).json({ success: false, message: 'Active logistics partner not found.' });
      return;
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        status: ORDER_STATUSES.READY_FOR_PICKUP,
        'logistics.assignedPartnerId': { $exists: false },
      },
      {
        $set: {
          'logistics.assignedPartnerId': agent._id,
          'logistics.partnerName': agent.name,
          'logistics.partnerPhone': agent.phone,
        },
      },
      { new: true }
    );

    if (!order) {
      res.status(409).json({ success: false, message: 'Order is not ready or has already been assigned.' });
      return;
    }

    await AuditLog.create({
      action: 'DELIVERY_AGENT_ASSIGNED',
      userId: req.user?._id,
      userName: req.user?.name,
      role: req.user?.role,
      targetResource: 'Order',
      resourceId: order._id.toString(),
      details: { deliveryAgentId: agent._id.toString() },
      ipAddress: req.ip,
    });
    RealtimeNotifier.emitUserAlert(agent._id.toString(), {
      title: 'Delivery assigned',
      message: `Order ${order.orderNumber} is assigned to you.`,
      orderId: order._id.toString(),
    });
    RealtimeNotifier.emitAdminMetricsRefresh({ type: 'delivery_assigned' });

    res.json({ success: true, order });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

const accountRoleApprovalSchema = z.object({
  role: z.enum([USER_ROLES.FARMER, USER_ROLES.BUSINESS, USER_ROLES.LOGISTICS, USER_ROLES.BUYER]),
  farm: z.object({
    farmName: z.string().min(2),
    village: z.string().min(2),
    district: z.string().min(2),
    state: z.string().min(2),
    pinCode: z.string().min(5),
  }).optional(),
}).strict();

export async function approveAccountRole(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = accountRoleApprovalSchema.parse(req.body);
    const user = await User.findById(req.params.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }
    if (user.role === USER_ROLES.ADMIN) {
      res.status(403).json({ success: false, message: 'Admin role changes require out-of-band provisioning.' });
      return;
    }
    if (data.role === USER_ROLES.FARMER && !data.farm) {
      res.status(400).json({ success: false, message: 'Farm details are required to approve a farmer account.' });
      return;
    }

    user.role = data.role;
    user.isVerified = true;
    user.status = 'active';
    if (data.farm) {
      user.address = {
        ...user.address,
        villageOrCity: data.farm.village,
        district: data.farm.district,
        state: data.farm.state,
        pinCode: data.farm.pinCode,
      };
      await FarmerProfile.findOneAndUpdate(
        { userId: user._id },
        {
          $set: {
            farmName: data.farm.farmName,
            location: {
              village: data.farm.village,
              district: data.farm.district,
              state: data.farm.state,
              pinCode: data.farm.pinCode,
            },
            'kycDetails.verificationStatus': 'verified',
            'kycDetails.verifiedAt': new Date(),
            'kycDetails.verifiedBy': req.user!._id,
          },
          $setOnInsert: { userId: user._id, primaryCrops: [] },
        },
        { upsert: true, new: true }
      );
    }
    if (data.role === USER_ROLES.BUSINESS) {
      await BuyerProfile.findOneAndUpdate(
        { userId: user._id },
        { $set: { buyerType: 'restaurant' }, $setOnInsert: { userId: user._id, deliveryAddresses: [] } },
        { upsert: true, new: true }
      );
    }

    await user.save();
    await AuditLog.create({
      action: 'ACCOUNT_ROLE_APPROVED',
      userId: req.user?._id,
      userName: req.user?.name,
      role: req.user?.role,
      targetResource: 'User',
      resourceId: user._id.toString(),
      details: { approvedRole: data.role },
      ipAddress: req.ip,
    });

    res.json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role, isVerified: user.isVerified } });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}
