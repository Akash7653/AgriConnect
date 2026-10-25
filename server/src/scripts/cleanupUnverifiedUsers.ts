import mongoose, { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { CropListing } from '../models/CropListing.js';
import { BuyerProfile } from '../models/BuyerProfile.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { Cart } from '../models/Cart.js';
import { QuoteRequest } from '../models/QuoteRequest.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { Notification } from '../models/Notification.js';
import { Dispute } from '../models/Dispute.js';
import { AuditLog } from '../models/AuditLog.js';
import { PendingSignup } from '../models/PendingSignup.js';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasAddress(user: { address?: Record<string, unknown> }): boolean {
  return Object.values(user.address ?? {}).some((value) => typeof value === 'string' && value.trim().length > 0);
}

async function activityReasons(userId: Types.ObjectId, email: string, userAddress: boolean): Promise<string[]> {
  const checks: Array<[string, Promise<boolean>]> = [
    ['user address', Promise.resolve(userAddress)],
    ['buyer delivery address or saved list', BuyerProfile.exists({
      userId,
      $or: [
        { 'deliveryAddresses.0': { $exists: true } },
        { 'savedProcurementLists.0': { $exists: true } },
        { businessName: { $exists: true, $nin: ['', null] } },
        { gstNumber: { $exists: true, $nin: ['', null] } },
        { tradeLicense: { $exists: true, $nin: ['', null] } },
        { creditLimitPaise: { $gt: 0 } },
      ],
    }).then(Boolean)],
    ['farmer profile', FarmerProfile.exists({ userId }).then(Boolean)],
    ['order or fulfilment', Order.exists({
      $or: [
        { buyerId: userId },
        { 'items.farmerId': userId },
        { 'sellerFulfilments.farmerId': userId },
      ],
    }).then(Boolean)],
    ['crop listing', CropListing.exists({ farmerId: userId }).then(Boolean)],
    ['cart with items', Cart.exists({ userId, 'items.0': { $exists: true } }).then(Boolean)],
    ['quote request or response', QuoteRequest.exists({
      $or: [{ buyerId: userId }, { 'responses.farmerId': userId }],
    }).then(Boolean)],
    ['payout ledger', PayoutLedger.exists({ farmerId: userId }).then(Boolean)],
    ['notification', Notification.exists({ recipientId: userId }).then(Boolean)],
    ['dispute', Dispute.exists({ $or: [{ raisedBy: userId }, { resolvedBy: userId }] }).then(Boolean)],
    ['audit activity', AuditLog.exists({
      $or: [{ userId }, { resourceId: userId.toString() }, { 'details.email': email }],
    }).then(Boolean)],
    ['active pending signup', PendingSignup.exists({ legacyUserId: userId }).then(Boolean)],
  ];
  const results = await Promise.all(checks.map(async ([reason, query]) => [reason, await query] as const));
  return results.filter(([, hasActivity]) => hasActivity).map(([reason]) => reason);
}

async function run(): Promise<void> {
  if (!['development', 'test'].includes(process.env.NODE_ENV || '')) {
    throw new Error('Refusing to run unless NODE_ENV is explicitly development or test.');
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required. No database was changed.');
  const expectedDatabase = option('--database-name');
  if (!expectedDatabase) throw new Error('Pass --database-name with the exact non-production database name.');

  const apply = process.argv.includes('--apply');
  const confirmation = option('--confirm');
  if (apply && confirmation !== expectedDatabase) {
    throw new Error('Apply mode requires --confirm with the exact --database-name. No database was changed.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const database = mongoose.connection.db;
  if (!database || database.databaseName !== expectedDatabase) {
    throw new Error('Connected database does not match --database-name. No database was changed.');
  }

  const candidates = await User.find({ emailVerified: false })
    .select('_id name email role address')
    .lean();
  const eligible: Array<{ _id: Types.ObjectId; email: string; reasons: string[] }> = [];
  for (const user of candidates) {
    const reasons = await activityReasons(user._id, user.email, hasAddress(user));
    if (reasons.length === 0) eligible.push({ _id: user._id, email: user.email, reasons });
    else console.log(`SKIP ${user._id} ${user.email}: ${reasons.join(', ')}`);
  }

  console.log(`Database: ${database.databaseName}`);
  console.log(`Explicitly unverified users examined: ${candidates.length}`);
  console.log(`Eligible users with no recorded activity: ${eligible.length}`);
  for (const user of eligible) console.log(`ELIGIBLE ${user._id} ${user.email}`);

  if (!apply) {
    console.log('Dry run only; no records were changed. Add --apply --confirm <database-name> to delete eligible users.');
    return;
  }

  let removed = 0;
  for (const user of eligible) {
    const deleted = await User.deleteOne({ _id: user._id, emailVerified: false });
    if (deleted.deletedCount === 1) {
      removed += 1;
      await BuyerProfile.deleteOne({
        userId: user._id,
        'deliveryAddresses.0': { $exists: false },
        'savedProcurementLists.0': { $exists: false },
        businessName: { $in: ['', null] },
        gstNumber: { $in: ['', null] },
        tradeLicense: { $in: ['', null] },
        $or: [{ creditLimitPaise: { $exists: false } }, { creditLimitPaise: { $lte: 0 } }],
      });
    }
  }
  console.log(`Deleted ${removed} eligible unverified user record(s).`);
}

run()
  .catch((error: unknown) => {
    console.error('[cleanup-unverified-users] Aborted without completing the cleanup.', error instanceof Error ? error.message : 'unknown_error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
