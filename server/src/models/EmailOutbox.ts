import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IEmailOutbox extends Document {
  eventKey: string;
  type: 'order_confirmation' | 'order_update';
  orderId: Types.ObjectId;
  eventMessage?: string;
  status: 'queued' | 'sending' | 'sent' | 'dead';
  attempts: number;
  nextAttemptAt: Date;
  leaseUntil?: Date;
  providerId?: string;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmailOutboxSchema = new Schema<IEmailOutbox>(
  {
    eventKey: { type: String, required: true, unique: true },
    type: { type: String, enum: ['order_confirmation', 'order_update'], required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    eventMessage: { type: String, maxlength: 500 },
    status: { type: String, enum: ['queued', 'sending', 'sent', 'dead'], default: 'queued', index: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    leaseUntil: Date,
    providerId: String,
    lastError: String,
  },
  { timestamps: true }
);

EmailOutboxSchema.index({ status: 1, nextAttemptAt: 1 });

export const EmailOutbox = mongoose.model<IEmailOutbox>('EmailOutbox', EmailOutboxSchema);
