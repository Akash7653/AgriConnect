import mongoose, { Document, Schema, Types } from 'mongoose';
import { ORDER_STATUSES, OrderStatus } from '../config/constants.js';

export interface IOrderItem {
  listingId: Types.ObjectId;
  cropName: string;
  variety?: string;
  unit: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  farmerId: Types.ObjectId;
  farmerName: string;
  farmLocation: string;
  qualityGrade: string;
}

export interface IOrderStatusHistory {
  status: OrderStatus;
  note?: string;
  timestamp: Date;
  updatedBy?: Types.ObjectId;
  role?: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  buyerId: Types.ObjectId;
  buyerName: string;
  buyerRole: string;
  buyerPhone: string;
  items: IOrderItem[];
  pricing: {
    grossProductValuePaise: number; // Sum of items
    farmerPayoutPaise: number; // Configured share (e.g. 90%)
    platformCommissionPaise: number; // Configured share (e.g. 8%)
    operationsReservePaise: number; // Configured share (e.g. 2%)
    deliveryFeePaise: number;
    finalPayablePaise: number; // gross + deliveryFee
  };
  deliveryAddress: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    district: string;
    state: string;
    pinCode: string;
  };
  deliverySlot: {
    date: string;
    timeWindow: string; // e.g., "07:00 AM - 11:00 AM" or "02:00 PM - 06:00 PM"
  };
  status: OrderStatus;
  statusHistory: IOrderStatusHistory[];
  payment: {
    status: 'pending' | 'captured' | 'failed' | 'refunded';
    gateway: 'razorpay_standard' | 'razorpay_sandbox' | 'upi_instant' | 'cod_verified';
    transactionId?: string;
    paymentOrderId?: string;
    paidAt?: Date;
    expiresAt?: Date;
    receiptUrl?: string;
  };
  logistics: {
    assignedPartnerId?: Types.ObjectId;
    partnerName?: string;
    partnerPhone?: string;
    pickupTime?: Date;
    dispatchedTime?: Date;
    deliveredTime?: Date;
    proofOfDelivery?: {
      otpVerified?: boolean;
      recipientSignature?: string;
      notes?: string;
      photoUrl?: string;
    };
  };
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyerName: { type: String, required: true },
    buyerRole: { type: String, required: true },
    buyerPhone: { type: String, required: true },
    items: [
      {
        listingId: { type: Schema.Types.ObjectId, ref: 'CropListing', required: true },
        cropName: { type: String, required: true },
        variety: String,
        unit: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPricePaise: { type: Number, required: true },
        totalPaise: { type: Number, required: true },
        farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        farmerName: { type: String, required: true },
        farmLocation: { type: String, required: true },
        qualityGrade: { type: String, default: 'A' },
      },
    ],
    pricing: {
      grossProductValuePaise: { type: Number, required: true },
      farmerPayoutPaise: { type: Number, required: true },
      platformCommissionPaise: { type: Number, required: true },
      operationsReservePaise: { type: Number, required: true },
      deliveryFeePaise: { type: Number, default: 0 },
      finalPayablePaise: { type: Number, required: true },
    },
    deliveryAddress: {
      recipientName: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: String,
      city: { type: String, required: true },
      district: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: { type: String, required: true },
    },
    deliverySlot: {
      date: { type: String, required: true },
      timeWindow: { type: String, default: '07:00 AM - 11:00 AM' },
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUSES),
      default: ORDER_STATUSES.PENDING_PAYMENT,
      index: true,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        note: String,
        timestamp: { type: Date, default: Date.now },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        role: String,
      },
    ],
    payment: {
      status: {
        type: String,
        enum: ['pending', 'captured', 'failed', 'refunded'],
        default: 'pending',
      },
      gateway: {
        type: String,
        enum: ['razorpay_standard', 'razorpay_sandbox', 'upi_instant', 'cod_verified'],
        default: 'razorpay_standard',
      },
      transactionId: String,
      paymentOrderId: String,
      paidAt: Date,
      expiresAt: Date,
      receiptUrl: String,
    },
    logistics: {
      assignedPartnerId: { type: Schema.Types.ObjectId, ref: 'User' },
      partnerName: String,
      partnerPhone: String,
      pickupTime: Date,
      dispatchedTime: Date,
      deliveredTime: Date,
      proofOfDelivery: {
        otpVerified: Boolean,
        recipientSignature: String,
        notes: String,
        photoUrl: String,
      },
    },
    idempotencyKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

OrderSchema.index({ 'items.farmerId': 1 });
OrderSchema.index({ 'logistics.assignedPartnerId': 1 });
OrderSchema.index({ createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
