import mongoose, { Document, Schema } from 'mongoose';
import { USER_ROLES, UserRole } from '../config/constants.js';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone: string;
  language: 'en' | 'te' | 'hi';
  isVerified: boolean;
  status: 'active' | 'suspended' | 'pending_verification';
  avatarUrl?: string;
  address?: {
    street?: string;
    villageOrCity?: string;
    district?: string;
    state?: string;
    pinCode?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
      default: USER_ROLES.BUYER,
    },
    phone: { type: String, required: true, trim: true },
    language: { type: String, enum: ['en', 'te', 'hi'], default: 'en' },
    isVerified: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'suspended', 'pending_verification'],
      default: 'active',
    },
    avatarUrl: { type: String },
    address: {
      street: String,
      villageOrCity: String,
      district: String,
      state: String,
      pinCode: String,
    },
  },
  { timestamps: true }
);

// Indexes
UserSchema.index({ role: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
