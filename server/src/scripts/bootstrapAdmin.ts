import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { USER_ROLES } from '../config/constants.js';

dotenv.config();

const blockedEmails = new Set([
  'admin@agriconnect.in',
  'farmer@agriconnect.in',
  'buyer@agriconnect.in',
  'business@agriconnect.in',
  'logistics@agriconnect.in',
]);

async function bootstrapAdmin() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!email || blockedEmails.has(email)) {
    throw new Error('Set ADMIN_BOOTSTRAP_EMAIL to an existing non-demo account.');
  }

  await connectDB();
  const user = await User.findOne({ email });
  if (!user) throw new Error('Bootstrap account was not found. Register it first.');
  if (user.role === USER_ROLES.ADMIN) throw new Error('Account is already an administrator.');
  if (!user.emailVerified) {
    throw new Error('Bootstrap account must complete email verification first.');
  }

  const previousRole = user.role;
  user.role = USER_ROLES.ADMIN;
  user.isVerified = true;
  user.status = 'active';
  await user.save();
  await AuditLog.create({
    action: 'ADMIN_BOOTSTRAPPED',
    userId: user._id,
    userName: user.name,
    role: USER_ROLES.ADMIN,
    targetResource: 'User',
    resourceId: user._id.toString(),
    details: { previousRole, provisioning: 'one-time-cli' },
  });

  console.log('Administrator account provisioned and audited.');
}

bootstrapAdmin()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Admin provisioning failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
