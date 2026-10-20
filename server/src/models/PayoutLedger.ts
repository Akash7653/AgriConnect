import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPayoutLedger extends Document {
  orderId: Types.ObjectId;
  entryType: 'sale' | 'refund_adjustment';
  idempotencyKey?: string;
  relatedEntryId?: Types.ObjectId;
  orderNumber: string;
  farmerId: Types.ObjectId;
  farmerName: string;
  grossProductValuePaise: number;
  farmerSharePct: number; // e.g. 90
  farmerPayoutPaise: number; // e.g. 90%
  platformCommissionPaise: number; // e.g. 8%
  operationsReservePaise: number; // e.g. 2%
  settlementStatus: 'accrued' | 'processing' | 'settled' | 'on_hold' | 'cancelled';
  automaticPayoutEligibleAt?: Date;
  automaticPayoutLeaseUntil?: Date;
  razorpayTransferId?: string;
  bankAccountLast4?: string;
  upiId?: string;
  transactionReference?: string;
  settledAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutLedgerSchema = new Schema<IPayoutLedger>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    entryType: { type: String, enum: ['sale', 'refund_adjustment'], default: 'sale', required: true },
    idempotencyKey: { type: String },
    relatedEntryId: { type: Schema.Types.ObjectId, ref: 'PayoutLedger' },
    orderNumber: { type: String, required: true },
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmerName: { type: String, required: true },
    grossProductValuePaise: { type: Number, required: true },
    farmerSharePct: { type: Number, default: 90 },
    farmerPayoutPaise: { type: Number, required: true },
    platformCommissionPaise: { type: Number, required: true },
    operationsReservePaise: { type: Number, required: true },
    settlementStatus: {
      type: String,
      enum: ['accrued', 'processing', 'settled', 'on_hold', 'cancelled'],
      default: 'accrued',
      index: true,
    },
    automaticPayoutEligibleAt: Date,
    automaticPayoutLeaseUntil: Date,
    razorpayTransferId: { type: String, sparse: true, unique: true },
    bankAccountLast4: String,
    upiId: String,
    transactionReference: String,
    settledAt: Date,
    notes: String,
  },
  { timestamps: true }
);

PayoutLedgerSchema.index({ farmerId: 1, settlementStatus: 1 });
PayoutLedgerSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export const PayoutLedger = mongoose.model<IPayoutLedger>('PayoutLedger', PayoutLedgerSchema);
