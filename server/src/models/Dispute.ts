import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDispute extends Document {
  orderId: Types.ObjectId;
  orderNumber: string;
  raisedBy: Types.ObjectId;
  raisedByName: string;
  raisedByRole: string;
  reason: 'quality_issue' | 'shortage' | 'damaged_in_transit' | 'late_delivery' | 'pricing_dispute' | 'other';
  description: string;
  evidenceImages?: string[];
  status: 'open' | 'under_review' | 'resolved_refund' | 'resolved_rejected' | 'closed';
  resolutionNotes?: string;
  refundAmountPaise?: number;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DisputeSchema = new Schema<IDispute>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderNumber: { type: String, required: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    raisedByName: { type: String, required: true },
    raisedByRole: { type: String, required: true },
    reason: {
      type: String,
      enum: ['quality_issue', 'shortage', 'damaged_in_transit', 'late_delivery', 'pricing_dispute', 'other'],
      required: true,
    },
    description: { type: String, required: true },
    evidenceImages: [{ type: String }],
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved_refund', 'resolved_rejected', 'closed'],
      default: 'open',
      index: true,
    },
    resolutionNotes: String,
    refundAmountPaise: Number,
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },
  { timestamps: true }
);

export const Dispute = mongoose.model<IDispute>('Dispute', DisputeSchema);
