import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { BuyerProfile } from '../models/BuyerProfile.js';
import { CropListing } from '../models/CropListing.js';
import { Order } from '../models/Order.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { QuoteRequest } from '../models/QuoteRequest.js';
import { Dispute } from '../models/Dispute.js';
import { Notification } from '../models/Notification.js';
import { AuditLog } from '../models/AuditLog.js';
import { SystemSettings } from '../models/SystemSettings.js';
import { WebhookEvent } from '../models/WebhookEvent.js';
import { Cart } from '../models/Cart.js';

dotenv.config();

async function initCollections() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing from environment');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB Atlas at: ${uri.replace(/:[^:]*@/, ':****@')}`);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log('✅ Successfully connected to MongoDB Atlas Cluster!');

    const models = [
      { name: 'User', model: User },
      { name: 'FarmerProfile', model: FarmerProfile },
      { name: 'BuyerProfile', model: BuyerProfile },
      { name: 'CropListing', model: CropListing },
      { name: 'Order', model: Order },
      { name: 'PayoutLedger', model: PayoutLedger },
      { name: 'QuoteRequest', model: QuoteRequest },
      { name: 'Dispute', model: Dispute },
      { name: 'Notification', model: Notification },
      { name: 'AuditLog', model: AuditLog },
      { name: 'SystemSettings', model: SystemSettings },
      { name: 'WebhookEvent', model: WebhookEvent },
      { name: 'Cart', model: Cart },
    ];

    console.log('\nInitializing database tables/collections and indexes...');
    for (const item of models) {
      await item.model.createCollection();
      await item.model.syncIndexes();
      console.log(`📁 Collection verified/created: ${item.model.collection.name}`);
    }

    // Initialize System Settings default configuration in MongoDB Atlas
    await SystemSettings.findOneAndUpdate(
      { key: 'global_config' },
      {
        farmerSharePct: 90,
        platformCommissionPct: 8,
        opsReservePct: 2,
        defaultDeliveryFeePaise: 4000,
        freeDeliveryThresholdPaise: 50000,
        enableAiAssistant: true,
        paymentGatewayMode: 'sandbox',
      },
      { upsert: true, new: true }
    );
    console.log('⚙️ Default SystemSettings verified in Atlas database.');

    const collections = await mongoose.connection.db?.listCollections().toArray();
    console.log('\n======================================================');
    console.log('🎉 All MongoDB Atlas Collections successfully initialized:');
    collections?.forEach((c) => console.log(`   - ${c.name}`));
    console.log('======================================================\n');
  } catch (err: any) {
    console.error('Atlas connection/initialization error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed cleanly.');
  }
}

initCollections();
