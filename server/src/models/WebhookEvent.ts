import mongoose, { Document, Schema } from 'mongoose';

export interface IWebhookEvent extends Document {
  eventId: string;
  eventType: string;
  payload: any;
  status: 'processed' | 'failed' | 'ignored';
  createdAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true },
    payload: { type: Schema.Types.Mixed },
    status: { type: String, enum: ['processed', 'failed', 'ignored'], default: 'processed' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const WebhookEvent = mongoose.model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
