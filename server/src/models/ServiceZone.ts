import mongoose, { Document, Schema } from 'mongoose';

export interface IServiceZone extends Document {
  name: string;
  city: string;
  state: string;
  postalCodes: string[];
  active: boolean;
  deliveryFeePaise?: number;
  freeDeliveryThresholdPaise?: number;
  fulfilmentMethods: Array<'supplier_delivery' | 'third_party_delivery' | 'customer_pickup' | 'platform_hub'>;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceZoneSchema = new Schema<IServiceZone>(
  {
    name: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true, index: true },
    state: { type: String, required: true, trim: true },
    postalCodes: [{ type: String, trim: true, index: true }],
    active: { type: Boolean, default: true, index: true },
    deliveryFeePaise: { type: Number, min: 0 },
    freeDeliveryThresholdPaise: { type: Number, min: 0 },
    fulfilmentMethods: {
      type: [String],
      enum: ['supplier_delivery', 'third_party_delivery', 'customer_pickup', 'platform_hub'],
      default: ['supplier_delivery'],
    },
  },
  { timestamps: true }
);

ServiceZoneSchema.index({ active: 1, city: 1, state: 1 });
ServiceZoneSchema.index({ active: 1, postalCodes: 1 });

export const ServiceZone = mongoose.model<IServiceZone>('ServiceZone', ServiceZoneSchema);
