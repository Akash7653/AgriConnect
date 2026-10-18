import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixCropMinOrderQuantities() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MONGODB_URI found');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to Atlas DB');

  const db = mongoose.connection.db;
  if (!db) {
    console.error('No database object');
    process.exit(1);
  }

  const result = await db.collection('croplistings').updateMany(
    {},
    { $set: { minOrderQuantity: 1 } }
  );

  console.log(`Updated ${result.modifiedCount} crop listings to minOrderQuantity: 1`);
  await mongoose.disconnect();
  console.log('Done!');
}

fixCropMinOrderQuantities().catch(console.error);
