import { randomInt } from 'crypto';

export interface EmailProvider {
  readonly name: 'brevo' | 'resend' | 'console';
  sendOtp(email: string, otp: string, name: string): Promise<void>;
}

export class OtpDeliveryError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 502 | 503,
    public readonly category: string,
  ) {
    super(message);
    this.name = 'OtpDeliveryError';
  }
}

function configured(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && !/^(your_|replace_|change_me|<|re_your)/i.test(trimmed) ? trimmed : undefined;
}

function providerName(): EmailProvider['name'] | undefined {
  const value = (process.env.EMAIL_PROVIDER || 'brevo').trim().toLowerCase();
  return value === 'brevo' || value === 'resend' || value === 'console' ? value : undefined;
}

function emailContent(otp: string, name: string): { text: string; html: string } {
  const safeName = name.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
  return {
    text: `Hello ${name},\n\nYour AgriConnect verification code is ${otp}.\n\nThis code expires in 10 minutes and can be used once. If you did not request this code, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#173c2b"><p>Hello ${safeName},</p><p>Your AgriConnect verification code is:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${otp}</p><p>This code expires in 10 minutes and can be used once.</p><p>If you didn't request this code, you can ignore this email.</p></div>`,
  };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain || ''}`;
}

function sender(): { email: string; name: string } {
  const email = configured(process.env.EMAIL_FROM);
  const name = configured(process.env.EMAIL_FROM_NAME);
  if (!email || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new OtpDeliveryError('Email delivery is not configured. Please retry later.', 503, 'email_not_configured');
  }
  return { email, name };
}

function providerErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  const code = [record.code, record.name, record.error].find((value) => typeof value === 'string');
  return typeof code === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(code) ? code : undefined;
}

async function postEmail(provider: 'brevo' | 'resend', email: string, otp: string, name: string): Promise<void> {
  const from = sender();
  const apiKey = configured(provider === 'brevo' ? process.env.BREVO_API_KEY : process.env.RESEND_API_KEY);
  if (!apiKey) {
    throw new OtpDeliveryError('Email delivery is not configured. Please retry later.', 503, 'email_credentials_missing');
  }
  if (
    provider === 'resend' &&
    process.env.NODE_ENV === 'production' &&
    (from.email.toLowerCase() === 'onboarding@resend.dev' || from.email.toLowerCase().endsWith('@resend.dev'))
  ) {
    throw new OtpDeliveryError('Resend requires a verified sender domain in production.', 503, 'resend_test_sender_forbidden');
  }

  const content = emailContent(otp, name);
  let response: Response;
  try {
    response = await fetch(
      provider === 'brevo' ? 'https://api.brevo.com/v3/smtp/email' : 'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          ...(provider === 'brevo' ? { 'api-key': apiKey } : { Authorization: `Bearer ${apiKey}` }),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(provider === 'brevo'
          ? {
              sender: from,
              to: [{ email, name }],
              subject: 'Your AgriConnect verification code',
              textContent: content.text,
              htmlContent: content.html,
            }
          : {
              from: `${from.name} <${from.email}>`,
              to: [email],
              subject: 'Your AgriConnect verification code',
              text: content.text,
              html: content.html,
            }),
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch (error) {
    const category = error instanceof Error && error.name === 'TimeoutError' ? 'email_timeout' : 'email_network_error';
    console.warn('[auth] OTP delivery failed', { provider, category });
    throw new OtpDeliveryError('We could not send your verification code. Please retry.', 502, category);
  }

  if (!response.ok) {
    let code: string | undefined;
    try {
      code = providerErrorCode(await response.json());
    } catch {
      code = undefined;
    }
    console.warn('[auth] OTP provider rejected the message', {
      provider,
      status: response.status,
      ...(code ? { providerCode: code } : {}),
    });
    throw new OtpDeliveryError('We could not send your verification code. Please retry.', 502, 'email_provider_error');
  }
}

class HttpEmailProvider implements EmailProvider {
  constructor(public readonly name: 'brevo' | 'resend') {}

  async sendOtp(email: string, otp: string, name: string): Promise<void> {
    await postEmail(this.name, email, otp, name);
  }
}

class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console' as const;

  async sendOtp(email: string, otp: string, name: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new OtpDeliveryError('Console email delivery is disabled in production.', 503, 'console_provider_forbidden');
    }
    console.info(`[auth] Development OTP for ${maskEmail(email)} (${name}): ${otp}`);
  }
}

export function createOtp(): string {
  return randomInt(100_000, 1_000_000).toString();
}

export function getEmailProvider(): EmailProvider {
  const selected = providerName();
  if (!selected) throw new OtpDeliveryError('EMAIL_PROVIDER must be brevo, resend, or console.', 503, 'email_provider_invalid');
  return selected === 'console' ? new ConsoleEmailProvider() : new HttpEmailProvider(selected);
}

export function checkEmailProviderStartup(): void {
  const selected = providerName();
  if (!selected) throw new Error('EMAIL_PROVIDER must be brevo, resend, or console.');
  if (selected === 'console') {
    if (process.env.NODE_ENV === 'production') throw new Error('EMAIL_PROVIDER=console is forbidden in production.');
    console.warn('[email] Console OTP provider enabled for development only.');
    return;
  }
  try {
    sender();
    const hasKey = Boolean(configured(selected === 'brevo' ? process.env.BREVO_API_KEY : process.env.RESEND_API_KEY));
    if (!hasKey) console.warn(`[email] ${selected} provider is missing its API key; signup email delivery will fail.`);
    if (
      selected === 'resend'
      && process.env.NODE_ENV === 'production'
      && (process.env.EMAIL_FROM?.trim().toLowerCase() === 'onboarding@resend.dev'
        || process.env.EMAIL_FROM?.trim().toLowerCase().endsWith('@resend.dev'))
    ) {
      throw new Error('Resend test senders are forbidden in production; configure a verified sender domain.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('forbidden')) throw error;
    console.warn('[email] Email provider is misconfigured; signup email delivery will fail.', {
      provider: selected,
      category: error instanceof OtpDeliveryError ? error.category : 'email_sender_invalid',
    });
  }
}

export function emailProviderHealth(): {
  provider: string;
  configured: boolean;
  credentialsPresent: boolean;
  senderConfigured: boolean;
} {
  const selected = providerName();
  const senderConfigured = Boolean(configured(process.env.EMAIL_FROM) && configured(process.env.EMAIL_FROM_NAME));
  const credentialsPresent = selected === 'console'
    ? process.env.NODE_ENV !== 'production'
    : selected === 'brevo'
      ? Boolean(configured(process.env.BREVO_API_KEY))
      : selected === 'resend'
        ? Boolean(configured(process.env.RESEND_API_KEY))
        : false;
  return {
    provider: selected || 'invalid',
    configured: Boolean(selected && credentialsPresent && senderConfigured && !(selected === 'console' && process.env.NODE_ENV === 'production')),
    credentialsPresent,
    senderConfigured,
  };
}

export async function sendOtp(email: string, otp: string, name: string): Promise<void> {
  return getEmailProvider().sendOtp(email, otp, name);
}
