import { Request, Response } from 'express';
import { z } from 'zod';
import { CropListing } from '../models/CropListing.js';
import { User } from '../models/User.js';
import { USER_ROLES } from '../config/constants.js';
import { SEEDED_DEMO_ACCOUNT_EMAILS } from '../config/demoAccounts.js';

const campaignSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,60}$/),
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(180),
  imageUrl: z.string().url().refine((value) => new URL(value).protocol === 'https:'),
  category: z.enum([
    'vegetables',
    'fruits',
    'grains',
    'pulses',
    'spices',
    'herbs',
    'dairy',
    'organic-special',
  ]),
  ctaLabel: z.string().trim().min(2).max(32),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
}).refine((campaign) =>
  !campaign.startsAt || !campaign.endsAt || new Date(campaign.startsAt) < new Date(campaign.endsAt),
  { message: 'Campaign end time must be after its start time.' }
);

const campaignsSchema = z.array(campaignSchema).max(10);

export async function getStorefrontCampaigns(_req: Request, res: Response): Promise<void> {
  const rawCampaigns = process.env.STOREFRONT_CAMPAIGNS_JSON;
  if (!rawCampaigns?.trim()) {
    res.json({ success: true, campaigns: [] });
    return;
  }

  try {
    const campaigns = campaignsSchema.parse(JSON.parse(rawCampaigns));
    const now = Date.now();
    const activeCampaigns = campaigns.filter((campaign) =>
      (!campaign.startsAt || new Date(campaign.startsAt).getTime() <= now) &&
      (!campaign.endsAt || new Date(campaign.endsAt).getTime() > now)
    );
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({ success: true, campaigns: activeCampaigns });
  } catch {
    console.error('[storefront] Invalid STOREFRONT_CAMPAIGNS_JSON configuration');
    res.status(500).json({
      success: false,
      message: 'Storefront campaigns are temporarily unavailable.',
    });
  }
}

export async function getStorefrontProducts(req: Request, res: Response): Promise<void> {
  try {
    const filters = z.object({
      search: z.string().trim().max(100).optional(),
      category: z.string().trim().max(40).optional(),
      state: z.string().trim().max(80).optional(),
      district: z.string().trim().max(80).optional(),
      limit: z.coerce.number().int().min(1).max(24).default(12),
    }).parse(req.query);

    const approvedFarmers = await User.find({
      role: USER_ROLES.FARMER,
      isVerified: true,
      status: 'active',
      ...(process.env.NODE_ENV === 'production' ? { email: { $nin: SEEDED_DEMO_ACCOUNT_EMAILS } } : {}),
    }).select('_id').lean();
    const query: Record<string, unknown> = {
      status: 'active',
      availableQuantity: { $gt: 0 },
      farmerId: { $in: approvedFarmers.map((farmer) => farmer._id) },
    };
    if (filters.search) {
      const safeSearch = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { cropName: { $regex: safeSearch, $options: 'i' } },
        { variety: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    if (filters.category) query.category = filters.category;
    if (filters.state) query['location.state'] = { $regex: filters.state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    if (filters.district) query['location.district'] = { $regex: filters.district.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    const listings = await CropListing.find(query)
      .select('cropName category unit pricePerUnitPaise availableQuantity images location isOrganicCertified harvestDate description minOrderQuantity farmerId createdAt')
      .populate('farmerId', 'name')
      .sort({ createdAt: -1 })
      .limit(filters.limit)
      .lean();

    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.json({
      success: true,
      listings,
      pagination: { page: 1, limit: filters.limit, total: listings.length, totalPages: listings.length ? 1 : 0 },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: 'Invalid storefront product filters.' });
      return;
    }
    console.error('[storefront] Public products could not be loaded');
    res.status(500).json({ success: false, message: 'Products are temporarily unavailable.' });
  }
}
