import mongoose, { Document, Schema, Types } from 'mongoose';
import { CROP_CATEGORIES, QUALITY_GRADES } from '../config/constants.js';

export interface ICropListing extends Document {
  farmerId: Types.ObjectId; // References User
  farmerProfileId: Types.ObjectId;
  cropName: string;
  variety?: string;
  category: (typeof CROP_CATEGORIES)[number];
  description: string;
  images: string[];
  imageAssets: Array<{
    url: string;
    publicId: string;
    contentType: string;
    bytes: number;
    uploadedAt: Date;
  }>;
  qualityGrade: (typeof QUALITY_GRADES)[number];
  pricePerUnitPaise: number; // Stored in integer paise (e.g. ₹40.00 = 4000)
  unit: 'kg' | 'quintal' | 'box' | 'bunch' | 'crate';
  availableQuantity: number; // Concurrency-safe source of truth
  reservedQuantity: number;
  minOrderQuantity: number;
  harvestDate: Date;
  expectedShelfLifeDays: number;
  location: {
    village: string;
    district: string;
    state: string;
    pinCode: string;
  };
  isOrganicCertified: boolean;
  status: 'active' | 'sold_out' | 'paused' | 'archived' | 'pending_moderation';
  moderationNotes?: string;
  viewsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CropListingSchema = new Schema<ICropListing>(
  {
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmerProfileId: { type: Schema.Types.ObjectId, ref: 'FarmerProfile', required: true },
    cropName: { type: String, required: true, trim: true },
    variety: { type: String, trim: true },
    category: {
      type: String,
      enum: CROP_CATEGORIES,
      required: true,
      index: true,
    },
    description: { type: String, required: true },
    images: [{ type: String }],
    imageAssets: [{
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      contentType: { type: String, required: true },
      bytes: { type: Number, required: true },
      uploadedAt: { type: Date, default: Date.now },
    }],
    qualityGrade: {
      type: String,
      enum: QUALITY_GRADES,
      default: 'A',
    },
    pricePerUnitPaise: { type: Number, required: true, min: 100 }, // Min ₹1.00
    unit: {
      type: String,
      enum: ['kg', 'quintal', 'box', 'bunch', 'crate'],
      default: 'kg',
    },
    availableQuantity: { type: Number, required: true, min: 0 },
    reservedQuantity: { type: Number, default: 0, min: 0 },
    minOrderQuantity: { type: Number, default: 1, min: 1 },
    harvestDate: { type: Date, required: true },
    expectedShelfLifeDays: { type: Number, default: 5 },
    location: {
      village: { type: String, required: true },
      district: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: { type: String, required: true },
    },
    isOrganicCertified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'sold_out', 'paused', 'archived', 'pending_moderation'],
      default: 'active',
      index: true,
    },
    moderationNotes: String,
    viewsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Search indexes
CropListingSchema.index({ cropName: 'text', description: 'text', variety: 'text' });
CropListingSchema.index({ 'location.state': 1, 'location.district': 1 });
CropListingSchema.index({ pricePerUnitPaise: 1 });
CropListingSchema.index({ availableQuantity: 1, status: 1 });

export const CropListing = mongoose.model<ICropListing>('CropListing', CropListingSchema);
