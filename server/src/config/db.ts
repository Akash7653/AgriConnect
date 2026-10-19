import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryServer: MongoMemoryServer | null = null;

export async function connectDB(): Promise<string> {
  const customUri = process.env.MONGODB_URI;

  // If a URI is provided, attempt to connect to MongoDB Atlas
  if (customUri) {
    try {
      console.log('Connecting to provided MONGODB_URI (MongoDB Atlas)...');
      await mongoose.connect(customUri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log('✅ Connected to MongoDB Atlas successfully.');
      return customUri;
    } catch (err: any) {
      console.error('❌ Failed to connect to MongoDB Atlas:', err.message);
      // Fall back to in‑memory DB for development after a failed Atlas connection
    }
  }

  // No URI set or Atlas connection failed – use in‑memory MongoDB (useful for local dev/testing)
  console.log('⚡ Starting in‑memory MongoDB instance for development');
  mongoMemoryServer = await MongoMemoryServer.create();
  const uri = mongoMemoryServer.getUri();
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log('✅ Connected to in‑memory MongoDB.');
  return uri;












}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
}
