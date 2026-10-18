import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFarmerProfile extends Document {
  userId: Types.ObjectId;
  farmName: string;
  fpoAffiliation?: string;
  landSizeAcres?: number;
  primaryCrops: string[];
  farmingPractice: 'organic' | 'natural' | 'conventional' | 'hydroponic';
  location: {
    village: string;
    mandalOrTehsil?: string;
    district: string;
    state: string;
    pinCode: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  kycDetails: {
    aadhaarOrIdLast4?: string;
    landRecordId?: string;
    verificationStatus: 'pending' | 'verified' | 'rejected';
    verifiedAt?: Date;
    verifiedBy?: Types.ObjectId;
  };
  bankDetails: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    upiId?: string;
  };
  rating: number;
  totalOrdersFulfilled: number;
  totalRevenuePaise: number;
  createdAt: Date;
  updatedAt: Date;
}

const FarmerProfileSchema = new Schema<IFarmerProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    farmName: { type: String, required: true },
    fpoAffiliation: { type: String },
    landSizeAcres: { type: Number },
    primaryCrops: [{ type: String }],
    farmingPractice: {
      type: String,
      enum: ['organic', 'natural', 'conventional', 'hydroponic'],
      default: 'natural',
    },
    location: {
      village: { type: String, required: true },
      mandalOrTehsil: { type: String },
      district: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: { type: String, required: true },
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    kycDetails: {
      aadhaarOrIdLast4: String,
      landRecordId: String,
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
      },
      verifiedAt: Date,
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    bankDetails: {
      accountHolderName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      bankName: { type: String, default: '' },
      upiId: { type: String, default: '' },
    },
    rating: { type: Number, default: 4.8 },
    totalOrdersFulfilled: { type: Number, default: 0 },
    totalRevenuePaise: { type: Number, default: 0 },
  },
  { timestamps: true }
);

FarmerProfileSchema.index({ 'location.district': 1, 'location.state': 1 });

export const FarmerProfile = mongoose.model<IFarmerProfile>('FarmerProfile', FarmerProfileSchema);
