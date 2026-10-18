import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryServer: MongoMemoryServer | null = null;

export async function connectDB(): Promise<string> {
  const customUri = process.env.MONGODB_URI;

  if (customUri) {
    try {
      console.log('Connecting to provided MONGODB_URI (e.g. MongoDB Atlas)...');
      await mongoose.connect(customUri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log('Connected successfully to MongoDB Atlas / Remote Cluster.');
      return customUri;
    } catch (err: any) {
      console.warn('Could not connect to external MONGODB_URI:', err.message);
      console.log('Falling back to local high-performance in-memory MongoDB instance for development & testing...');
    }
  }

  // Fallback to MongoMemoryServer for instant local run without external dependencies
  try {
    mongoMemoryServer = await MongoMemoryServer.create();
    const uri = mongoMemoryServer.getUri();
    await mongoose.connect(uri);
    console.log(`Connected to in-memory MongoDB at ${uri} (Zero external setup required)`);
    return uri;
  } catch (err: any) {
    console.error('Fatal: Failed to start database connection:', err);
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
}
