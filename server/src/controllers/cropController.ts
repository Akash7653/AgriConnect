import { Request, Response } from 'express';
import { z } from 'zod';
import { CropListing } from '../models/CropListing.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { AuthRequest } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';
import { RealtimeNotifier } from '../socket/index.js';

export const createListingSchema = z.object({
  cropName: z.string().min(2, 'Crop name is required'),
  variety: z.string().optional(),
  category: z.enum([
    'Vegetables',
    'Fruits',
    'Grains & Cereals',
    'Pulses',
    'Spices',
    'Greens & Herbs',
    'Organic Special',
  ]),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  images: z.array(z.string()).default([]),
  qualityGrade: z.enum(['A+', 'A', 'B+', 'B']).default('A'),
  pricePerUnitPaise: z.number().min(100, 'Price must be at least ₹1.00'),
  unit: z.enum(['kg', 'quintal', 'box', 'bunch', 'crate']).default('kg'),
  availableQuantity: z.number().min(1, 'Available quantity must be at least 1'),
  minOrderQuantity: z.number().default(1),
  harvestDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Valid harvest date required'),
  expectedShelfLifeDays: z.number().default(5),
  village: z.string().min(1, 'Village is required'),
  district: z.string().min(1, 'District is required'),
  state: z.string().min(1, 'State is required'),
  pinCode: z.string().min(5, 'Pin code is required'),
  isOrganicCertified: z.boolean().default(false),
});

export async function createListing(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user || req.user.role !== USER_ROLES.FARMER) {
      res.status(403).json({ success: false, message: 'Only registered farmers can create crop listings' });
      return;
    }

    const data = createListingSchema.parse(req.body);

    const farmerProfile = await FarmerProfile.findOne({ userId: req.user._id });
    if (!farmerProfile) {
      res.status(400).json({ success: false, message: 'Farmer profile not found. Please complete profile first.' });
      return;
    }

    const newListing = await CropListing.create({
      farmerId: req.user._id,
      farmerProfileId: farmerProfile._id,
      cropName: data.cropName,
      variety: data.variety,
      category: data.category,
      description: data.description,
      images: data.images.length > 0 ? data.images : [
        'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=800&q=80'
      ],
      qualityGrade: data.qualityGrade,
      pricePerUnitPaise: data.pricePerUnitPaise,
      unit: data.unit,
      availableQuantity: data.availableQuantity,
      reservedQuantity: 0,
      minOrderQuantity: data.minOrderQuantity,
      harvestDate: new Date(data.harvestDate),
      expectedShelfLifeDays: data.expectedShelfLifeDays,
      location: {
        village: data.village,
        district: data.district,
        state: data.state,
        pinCode: data.pinCode,
      },
      isOrganicCertified: data.isOrganicCertified,
      status: 'active',
    });

    // Notify marketplace in real-time
    RealtimeNotifier.emitInventoryUpdate({
      listingId: newListing._id.toString(),
      availableQuantity: newListing.availableQuantity,
      status: newListing.status,
    });

    res.status(201).json({
      success: true,
      message: 'Crop listing published to marketplace successfully',
      listing: newListing,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function getListings(req: Request, res: Response): Promise<void> {
  try {
    const filters = z.object({
      search: z.string().trim().max(100).optional(),
      category: z.string().max(40).optional(),
      grade: z.enum(['A+', 'A', 'B+', 'B', 'All']).optional(),
      state: z.string().trim().max(80).optional(),
      district: z.string().trim().max(80).optional(),
      organic: z.enum(['true', 'false']).optional(),
      minPrice: z.coerce.number().int().min(0).optional(),
      maxPrice: z.coerce.number().int().min(0).optional(),
      sortBy: z.enum(['createdAt', 'price_asc', 'price_desc', 'quantity_desc']).default('createdAt'),
      order: z.enum(['asc', 'desc']).default('desc'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).strict().parse(req.query);
    const { search, category, grade, state, district, organic, minPrice, maxPrice, sortBy, order, page, limit } = filters;

    const query: any = { status: 'active', availableQuantity: { $gt: 0 } };

    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { cropName: { $regex: safeSearch, $options: 'i' } },
        { variety: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    if (category && typeof category === 'string' && category !== 'All') {
      query.category = category;
    }

    if (grade && typeof grade === 'string' && grade !== 'All') {
      query.qualityGrade = grade;
    }

    if (organic === 'true') {
      query.isOrganicCertified = true;
    }

    if (state && typeof state === 'string') {
      query['location.state'] = { $regex: state, $options: 'i' };
    }

    if (district && typeof district === 'string') {
      query['location.district'] = { $regex: district, $options: 'i' };
    }

    if (minPrice || maxPrice) {
      query.pricePerUnitPaise = {};
      if (minPrice) query.pricePerUnitPaise.$gte = Number(minPrice);
      if (maxPrice) query.pricePerUnitPaise.$lte = Number(maxPrice);
    }

    const pageNum = page;
    const limitNum = limit;
    const skip = (pageNum - 1) * limitNum;

    const sortOptions: any = {};
    if (sortBy === 'price_asc') sortOptions.pricePerUnitPaise = 1;
    else if (sortBy === 'price_desc') sortOptions.pricePerUnitPaise = -1;
    else if (sortBy === 'quantity_desc') sortOptions.availableQuantity = -1;
    else sortOptions.createdAt = order === 'asc' ? 1 : -1;

    const [listings, total] = await Promise.all([
      CropListing.find(query)
        .populate('farmerId', 'name phone isVerified')
        .populate('farmerProfileId', 'farmName fpoAffiliation rating location')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      CropListing.countDocuments(query),
    ]);

    res.json({
      success: true,
      listings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getListingById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const listing = await CropListing.findById(id)
      .populate('farmerId', 'name isVerified')
      .populate('farmerProfileId', 'farmName fpoAffiliation location');

    if (!listing) {
      res.status(404).json({ success: false, message: 'Crop listing not found' });
      return;
    }

    // Increment view count
    listing.viewsCount += 1;
    await listing.save();

    res.json({ success: true, listing });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getFarmerListings(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const listings = await CropListing.find({ farmerId: req.user._id }).sort({ createdAt: -1 });

    res.json({ success: true, listings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateListing(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const listing = await CropListing.findById(id);

    if (!listing) {
      res.status(404).json({ success: false, message: 'Listing not found' });
      return;
    }

    // Authorization: only the owner farmer or an admin can update
    const isOwner = listing.farmerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === USER_ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: 'Not authorized to modify this listing' });
      return;
    }

    const {
      cropName,
      variety,
      category,
      description,
      pricePerUnitPaise,
      availableQuantity,
      qualityGrade,
      status,
      minOrderQuantity,
      harvestDate,
    } = req.body;

    if (cropName !== undefined) listing.cropName = cropName;
    if (variety !== undefined) listing.variety = variety;
    if (category !== undefined) listing.category = category;
    if (description !== undefined) listing.description = description;
    if (pricePerUnitPaise !== undefined) listing.pricePerUnitPaise = Number(pricePerUnitPaise);
    if (availableQuantity !== undefined) listing.availableQuantity = Number(availableQuantity);
    if (qualityGrade !== undefined) listing.qualityGrade = qualityGrade;
    if (status !== undefined) listing.status = status;
    if (minOrderQuantity !== undefined) listing.minOrderQuantity = Number(minOrderQuantity);
    if (harvestDate !== undefined) listing.harvestDate = new Date(harvestDate);

    await listing.save();

    RealtimeNotifier.emitInventoryUpdate({
      listingId: listing._id.toString(),
      availableQuantity: listing.availableQuantity,
      status: listing.status,
    });

    res.json({ success: true, message: 'Listing updated successfully', listing });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function deleteListing(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const listing = await CropListing.findById(id);

    if (!listing) {
      res.status(404).json({ success: false, message: 'Listing not found' });
      return;
    }

    const isOwner = listing.farmerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === USER_ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }

    listing.status = 'archived';
    await listing.save();

    RealtimeNotifier.emitInventoryUpdate({
      listingId: listing._id.toString(),
      availableQuantity: 0,
      status: 'archived',
    });

    res.json({ success: true, message: 'Listing archived successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}
