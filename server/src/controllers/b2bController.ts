import { Response } from 'express';
import { z } from 'zod';
import { QuoteRequest } from '../models/QuoteRequest.js';
import { BuyerProfile } from '../models/BuyerProfile.js';
import { Notification } from '../models/Notification.js';
import { AuthRequest } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';

export const createQuoteSchema = z.object({
  cropName: z.string().min(2),
  category: z.string().min(2),
  requiredQuantity: z.number().min(10, 'Minimum bulk quantity is 10'),
  unit: z.string().default('kg'),
  targetPricePerUnitPaise: z.number().optional(),
  frequency: z.enum(['one-time', 'weekly', 'bi-weekly', 'monthly']).default('one-time'),
  requiredByDate: z.string().refine((d) => !isNaN(Date.parse(d))),
  deliveryLocation: z.object({
    address: z.string().min(2),
    city: z.string().min(2),
    district: z.string().min(2),
    state: z.string().min(2),
    pinCode: z.string().min(5),
  }),
  notes: z.string().optional(),
});

export async function createQuoteRequest(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const data = createQuoteSchema.parse(req.body);
    const profile = await BuyerProfile.findOne({ userId: req.user._id });

    const quoteReq = await QuoteRequest.create({
      buyerId: req.user._id,
      buyerName: req.user.name,
      buyerBusiness: profile?.businessName || req.user.name,
      cropName: data.cropName,
      category: data.category,
      requiredQuantity: data.requiredQuantity,
      unit: data.unit,
      targetPricePerUnitPaise: data.targetPricePerUnitPaise,
      frequency: data.frequency,
      requiredByDate: new Date(data.requiredByDate),
      deliveryLocation: data.deliveryLocation,
      notes: data.notes,
      status: 'open',
    });

    res.status(201).json({
      success: true,
      message: 'Bulk RFQ submitted. Farmers and FPOs will provide direct quotes.',
      quoteRequest: quoteReq,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function getQuoteRequests(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status, category } = req.query;
    const query: any = {};
    if (status && status !== 'all') query.status = status;
    if (category && category !== 'all') query.category = category;

    // If buyer, show their own RFQs; if farmer/admin, show all open/active RFQs
    if (req.user && req.user.role === USER_ROLES.BUSINESS) {
      query.buyerId = req.user._id;
    }

    const requests = await QuoteRequest.find(query).sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function submitQuoteResponse(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== USER_ROLES.FARMER) {
      res.status(403).json({ success: false, message: 'Only registered farmers can quote on RFQs' });
      return;
    }

    const { id } = req.params;
    const { offeredPricePerUnitPaise, availableQuantity, deliveryLeadDays, notes } = req.body;

    const quoteReq = await QuoteRequest.findById(id);
    if (!quoteReq) {
      res.status(404).json({ success: false, message: 'RFQ not found' });
      return;
    }

    // Add farmer quote response
    quoteReq.responses.push({
      farmerId: req.user._id,
      farmerName: req.user.name,
      farmLocation: `${req.user.address?.villageOrCity || ''}, ${req.user.address?.district || ''}`,
      offeredPricePerUnitPaise: Number(offeredPricePerUnitPaise),
      availableQuantity: Number(availableQuantity),
      deliveryLeadDays: Number(deliveryLeadDays || 2),
      notes,
      createdAt: new Date(),
    });

    quoteReq.status = 'quotes_received';
    await quoteReq.save();

    // Notify buyer
    await Notification.create({
      recipientId: quoteReq.buyerId,
      title: 'New Quote Received on Bulk RFQ',
      message: `${req.user.name} offered ₹${(offeredPricePerUnitPaise / 100).toFixed(2)}/${quoteReq.unit} for your ${quoteReq.cropName} RFQ.`,
      type: 'quote',
      link: `/b2b/procurement`,
    });

    res.json({ success: true, message: 'Quote submitted to buyer', quoteRequest: quoteReq });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function saveProcurementList(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { name, items } = req.body;
    const profile = await BuyerProfile.findOne({ userId: req.user._id });
    if (!profile) {
      res.status(404).json({ success: false, message: 'Buyer profile not found' });
      return;
    }

    profile.savedProcurementLists.push({ name, items });
    await profile.save();

    res.json({ success: true, message: 'Procurement list saved', lists: profile.savedProcurementLists });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}
