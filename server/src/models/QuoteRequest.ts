import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IQuoteResponse {
  farmerId: Types.ObjectId;
  farmerName: string;
  farmLocation: string;
  offeredPricePerUnitPaise: number;
  availableQuantity: number;
  deliveryLeadDays: number;
  notes?: string;
  createdAt: Date;
}

export interface IQuoteRequest extends Document {
  buyerId: Types.ObjectId;
  buyerName: string;
  buyerBusiness: string;
  cropName: string;
  category: string;
  requiredQuantity: number;
  unit: string;
  targetPricePerUnitPaise?: number;
  frequency: 'one-time' | 'weekly' | 'bi-weekly' | 'monthly';
  requiredByDate: Date;
  deliveryLocation: {
    address: string;
    city: string;
    district: string;
    state: string;
    pinCode: string;
  };
  notes?: string;
  status: 'open' | 'quotes_received' | 'accepted' | 'fulfilled' | 'closed';
  responses: IQuoteResponse[];
  selectedQuoteFarmerId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuoteRequestSchema = new Schema<IQuoteRequest>(
  {
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyerName: { type: String, required: true },
    buyerBusiness: { type: String, required: true },
    cropName: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    requiredQuantity: { type: Number, required: true, min: 10 },
    unit: { type: String, default: 'kg' },
    targetPricePerUnitPaise: Number,
    frequency: {
      type: String,
      enum: ['one-time', 'weekly', 'bi-weekly', 'monthly'],
      default: 'one-time',
    },
    requiredByDate: { type: Date, required: true },
    deliveryLocation: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      district: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: { type: String, required: true },
    },
    notes: String,
    status: {
      type: String,
      enum: ['open', 'quotes_received', 'accepted', 'fulfilled', 'closed'],
      default: 'open',
      index: true,
    },
    responses: [
      {
        farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        farmerName: { type: String, required: true },
        farmLocation: { type: String, required: true },
        offeredPricePerUnitPaise: { type: Number, required: true },
        availableQuantity: { type: Number, required: true },
        deliveryLeadDays: { type: Number, default: 2 },
        notes: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    selectedQuoteFarmerId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const QuoteRequest = mongoose.model<IQuoteRequest>('QuoteRequest', QuoteRequestSchema);
