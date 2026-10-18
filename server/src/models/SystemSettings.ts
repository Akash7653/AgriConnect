import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemSettings extends Document {
  key: string;
  farmerSharePct: number;
  platformCommissionPct: number;
  opsReservePct: number;
  defaultDeliveryFeePaise: number;
  freeDeliveryThresholdPaise: number;
  enableAiAssistant: boolean;
  activeWeatherApiProvider: string;
  paymentGatewayMode: 'sandbox' | 'live';
  updatedAt: Date;
}

const SystemSettingsSchema = new Schema<ISystemSettings>(
  {
    key: { type: String, required: true, unique: true, default: 'global_config' },
    farmerSharePct: { type: Number, default: 90, min: 50, max: 99 },
    platformCommissionPct: { type: Number, default: 8, min: 1, max: 40 },
    opsReservePct: { type: Number, default: 2, min: 0, max: 10 },
    defaultDeliveryFeePaise: { type: Number, default: 4000 }, // ₹40
    freeDeliveryThresholdPaise: { type: Number, default: 50000 }, // ₹500
    enableAiAssistant: { type: Boolean, default: true },
    activeWeatherApiProvider: { type: String, default: 'OpenMeteo_IndiaAgri' },
    paymentGatewayMode: { type: String, enum: ['sandbox', 'live'], default: 'sandbox' },
  },
  { timestamps: true }
);

export const SystemSettings = mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);
