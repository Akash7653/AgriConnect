import { createHash, randomBytes } from 'crypto';
import { User } from '../models/User.js';

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp';

function configuredValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && !/^(your_|replace_|change_me|<|re_your)/i.test(normalized)
    ? normalized
    : undefined;
}

export class VerificationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly category: string
  ) {
    super(message);
    this.name = 'VerificationError';
  }
}

export function isVerificationDeliveryConfigured(): boolean {
  return Boolean(
    configuredValue(process.env.RESEND_API_KEY) &&
    configuredValue(process.env.RESEND_FROM_EMAIL) &&
    configuredValue(process.env.MSG91_AUTH_KEY) &&
    configuredValue(process.env.MSG91_OTP_TEMPLATE_ID)
  );
}

function getMsg91Phone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('+')) return digits;
  if (digits.length === 10) {
    const countryCode = (process.env.MSG91_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '');
    return `${countryCode}${digits}`;
  }
  return digits;
}

function getVerificationUrl(token: string): string {
  const origin = (process.env.CLIENT_URL || 'https://agri-connect-seven-snowy.vercel.app')
    .split(',')[0]
    .trim();
  const url = new URL('/verify-account', origin);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

export async function sendEmailVerification(userId: string): Promise<void> {
  const user = await User.findById(userId).select('+emailVerificationLastSentAt');
  if (!user) throw new VerificationError('Account not found.', 404, 'account_not_found');
  if (user.emailVerified) return;
  if (
    user.emailVerificationLastSentAt &&
    Date.now() - user.emailVerificationLastSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    throw new VerificationError('Please wait before requesting another email link.', 429, 'email_cooldown');
  }

  const apiKey = configuredValue(process.env.RESEND_API_KEY);
  const from = configuredValue(process.env.RESEND_FROM_EMAIL);
  if (!apiKey || !from) throw new VerificationError('Email verification is not configured.', 503, 'email_not_configured');

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS);
  await User.updateOne(
    { _id: user._id, emailVerified: false },
    {
      $set: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
        emailVerificationLastSentAt: new Date(),
      },
    }
  );

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject: 'Verify your AgriConnect email',
        html: `<p>Verify your email address to finish creating your AgriConnect account.</p><p><a href="${getVerificationUrl(token)}">Verify email address</a></p><p>This link expires in 30 minutes and can only be used once.</p>`,
        text: `Verify your AgriConnect email using this link: ${getVerificationUrl(token)}\n\nThis link expires in 30 minutes and can only be used once.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.warn('[auth] Email verification delivery failed', {
        category: 'email_provider_http_error',
        status: response.status,
        requestId: response.headers.get('x-request-id') || response.headers.get('resend-request-id') || undefined,
      });
      throw new VerificationError('Could not send the verification email. Try again later.', 502, 'email_provider_error');
    }
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    console.warn('[auth] Email verification delivery failed', {
      category: error instanceof Error && error.name === 'TimeoutError' ? 'email_timeout' : 'email_network_error',
    });
    throw new VerificationError('Could not send the verification email. Try again later.', 502, 'email_delivery_error');
  }
}

export async function sendPhoneVerification(userId: string): Promise<void> {
  const user = await User.findById(userId).select('+phoneVerificationLastSentAt');
  if (!user) throw new VerificationError('Account not found.', 404, 'account_not_found');
  if (user.phoneVerified) return;
  if (
    user.phoneVerificationLastSentAt &&
    Date.now() - user.phoneVerificationLastSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    throw new VerificationError('Please wait before requesting another SMS code.', 429, 'phone_cooldown');
  }

  const authKey = configuredValue(process.env.MSG91_AUTH_KEY);
  const templateId = configuredValue(process.env.MSG91_OTP_TEMPLATE_ID);
  if (!authKey || !templateId) {
    throw new VerificationError('Phone verification is not configured.', 503, 'sms_not_configured');
  }

  const url = new URL(MSG91_OTP_URL);
  url.searchParams.set('template_id', templateId);
  url.searchParams.set('mobile', getMsg91Phone(user.phone));
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { authkey: authKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json().catch(() => ({})) as { type?: string };
    if (!response.ok || result.type?.toLowerCase() !== 'success') {
      console.warn('[auth] SMS verification delivery failed', {
        category: 'msg91_provider_error',
        status: response.status,
      });
      throw new VerificationError('Could not send the SMS code. Try again later.', 502, 'sms_provider_error');
    }
    await User.updateOne({ _id: user._id, phoneVerified: false }, { $set: { phoneVerificationLastSentAt: new Date() } });
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    console.warn('[auth] SMS verification delivery failed', {
      category: error instanceof Error && error.name === 'TimeoutError' ? 'sms_timeout' : 'sms_network_error',
    });
    throw new VerificationError('Could not send the SMS code. Try again later.', 502, 'sms_delivery_error');
  }
}

export async function verifyEmailToken(token: string): Promise<{ email: string; emailVerified: boolean; phoneVerified: boolean }> {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = new Date();
  const user = await User.findOneAndUpdate(
    {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { $gt: now },
      emailVerified: false,
    },
    {
      $set: { emailVerified: true },
      $unset: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1 },
    },
    { new: true }
  );
  if (!user) throw new VerificationError('This email verification link is invalid or has expired.', 400, 'invalid_email_token');
  return { email: user.email, emailVerified: user.emailVerified, phoneVerified: user.phoneVerified };
}

export async function verifyPhoneCode(email: string, code: string): Promise<{ emailVerified: boolean; phoneVerified: boolean }> {
  const user = await User.findOne({ email: email.toLowerCase(), phoneVerified: false });
  if (!user) throw new VerificationError('Account not found or phone is already verified.', 400, 'account_not_pending');

  const authKey = configuredValue(process.env.MSG91_AUTH_KEY);
  if (!authKey) throw new VerificationError('Phone verification is not configured.', 503, 'sms_not_configured');

  const url = new URL(`${MSG91_OTP_URL}/verify`);
  url.searchParams.set('otp', code);
  url.searchParams.set('mobile', getMsg91Phone(user.phone));
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { authkey: authKey },
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json().catch(() => ({})) as { type?: string };
    if (!response.ok || result.type?.toLowerCase() !== 'success') {
      if (response.status >= 500) {
        console.warn('[auth] SMS verification check failed', { category: 'msg91_provider_error', status: response.status });
        throw new VerificationError('Phone verification is temporarily unavailable.', 502, 'sms_provider_error');
      }
      throw new VerificationError('The SMS code is incorrect or expired.', 400, 'invalid_sms_code');
    }
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    console.warn('[auth] SMS verification check failed', {
      category: error instanceof Error && error.name === 'TimeoutError' ? 'sms_timeout' : 'sms_network_error',
    });
    throw new VerificationError('Phone verification is temporarily unavailable.', 502, 'sms_delivery_error');
  }

  const updated = await User.findOneAndUpdate(
    { _id: user._id, phoneVerified: false },
    { $set: { phoneVerified: true }, $unset: { phoneVerificationLastSentAt: 1 } },
    { new: true }
  );
  if (!updated) throw new VerificationError('Phone verification has already been completed.', 400, 'already_verified');
  return { emailVerified: updated.emailVerified, phoneVerified: updated.phoneVerified };
}
