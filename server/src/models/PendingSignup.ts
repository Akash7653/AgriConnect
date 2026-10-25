import mongoose, { Document, Schema } from 'mongoose';
import { Types } from 'mongoose';
import { USER_ROLES } from '../config/constants.js';

export interface IPendingSignup extends Document {
  email: string;
  name: string;
  passwordHash: string;
  phone?: string;
  otpHash?: string;
  otpExpiresAt?: Date;
  attempts: number;
  resendCount: number;
  resendWindowStartedAt?: Date;
  lastSentAt?: Date;
  role: Exclude<(typeof USER_ROLES)[keyof typeof USER_ROLES], 'admin'>;
  requestedRole?: Exclude<(typeof USER_ROLES)[keyof typeof USER_ROLES], 'admin'>;
  requestedFarm?: {
    farmName: string;
    village: string;
    district: string;
    state: string;
    pinCode: string;
  };
  language: 'en' | 'te' | 'hi';
  verificationClaimedAt?: Date;
  legacyUserId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PendingSignupSchema = new Schema<IPendingSignup>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, default: '', trim: true },
    otpHash: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    attempts: { type: Number, default: 0, min: 0, max: 5 },
    resendCount: { type: Number, default: 0, min: 0, max: 5 },
    resendWindowStartedAt: { type: Date, select: false },
    lastSentAt: { type: Date, select: false },
    role: {
      type: String,
      enum: [USER_ROLES.FARMER, USER_ROLES.BUYER, USER_ROLES.BUSINESS, USER_ROLES.LOGISTICS],
      default: USER_ROLES.BUYER,
      required: true,
    },
    requestedRole: {
      type: String,
      enum: [USER_ROLES.FARMER, USER_ROLES.BUSINESS, USER_ROLES.LOGISTICS],
    },
    requestedFarm: {
      farmName: { type: String, trim: true },
      village: { type: String, trim: true },
      district: { type: String, trim: true },
      state: { type: String, trim: true },
      pinCode: { type: String, trim: true },
    },
    language: { type: String, enum: ['en', 'te', 'hi'], default: 'en' },
    verificationClaimedAt: { type: Date, select: false },
    legacyUserId: { type: Schema.Types.ObjectId, ref: 'User', select: false },
  },
  { timestamps: true }
);

PendingSignupSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 60 });

export const PendingSignup = mongoose.model<IPendingSignup>('PendingSignup', PendingSignupSchema);
