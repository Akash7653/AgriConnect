import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRefund extends Document {
  orderId: Types.ObjectId;
  orderNumber: string;
  paymentId: string;
  providerRefundId?: string;
  amountPaise: number;
  currency: 'INR';
  status: 'pending' | 'processed' | 'failed';
  reason: string;
  idempotencyKey: string;
  requestedBy: Types.ObjectId;
  providerStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RefundSchema = new Schema<IRefund>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNumber: { type: String, required: true },
    paymentId: { type: String, required: true, index: true },
    providerRefundId: { type: String, unique: true, sparse: true },
    amountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ['INR'], required: true, default: 'INR' },
    status: { type: String, enum: ['pending', 'processed', 'failed'], required: true },
    reason: { type: String, required: true, maxlength: 500 },
    idempotencyKey: { type: String, required: true, unique: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    providerStatus: String,
  },
  { timestamps: true }
);

RefundSchema.index({ orderId: 1, createdAt: -1 });
RefundSchema.index(
  { orderId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

export const Refund = mongoose.model<IRefund>('Refund', RefundSchema);
