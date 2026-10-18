import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBuyerProfile extends Document {
  userId: Types.ObjectId;
  buyerType: 'household' | 'restaurant' | 'hotel' | 'supermarket' | 'institution' | 'retailer';
  businessName?: string;
  gstNumber?: string;
  tradeLicense?: string;
  creditLimitPaise?: number;
  deliveryAddresses: Array<{
    _id?: Types.ObjectId;
    label: string; // 'Home', 'Main Kitchen', 'Warehouse', 'Store 1'
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    district: string;
    state: string;
    pinCode: string;
    isDefault: boolean;
  }>;
  savedProcurementLists: Array<{
    name: string;
    items: Array<{
      cropName: string;
      preferredQuantity: number;
      unit: string;
    }>;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const BuyerProfileSchema = new Schema<IBuyerProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    buyerType: {
      type: String,
      enum: ['household', 'restaurant', 'hotel', 'supermarket', 'institution', 'retailer'],
      default: 'household',
    },
    businessName: { type: String },
    gstNumber: { type: String },
    tradeLicense: { type: String },
    creditLimitPaise: { type: Number, default: 0 },
    deliveryAddresses: [
      {
        label: { type: String, default: 'Default' },
        recipientName: { type: String, required: true },
        phone: { type: String, required: true },
        addressLine1: { type: String, required: true },
        addressLine2: String,
        city: { type: String, required: true },
        district: { type: String, required: true },
        state: { type: String, required: true },
        pinCode: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
    savedProcurementLists: [
      {
        name: { type: String, required: true },
        items: [
          {
            cropName: { type: String, required: true },
            preferredQuantity: { type: Number, required: true },
            unit: { type: String, default: 'kg' },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

export const BuyerProfile = mongoose.model<IBuyerProfile>('BuyerProfile', BuyerProfileSchema);
