import { Request, Response } from 'express';
import { z } from 'zod';

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
