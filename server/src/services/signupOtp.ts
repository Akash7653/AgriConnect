import { createHmac, timingSafeEqual } from 'crypto';
import { Types } from 'mongoose';
import { PendingSignup, type IPendingSignup } from '../models/PendingSignup.js';
import { User } from '../models/User.js';
import { OtpDeliveryError, createOtp, sendOtp } from './otpEmail.js';

const OTP_LIFETIME_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const RESEND_WINDOW_MS = 60 * 60_000;
const MAX_RESENDS = 5;

export class SignupOtpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 409 | 429 | 502 | 503,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'SignupOtpError';
  }
}

function hashOtp(otp: string): string {
  return createHmac('sha256', process.env.JWT_SECRET || 'agriconnect_jwt_super_secret_dev_2026').update(otp).digest('hex');
}

function matchesOtp(candidateHash: string, storedHash: string): boolean {
  const candidate = Buffer.from(candidateHash, 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

function deliveryFailure(error: unknown): SignupOtpError {
  if (error instanceof OtpDeliveryError) {
    return new SignupOtpError(error.message, error.statusCode, 'OTP_DELIVERY_FAILED');
  }
  console.error('[auth] Signup OTP delivery failed', { category: 'email_provider_unexpected_error' });
  return new SignupOtpError('We could not send your verification code. Please retry.', 502, 'OTP_DELIVERY_FAILED');
}

async function deliverPendingCode(
  pending: IPendingSignup,
  options: { countResend: boolean },
): Promise<void> {
  const now = new Date();
  const previous = await PendingSignup.findById(pending._id)
    .select('+otpHash +otpExpiresAt +lastSentAt +resendWindowStartedAt');
  if (!previous) throw new SignupOtpError('Signup request expired. Please register again.', 400, 'SIGNUP_EXPIRED');
  const windowStarted = previous.resendWindowStartedAt;
  const resetWindow = !windowStarted || now.getTime() - windowStarted.getTime() >= RESEND_WINDOW_MS;
  const resendCount = options.countResend
    ? resetWindow ? 1 : previous.resendCount + 1
    : previous.resendCount;
  if (options.countResend && resendCount > MAX_RESENDS) {
    throw new SignupOtpError('You have reached the resend limit. Please try again later.', 429, 'OTP_RESEND_LIMIT');
  }
  if (options.countResend && previous.lastSentAt && now.getTime() - previous.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new SignupOtpError('Please wait 60 seconds before requesting another code.', 429, 'OTP_COOLDOWN');
  }

  const otp = createOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(now.getTime() + OTP_LIFETIME_MS);
  const filter: Record<string, unknown> = { _id: previous._id };
  if (options.countResend) {
    filter.verificationClaimedAt = { $exists: false };
    filter.$or = [
      { lastSentAt: { $exists: false } },
      { lastSentAt: { $lte: new Date(now.getTime() - RESEND_COOLDOWN_MS) } },
    ];
    if (!resetWindow) filter.resendCount = { $lt: MAX_RESENDS };
  }
  const prior = {
    otpHash: previous.otpHash,
    otpExpiresAt: previous.otpExpiresAt,
    lastSentAt: previous.lastSentAt,
    resendCount: previous.resendCount,
    resendWindowStartedAt: previous.resendWindowStartedAt,
    attempts: previous.attempts,
  };
  const updateResult = await PendingSignup.updateOne(filter, {
    $set: {
      otpHash,
      otpExpiresAt: expiresAt,
      lastSentAt: now,
      attempts: 0,
      ...(options.countResend ? {
        resendCount,
        resendWindowStartedAt: resetWindow ? now : windowStarted,
      } : {}),
    },
  });
  if (updateResult.modifiedCount !== 1) {
    throw new SignupOtpError('Please wait before requesting another code.', 429, 'OTP_COOLDOWN');
  }

  try {
    await sendOtp(previous.email, otp, previous.name);
  } catch (error) {
    const setValues: Record<string, unknown> = { attempts: prior.attempts, resendCount: prior.resendCount };
    const unsetValues: Record<string, 1> = {};
    if (prior.otpHash) setValues.otpHash = prior.otpHash;
    else unsetValues.otpHash = 1;
    if (prior.otpExpiresAt) setValues.otpExpiresAt = prior.otpExpiresAt;
    else unsetValues.otpExpiresAt = 1;
    if (prior.lastSentAt) setValues.lastSentAt = prior.lastSentAt;
    else unsetValues.lastSentAt = 1;
    if (prior.resendWindowStartedAt) setValues.resendWindowStartedAt = prior.resendWindowStartedAt;
    else unsetValues.resendWindowStartedAt = 1;
    await PendingSignup.updateOne(
      { _id: previous._id, otpHash },
      { $set: setValues, $unset: unsetValues },
    );
    throw deliveryFailure(error);
  }
}

export async function createPendingSignup(data: {
  email: string;
  name: string;
  passwordHash: string;
  phone?: string;
  role: IPendingSignup['role'];
  requestedRole?: IPendingSignup['requestedRole'];
  requestedFarm?: IPendingSignup['requestedFarm'];
  language: IPendingSignup['language'];
  legacyUserId?: Types.ObjectId;
}): Promise<void> {
  const existing = await PendingSignup.findOne({ email: data.email });
  if (existing) {
    await deliverPendingCode(existing, { countResend: true });
    return;
  }

  let pending: IPendingSignup;
  try {
    pending = await PendingSignup.create({
      ...data,
      attempts: 0,
      resendCount: 0,
      resendWindowStartedAt: new Date(),
    });
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error;
    const racedPending = await PendingSignup.findOne({ email: data.email });
    if (!racedPending) throw error;
    await deliverPendingCode(racedPending, { countResend: true });
    return;
  }
  try {
    await deliverPendingCode(pending, { countResend: false });
  } catch (error) {
    if (error instanceof SignupOtpError && error.code === 'OTP_DELIVERY_FAILED') {
      await PendingSignup.updateOne(
        { _id: pending._id },
        { $unset: { otpHash: 1, otpExpiresAt: 1, lastSentAt: 1 } },
      );
    }
    throw error;
  }
}

export async function resendPendingSignupOtp(email: string): Promise<'sent' | 'not_found'> {
  let pending = await PendingSignup.findOne({ email });
  if (!pending) {
    const legacyUser = await User.findOne({ email, emailVerified: false });
    if (!legacyUser) return 'not_found';
    try {
      pending = await PendingSignup.create({
        email: legacyUser.email,
        name: legacyUser.name,
        passwordHash: legacyUser.passwordHash,
        phone: legacyUser.phone,
        role: legacyUser.role === 'admin' ? 'buyer' : legacyUser.role,
        ...(legacyUser.requestedRole ? { requestedRole: legacyUser.requestedRole } : {}),
        ...(legacyUser.requestedFarm ? { requestedFarm: legacyUser.requestedFarm } : {}),
        language: legacyUser.language,
        legacyUserId: legacyUser._id,
        attempts: 0,
        resendCount: 0,
        resendWindowStartedAt: new Date(),
      });
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error;
      pending = await PendingSignup.findOne({ email });
      if (!pending) return 'not_found';
    }
  }
  await deliverPendingCode(pending, { countResend: true });
  return 'sent';
}

export async function checkSignupOtp(email: string, otp: string): Promise<
  { pending: IPendingSignup; isValid: true } | { pending: IPendingSignup | null; isValid: false; code: string }
> {
  const pending = await PendingSignup.findOne({ email })
    .select('+passwordHash +otpHash +otpExpiresAt +verificationClaimedAt +legacyUserId');
  if (!pending) return { pending: null, isValid: false, code: 'OTP_INVALID' };
  if (pending.attempts >= 5) {
    return { pending, isValid: false, code: 'OTP_ATTEMPTS_EXCEEDED' };
  }
  if (pending.verificationClaimedAt) return { pending, isValid: false, code: 'OTP_INVALID' };
  if (!pending.otpHash) return { pending, isValid: false, code: 'OTP_EXPIRED' };
  if (!pending.otpExpiresAt || pending.otpExpiresAt.getTime() <= Date.now()) {
    await PendingSignup.updateOne({ _id: pending._id }, { $unset: { otpHash: 1, otpExpiresAt: 1 } });
    return { pending, isValid: false, code: 'OTP_EXPIRED' };
  }

  const candidateHash = hashOtp(otp);
  if (!matchesOtp(candidateHash, pending.otpHash)) {
    const attempt = await PendingSignup.findOneAndUpdate(
      { _id: pending._id, otpHash: pending.otpHash, attempts: { $lt: 5 } },
      { $inc: { attempts: 1 } },
      { new: true },
    );
    if (attempt && (attempt.attempts ?? 0) >= 5) {
      await PendingSignup.updateOne(
        { _id: pending._id, attempts: { $gte: 5 } },
        { $unset: { otpHash: 1, otpExpiresAt: 1 } },
      );
      return { pending, isValid: false, code: 'OTP_ATTEMPTS_EXCEEDED' };
    }
    return { pending, isValid: false, code: 'OTP_INVALID' };
  }

  const claimed = await PendingSignup.findOneAndUpdate(
    {
      _id: pending._id,
      otpHash: candidateHash,
      otpExpiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
      verificationClaimedAt: { $exists: false },
    },
    {
      $set: { verificationClaimedAt: new Date() },
      $unset: { otpHash: 1, otpExpiresAt: 1 },
    },
    { new: true },
  );
  if (!claimed) return { pending, isValid: false, code: 'OTP_INVALID' };
  return { pending, isValid: true };
}

export async function restoreClaimedOtp(pending: IPendingSignup, otp: string): Promise<void> {
  await PendingSignup.updateOne(
    { _id: pending._id, verificationClaimedAt: { $exists: true } },
    {
      $set: {
        otpHash: hashOtp(otp),
        otpExpiresAt: new Date(Date.now() + OTP_LIFETIME_MS),
      },
      $unset: { verificationClaimedAt: 1 },
    },
  );
}
