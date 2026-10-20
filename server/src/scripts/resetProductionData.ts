import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { USER_ROLES } from '../config/constants.js';

dotenv.config();

const KEEP_ADMIN_EMAIL = 'akash@admin.com';

async function resetProductionData(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  const expectedDatabaseName = process.env.DATA_RESET_DATABASE_NAME?.trim();
  const confirmation = process.env.DATA_RESET_CONFIRMATION;

  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Refusing to reset data unless NODE_ENV=production.');
  }
  if (!uri) {
    throw new Error('MONGODB_URI is required. No database was changed.');
  }
  if (!expectedDatabaseName) {
    throw new Error('Set DATA_RESET_DATABASE_NAME to the exact production database name.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error('Connected database handle is unavailable. No database was changed.');
  }

  const databaseName = database.databaseName;
  if (databaseName !== expectedDatabaseName) {
    throw new Error(`Connected database "${databaseName}" does not match the requested database name. No database was changed.`);
  }

  const admin = await User.findOne({
    email: KEEP_ADMIN_EMAIL,
    role: USER_ROLES.ADMIN,
  }).select('_id').lean();
  if (!admin) {
    throw new Error(`Verified admin account ${KEEP_ADMIN_EMAIL} was not found. No database was changed.`);
  }

  const collections = (await database.listCollections().toArray())
    .filter(({ name }) => !name.startsWith('system.'));
  const userCollectionName = User.collection.collectionName;
  const counts = await Promise.all(collections.map(async ({ name }) => {
    const collection = database.collection(name);
    const count = name === userCollectionName
      ? await collection.countDocuments({ _id: { $ne: admin._id } })
      : await collection.countDocuments();
    return { name, count };
  }));
  const totalRecordsToDelete = counts.reduce((total, collection) => total + collection.count, 0);

  console.log(`Production reset target: ${databaseName}`);
  console.log(`Admin account to retain: ${KEEP_ADMIN_EMAIL}`);
  console.log(`Non-admin records scheduled for deletion: ${totalRecordsToDelete}`);
  for (const collection of counts) {
    console.log(`- ${collection.name}: ${collection.count}`);
  }

  const expectedConfirmation = `DELETE_ALL_NON_ADMIN_DATA:${databaseName}:${KEEP_ADMIN_EMAIL}`;
  if (confirmation !== expectedConfirmation) {
    throw new Error(`Confirmation missing or incorrect. Set DATA_RESET_CONFIRMATION to the exact value: ${expectedConfirmation}. No database was changed.`);
  }

  for (const { name } of collections) {
    if (name === userCollectionName) {
      await User.deleteMany({ _id: { $ne: admin._id } });
    } else {
      await database.collection(name).deleteMany({});
    }
  }

  const remainingUsers = await User.find().select('email role').lean();
  const unexpectedUsers = remainingUsers.filter(
    (user) => user.email !== KEEP_ADMIN_EMAIL || user.role !== USER_ROLES.ADMIN
  );
  if (remainingUsers.length !== 1 || unexpectedUsers.length > 0) {
    throw new Error('Post-reset verification failed: user collection does not contain only the retained admin.');
  }

  const remainingRecords = await Promise.all(
    collections
      .filter(({ name }) => name !== userCollectionName)
      .map(({ name }) => database.collection(name).countDocuments())
  );
  if (remainingRecords.some((count) => count !== 0)) {
    throw new Error('Post-reset verification failed: one or more collections still contain records.');
  }

  console.log(`Production database reset complete. Retained ${KEEP_ADMIN_EMAIL}; removed ${totalRecordsToDelete} other records.`);
}

resetProductionData()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    console.error(`Production database reset failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
