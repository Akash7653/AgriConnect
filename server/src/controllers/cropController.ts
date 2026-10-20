import { Request, Response } from 'express';
import { z } from 'zod';
import { CropListing } from '../models/CropListing.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { AuthRequest } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';
import { RealtimeNotifier } from '../socket/index.js';
import { User } from '../models/User.js';
import { SEEDED_DEMO_ACCOUNT_EMAILS } from '../config/demoAccounts.js';
import { deleteProductImage, uploadProductImage } from '../services/imageStorage.js';

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

const listingUpdateSchema = z.object({
  cropName: z.string().min(2).optional(),
  variety: z.string().optional(),
  category: z.enum(['Vegetables', 'Fruits', 'Grains & Cereals', 'Pulses', 'Spices', 'Greens & Herbs', 'Organic Special']).optional(),
  description: z.string().min(10).optional(),
  pricePerUnitPaise: z.coerce.number().min(100).optional(),
  availableQuantity: z.coerce.number().min(0).optional(),
  qualityGrade: z.enum(['A+', 'A', 'B+', 'B']).optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
  minOrderQuantity: z.coerce.number().min(1).optional(),
  harvestDate: z.string().refine((date) => !Number.isNaN(Date.parse(date))).optional(),
  village: z.string().min(1).optional(),
  district: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  pinCode: z.string().min(5).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'Provide at least one field to update.');

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
      images: data.images,
      imageAssets: [],
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
    RealtimeNotifier.emitAdminMetricsRefresh({ type: 'listing_created' });

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
      const priceRange: { $gte?: number; $lte?: number } = {};
      if (minPrice !== undefined) priceRange.$gte = minPrice;
      if (maxPrice !== undefined) priceRange.$lte = maxPrice;
      query.pricePerUnitPaise = priceRange;
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
    const listing = await CropListing.findOne({
      _id: id,
      status: 'active',
      availableQuantity: { $gt: 0 },
    })
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

    const data = listingUpdateSchema.parse(req.body);

    if (data.cropName !== undefined) listing.cropName = data.cropName;
    if (data.variety !== undefined) listing.variety = data.variety;
    if (data.category !== undefined) listing.category = data.category;
    if (data.description !== undefined) listing.description = data.description;
    if (data.pricePerUnitPaise !== undefined) listing.pricePerUnitPaise = data.pricePerUnitPaise;
    if (data.availableQuantity !== undefined) {
      const quantity = data.availableQuantity;
      if (!Number.isFinite(quantity) || quantity < 0) {
        res.status(400).json({
          success: false,
          message: 'Available stock must be a valid quantity of zero or more.',
        });
        return;
      }
      listing.availableQuantity = quantity;
      if (listing.status === 'active' || listing.status === 'sold_out') {
        listing.status = quantity === 0 ? 'sold_out' : 'active';
      }
    }
    if (data.qualityGrade !== undefined) listing.qualityGrade = data.qualityGrade;
    if (data.status !== undefined) listing.status = data.status;
    if (data.minOrderQuantity !== undefined) listing.minOrderQuantity = data.minOrderQuantity;
    if (data.harvestDate !== undefined) listing.harvestDate = new Date(data.harvestDate);
    if (data.village !== undefined) listing.location.village = data.village;
    if (data.district !== undefined) listing.location.district = data.district;
    if (data.state !== undefined) listing.location.state = data.state;
    if (data.pinCode !== undefined) listing.location.pinCode = data.pinCode;

    await listing.save();

    RealtimeNotifier.emitInventoryUpdate({
      listingId: listing._id.toString(),
      availableQuantity: listing.availableQuantity,
      status: listing.status,
    });
    RealtimeNotifier.emitAdminMetricsRefresh({ type: 'listing_updated' });

    res.json({ success: true, message: 'Listing updated successfully', listing });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

const acceptedImageTypes: Record<string, Buffer> = {
  'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]),
  'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

function validateUploadedImage(buffer: Buffer, contentType: string): boolean {
  if (contentType === 'image/webp') {
    return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  const signature = acceptedImageTypes[contentType];
  return Boolean(signature && buffer.subarray(0, signature.length).equals(signature));
}

export async function uploadListingImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== USER_ROLES.FARMER) {
        res.status(403).json({ success: false, message: 'Only the owning farmer can upload product images.' });
        return;
      }
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Choose a JPEG, PNG, or WebP product image under 5 MB.' });
        return;
      }
      if (!validateUploadedImage(req.file.buffer, req.file.mimetype)) {
        res.status(415).json({ success: false, message: 'The selected file is not a valid JPEG, PNG, or WebP image.' });
        return;
      }

      const listing = await CropListing.findOne({ _id: req.params.id, farmerId: req.user._id });
      if (!listing || listing.status === 'archived') {
        res.status(404).json({ success: false, message: 'Active product listing was not found for this farmer.' });
        return;
      }

      const image = await uploadProductImage(req.file.buffer, req.file.mimetype, req.user._id.toString(), listing._id.toString());
      listing.imageAssets.push(image);
      listing.images.push(image.url);
      await listing.save();
      RealtimeNotifier.emitInventoryUpdate({
        listingId: listing._id.toString(),
        availableQuantity: listing.availableQuantity,
        status: listing.status,
      });
      res.status(201).json({ success: true, image, listing });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image upload failed.';
      const notConfigured = message.includes('not configured');
      res.status(notConfigured ? 503 : 502).json({ success: false, message });
    }
  }

export async function removeListingImage(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== USER_ROLES.FARMER) {
        res.status(403).json({ success: false, message: 'Only the owning farmer can remove product images.' });
        return;
      }
      const { publicId } = z.object({ publicId: z.string().min(1).max(300) }).strict().parse(req.body);
      const listing = await CropListing.findOne({ _id: req.params.id, farmerId: req.user._id });
      if (!listing) {
        res.status(404).json({ success: false, message: 'Product listing not found for this farmer.' });
        return;
      }

      const image = listing.imageAssets.find((asset) => asset.publicId === publicId);
      if (!image) {
        res.status(404).json({ success: false, message: 'Uploaded product image was not found.' });
        return;
      }
      const references = await CropListing.countDocuments({ 'imageAssets.publicId': publicId });
      if (references === 1) await deleteProductImage(publicId);

      listing.imageAssets = listing.imageAssets.filter((asset) => asset.publicId !== publicId) as typeof listing.imageAssets;
      listing.images = listing.images.filter((url) => url !== image.url);
      await listing.save();
      res.json({ success: true, message: 'Product image removed.', listing });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image removal failed.';
      res.status(message.includes('not configured') ? 503 : 502).json({ success: false, message });
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
