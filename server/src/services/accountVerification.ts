import { createHash, randomBytes } from 'crypto';
import { User } from '../models/User.js';

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function configuredValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && !/^(your_|replace_|change_me|<|re_your)/i.test(normalized)
    ? normalized
    : undefined;
}

function getFrontendUrl(): URL | undefined {
  const configured = configuredValue(process.env.FRONTEND_URL);
  if (!configured) return undefined;
  try {
    const url = new URL(configured);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
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
    getFrontendUrl()
  );
}

function getVerificationUrl(token: string): string {
  const frontendUrl = getFrontendUrl();
  if (!frontendUrl) {
    throw new VerificationError('Email verification is not configured. Please try again later.', 503, 'email_not_configured');
  }
  frontendUrl.pathname = '/verify-account';
  frontendUrl.hash = new URLSearchParams({ token }).toString();
  return frontendUrl.toString();
}

async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const apiKey = configuredValue(process.env.RESEND_API_KEY);
  const from = configuredValue(process.env.RESEND_FROM_EMAIL);
  if (!apiKey || !from || !getFrontendUrl()) {
    throw new VerificationError('Email verification is not configured. Please try again later.', 503, 'email_not_configured');
  }

  const verificationUrl = getVerificationUrl(token);
  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Verify your AgriConnect email',
        html: `<p>Verify your email address to finish creating your AgriConnect account.</p><p><a href="${verificationUrl}">Verify email address</a></p><p>This link expires in 30 minutes and can only be used once.</p>`,
        text: `Verify your AgriConnect email using this link: ${verificationUrl}\n\nThis link expires in 30 minutes and can only be used once.`,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.warn('[auth] Email verification delivery failed', {
      category: error instanceof Error && error.name === 'TimeoutError' ? 'email_timeout' : 'email_network_error',
    });
    throw new VerificationError('Could not send the verification email. Please try again shortly.', 502, 'email_delivery_error');
  }

  if (!response.ok) {
    console.warn('[auth] Email verification delivery failed', {
      category: 'email_provider_http_error',
      status: response.status,
      requestId: response.headers.get('x-request-id') || response.headers.get('resend-request-id') || undefined,
    });
    throw new VerificationError('Could not send the verification email. Please try again shortly.', 502, 'email_provider_error');
  }
}

export async function sendEmailVerification(userId: string): Promise<void> {
  const user = await User.findById(userId).select('+emailVerificationLastSentAt');
  if (!user) throw new VerificationError('Account not found.', 404, 'account_not_found');
  if (user.emailVerified) return;
  if (!isVerificationDeliveryConfigured()) {
    throw new VerificationError('Email verification is not configured. Please try again later.', 503, 'email_not_configured');
  }

  const now = new Date();
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const reservation = await User.updateOne(
    {
      _id: user._id,
      emailVerified: false,
      $or: [
        { emailVerificationLastSentAt: { $exists: false } },
        { emailVerificationLastSentAt: { $lte: new Date(now.getTime() - RESEND_COOLDOWN_MS) } },
      ],
    },
    {
      $set: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MS),
        emailVerificationLastSentAt: now,
      },
    }
  );
  if (reservation.modifiedCount !== 1) {
    throw new VerificationError('Please wait before requesting another verification email.', 429, 'email_cooldown');
  }

  try {
    await sendVerificationEmail(user.email, token);
  } catch (error) {
    try {
      await User.updateOne(
        { _id: user._id, emailVerificationTokenHash: tokenHash, emailVerified: false },
        {
          $unset: {
            emailVerificationTokenHash: 1,
            emailVerificationExpiresAt: 1,
            emailVerificationLastSentAt: 1,
          },
        }
      );
    } catch {
      console.error('[auth] Failed to clear an unsent email verification token', { category: 'verification_cleanup_error' });
    }
    throw error;
  }
}

export async function verifyEmailToken(token: string): Promise<{ email: string; emailVerified: boolean }> {
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
      $unset: {
        emailVerificationTokenHash: 1,
        emailVerificationExpiresAt: 1,
        emailVerificationLastSentAt: 1,
      },
    },
    { new: true }
  );
  if (!user) throw new VerificationError('This email verification link is invalid or has expired.', 400, 'invalid_email_token');
  return { email: user.email, emailVerified: user.emailVerified };
}
