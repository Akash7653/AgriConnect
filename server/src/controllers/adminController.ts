import { Response } from 'express';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { BuyerProfile } from '../models/BuyerProfile.js';
import { CropListing } from '../models/CropListing.js';
import { z } from 'zod';
import { ServiceZone } from '../models/ServiceZone.js';
import mongoose from 'mongoose';
import { RealtimeNotifier } from '../socket/index.js';
import { SEEDED_DEMO_ACCOUNT_EMAILS } from '../config/demoAccounts.js';
import { Refund } from '../models/Refund.js';
import { createRazorpayRefund } from '../services/razorpay.js';
import { finalizeRefund } from '../services/refunds.js';
import { Order } from '../models/Order.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { AuditLog } from '../models/AuditLog.js';
import { queueOrderUpdate } from '../services/email.js';
import { Dispute } from '../models/Dispute.js';
import { AuthRequest } from '../middleware/auth.js';
import { USER_ROLES, ORDER_STATUSES, DEFAULT_PRICING_CONFIG, OrderStatus } from '../config/constants.js';

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
    const realOrderFilter = {
      buyerId: { $nin: seededUserIds },
      'items.farmerId': { $nin: seededUserIds },
    };

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
      Order.countDocuments(realOrderFilter),
      Order.find(realOrderFilter).lean(),
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
      requestedRole: z.enum(['all', 'requested', USER_ROLES.FARMER, USER_ROLES.BUYER, USER_ROLES.BUSINESS, USER_ROLES.LOGISTICS]).optional(),
      status: z.enum(['all', 'active', 'suspended', 'pending_verification']).optional(),
      search: z.string().trim().max(80).optional(),
    }).strict().parse(req.query);
    const { role, requestedRole, status, search } = filters;
    const query: any = process.env.NODE_ENV === 'production'
      ? { email: { $nin: SEEDED_DEMO_ACCOUNT_EMAILS } }
      : {};
    if (role && role !== 'all') query.role = role;
    if (requestedRole === 'requested') query.requestedRole = { $exists: true };
    else if (requestedRole && requestedRole !== 'all') query.requestedRole = requestedRole;
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
  estimatedDeliveryDays: z.number().int().min(1).max(30).optional(),
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
    const seededUserIds = seededUsers.map((user) => user._id);
    const orders = await Order.find({
      buyerId: { $nin: seededUserIds },
      'items.farmerId': { $nin: seededUserIds },
    }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, orders });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

const assignDeliverySchema = z.object({ deliveryAgentId: z.string().refine(mongoose.isValidObjectId, 'Invalid delivery agent ID') });

export async function assignDeliveryAgent(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== USER_ROLES.ADMIN) {
      res.status(403).json({ success: false, message: 'Admin access required.' });
      return;
    }
    const { deliveryAgentId } = assignDeliverySchema.parse(req.body);
    const agent = await User.findOne({ _id: deliveryAgentId, role: USER_ROLES.LOGISTICS, status: 'active' }).select('_id name phone');
    if (!agent) {
      res.status(404).json({ success: false, message: 'Active logistics partner not found.' });
      return;
    }

    const currentOrder = await Order.findById(req.params.id);
    if (!currentOrder) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }
    const eligibleStatuses: OrderStatus[] = [
      ORDER_STATUSES.CONFIRMED,
      ORDER_STATUSES.ACCEPTED,
      ORDER_STATUSES.PREPARING,
      ORDER_STATUSES.READY_FOR_PICKUP,
    ];
    if (!eligibleStatuses.includes(currentOrder.status)) {
      res.status(409).json({ success: false, message: 'Delivery can only be assigned or reassigned before pickup.' });
      return;
    }
    const previousAgentId = currentOrder.logistics?.assignedPartnerId;
    const previousAgentName = currentOrder.logistics?.partnerName;
    if (previousAgentId?.toString() === agent._id.toString()) {
      res.json({ success: true, message: 'This delivery agent is already assigned.', order: currentOrder });
      return;
    }

    const assignmentFilter: Record<string, unknown> = {
      _id: currentOrder._id,
      status: { $in: eligibleStatuses },
    };
    if (previousAgentId) {
      assignmentFilter['logistics.assignedPartnerId'] = previousAgentId;
    } else {
      assignmentFilter.$or = [
        { 'logistics.assignedPartnerId': { $exists: false } },
        { 'logistics.assignedPartnerId': null },
      ];
    }
    const assignedAt = new Date();
    const assignmentEntry = {
      deliveryAgentId: agent._id,
      deliveryAgentName: agent.name,
      assignedBy: req.user._id,
      assignedByName: req.user.name,
      assignedAt,
      ...(previousAgentId ? { previousAgentId, previousAgentName } : {}),
    };
    const order = await Order.findOneAndUpdate(
      assignmentFilter,
      {
        $set: {
          'logistics.assignedPartnerId': agent._id,
          'logistics.partnerName': agent.name,
          'logistics.partnerPhone': agent.phone,
        },
        $push: {
          'logistics.assignmentHistory': assignmentEntry,
          statusHistory: {
            status: currentOrder.status,
            note: previousAgentId ? `Delivery reassigned to ${agent.name}` : `Delivery assigned to ${agent.name}`,
            timestamp: assignedAt,
            updatedBy: req.user._id,
            role: req.user.role,
          },
        },
      },
      { new: true }
    );

    if (!order) {
      res.status(409).json({ success: false, message: 'Order changed while assigning. Refresh and try again.' });
      return;
    }

    await AuditLog.create({
      action: previousAgentId ? 'DELIVERY_AGENT_REASSIGNED' : 'DELIVERY_AGENT_ASSIGNED',
      userId: req.user?._id,
      userName: req.user?.name,
      role: req.user?.role,
      targetResource: 'Order',
      resourceId: order._id.toString(),
      details: {
        deliveryAgentId: agent._id.toString(),
        ...(previousAgentId ? { previousAgentId: previousAgentId.toString(), previousAgentName } : {}),
      },
      ipAddress: req.ip,
    });
    const message = previousAgentId
      ? `Order ${order.orderNumber} was reassigned to you.`
      : `Order ${order.orderNumber} is assigned to you.`;
    await Notification.create({
      recipientId: agent._id,
      title: previousAgentId ? 'Delivery reassigned' : 'Delivery assigned',
      message,
      type: 'logistics',
      link: `/logistics/orders/${order._id}`,
    });
    if (previousAgentId) {
      await Notification.create({
        recipientId: previousAgentId,
        title: 'Delivery reassigned',
        message: `Order ${order.orderNumber} was reassigned to ${agent.name}.`,
        type: 'logistics',
        link: `/logistics/orders/${order._id}`,
      });
    }
    await Notification.create({
      recipientId: order.buyerId,
      title: 'Delivery agent assigned',
      message: `${agent.name} is assigned to deliver order ${order.orderNumber}.`,
      type: 'logistics',
      link: `/buyer/orders/${order._id}`,
    });
    await queueOrderUpdate(
      order._id.toString(),
      `assignment:${agent._id.toString()}:${assignedAt.getTime()}`,
      `${agent.name} is assigned to deliver order ${order.orderNumber}.`
    );
    RealtimeNotifier.emitUserAlert(agent._id.toString(), {
      title: previousAgentId ? 'Delivery reassigned' : 'Delivery assigned',
      message,
      orderId: order._id.toString(),
    });
    RealtimeNotifier.emitOrderStatusUpdate(order.buyerId.toString(), order._id.toString(), {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      partnerName: agent.name,
      assignedAt,
      assignmentHistory: order.logistics.assignmentHistory,
    });
    for (const farmerId of new Set(order.items.map((item) => item.farmerId.toString()))) {
      await Notification.create({
        recipientId: farmerId,
        title: 'Delivery partner assigned',
        message: `${agent.name} is assigned to deliver order ${order.orderNumber}.`,
        type: 'logistics',
        link: `/farmer/orders/${order._id}`,
      });
      RealtimeNotifier.emitOrderStatusUpdate(farmerId, order._id.toString(), {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        partnerName: agent.name,
        assignedAt,
      });
    }
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
    user.requestedRole = undefined;
    user.requestedFarm = undefined;
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

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        requestedRole: user.requestedRole,
        status: user.status,
        isVerified: user.isVerified,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

const refundRequestSchema = z.object({
  reason: z.string().trim().min(5).max(500),
  idempotencyKey: z.string().trim().min(16).max(120),
}).strict();

export async function refundOrder(req: AuthRequest, res: Response): Promise<void> {
  let refund: any;
  try {
    const data = refundRequestSchema.parse(req.body);
    const existing = await Refund.findOne({ idempotencyKey: data.idempotencyKey });
    if (existing) {
      res.status(existing.status === 'processed' ? 200 : 202).json({ success: existing.status === 'processed', refund: existing });
      return;
    }
    const orderRefund = await Refund.findOne({ orderId: req.params.id, status: { $in: ['pending', 'processed'] } });
    if (orderRefund) {
      res.status(409).json({ success: false, message: 'A refund request already exists for this order.', refundId: orderRefund._id });
      return;
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Order not found.' });
      return;
    }
    if (order.payment.status !== 'captured' || order.status !== ORDER_STATUSES.CONFIRMED || !order.payment.transactionId) {
      res.status(409).json({ success: false, message: 'Only captured, unfulfilled orders can be refunded through this endpoint.' });
      return;
    }

    refund = await Refund.create({
      orderId: order._id,
      orderNumber: order.orderNumber,
      paymentId: order.payment.transactionId,
      amountPaise: order.pricing.finalPayablePaise,
      currency: 'INR',
      status: 'pending',
      reason: data.reason,
      idempotencyKey: data.idempotencyKey,
      requestedBy: req.user!._id,
    });

    let providerRefund: Awaited<ReturnType<typeof createRazorpayRefund>>;
    try {
      providerRefund = await createRazorpayRefund({
        paymentId: order.payment.transactionId,
        amountPaise: order.pricing.finalPayablePaise,
        receipt: `refund-${order.orderNumber}`,
      });
    } catch {
      refund.providerStatus = 'unknown';
      await refund.save();
      res.status(202).json({ success: false, message: 'Refund request outcome is uncertain; reconcile it in Razorpay before retrying.', refundId: refund._id });
      return;
    }

    refund.providerRefundId = providerRefund.id;
    refund.providerStatus = providerRefund.status;
    await refund.save();

    if (providerRefund.amount !== order.pricing.finalPayablePaise || providerRefund.currency !== 'INR') {
      refund.status = 'failed';
      await refund.save();
      res.status(502).json({ success: false, message: 'Razorpay refund amount did not match the order. Manual reconciliation required.' });
      return;
    }
    if (providerRefund.status !== 'processed') {
      res.status(202).json({ success: false, message: 'Razorpay accepted the refund; awaiting provider confirmation.', refund });
      return;
    }

    await finalizeRefund({
      refundId: refund._id.toString(),
      providerRefundId: providerRefund.id,
      amountPaise: providerRefund.amount,
      currency: providerRefund.currency,
      actor: {
        userId: req.user!._id,
        userName: req.user!.name,
        role: USER_ROLES.ADMIN,
        ipAddress: req.ip,
      },
    });

    refund.status = 'processed';
    res.json({ success: true, refund });
  } catch (err: any) {
    if (refund?._id && refund.status === 'pending' && !refund.providerRefundId) {
      await Refund.updateOne(
        { _id: refund._id, status: 'pending', providerRefundId: { $exists: false } },
        { $set: { status: 'failed', providerStatus: 'request_failed' } }
      );
    }
    res.status(err?.code === 11000 ? 409 : 400).json({ success: false, message: err.message || 'Refund could not be processed.' });
  }
}

const razorpayAccountSchema = z.object({
  razorpayAccountId: z.string().trim().regex(/^acc_[A-Za-z0-9]+$/, 'A valid Razorpay Route linked account ID is required.'),
}).strict();

export async function setFarmerRazorpayAccount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { razorpayAccountId } = razorpayAccountSchema.parse(req.body);
    const profile = await FarmerProfile.findOneAndUpdate(
      { userId: req.params.farmerId },
      { $set: { razorpayAccountId } },
      { new: true, runValidators: true }
    ).select('userId razorpayAccountId');

    if (!profile) {
      res.status(404).json({ success: false, message: 'Farmer profile not found.' });
      return;
    }

    await AuditLog.create({
      action: 'FARMER_RAZORPAY_ACCOUNT_LINKED',
      userId: req.user!._id,
      userName: req.user!.name,
      role: req.user!.role,
      targetResource: 'FarmerProfile',
      resourceId: profile._id.toString(),
      details: { razorpayAccountId },
      ipAddress: req.ip,
    });

    res.json({ success: true, farmerId: profile.userId, razorpayAccountId: profile.razorpayAccountId });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Could not link Razorpay account.' });
  }
}
