import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { PendingSignup } from '../models/PendingSignup.js';
import { User } from '../models/User.js';
import { BuyerProfile } from '../models/BuyerProfile.js';
import { AuditLog } from '../models/AuditLog.js';
import { getEmailProvider } from '../services/otpEmail.js';
import { signToken } from '../middleware/auth.js';
import { randomBytes } from 'crypto';

const passwords = 'ValidSignupPassword123!';
let infoSpy: ReturnType<typeof vi.spyOn>;
const testEmails = new Set<string>();

beforeAll(async () => {
  await connectDB();
}, 30_000);

afterEach(async () => {
  const emails = [...testEmails];
  const users = await User.find({ email: { $in: emails } }).select('_id').lean();
  const userIds = users.map(({ _id }) => _id);
  await PendingSignup.deleteMany({ email: { $in: emails } });
  await BuyerProfile.deleteMany({ userId: { $in: userIds } });
  await AuditLog.deleteMany({ userId: { $in: userIds }, action: 'USER_SIGNUP_VERIFIED' });
  await User.deleteMany({ email: { $in: emails } });
  testEmails.clear();
  infoSpy?.mockRestore();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await disconnectDB();
});

function testEmail(): string {
  const email = `signup-${randomBytes(8).toString('hex')}@otp-test.example`;
  testEmails.add(email);
  return email;
}

function enableConsoleProvider() {
  vi.stubEnv('EMAIL_PROVIDER', 'console');
  vi.stubEnv('NODE_ENV', 'test');
  infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
}

function lastOtp(): string {
  const output = infoSpy.mock.calls.map(([message]) => String(message)).reverse()
    .find((message) => /:\s\d{6}$/.test(message));
  const otp = output?.match(/:\s(\d{6})$/)?.[1];
  if (!otp) throw new Error('Test console provider did not emit an OTP.');
  return otp;
}

async function signup(email: string) {
  return request(app).post('/api/auth/signup').send({
    name: 'OTP Test User',
    email,
    password: passwords,
    role: 'buyer',
  });
}

describe('signup email OTP flow', () => {
  it('stores only a pending signup before email verification', async () => {
    enableConsoleProvider();
    const email = testEmail();
    const response = await signup(email);

    expect(response.status).toBe(202);
    expect(response.body.otpSent).toBe(true);
    expect(await User.findOne({ email })).toBeNull();
    const pending = await PendingSignup.findOne({ email }).select('+passwordHash +otpHash');
    expect(pending?.passwordHash).not.toBe(passwords);
    expect(pending?.otpHash).not.toBe(lastOtp());
    expect(pending?.otpHash).toMatch(/^[a-f\d]{64}$/);
    expect(PendingSignup.schema.indexes()).toContainEqual([
      { createdAt: 1 },
      { expireAfterSeconds: 1800, background: true },
    ]);

    const login = await request(app).post('/api/auth/login').send({ email, password: passwords });
    expect(login.status).toBe(403);
    expect(login.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('creates the User and consumes the pending signup after a correct OTP', async () => {
    enableConsoleProvider();
    const email = testEmail();
    await signup(email);
    const otp = lastOtp();

    const response = await request(app).post('/api/auth/verify-otp').send({ email, otp });
    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.emailVerified).toBe(true);
    expect(await PendingSignup.findOne({ email })).toBeNull();
    const user = await User.findOne({ email });
    expect(user?.emailVerified).toBe(true);
    expect(user?.passwordHash).not.toBe(passwords);

    const login = await request(app).post('/api/auth/login').send({ email: `  ${email.toUpperCase()}  `, password: passwords });
    expect(login.status).toBe(200);
  });

  it('counts incorrect codes and invalidates the OTP after five attempts', async () => {
    enableConsoleProvider();
    const email = testEmail();
    await signup(email);
    const code = lastOtp();
    const wrongCode = `${code[0] === '0' ? '1' : '0'}${code.slice(1)}`;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app).post('/api/auth/verify-otp').send({ email, otp: wrongCode });
      expect(response.status).toBe(400);
    }
    const pending = await PendingSignup.findOne({ email }).select('+otpHash');
    expect(pending?.attempts).toBe(5);
    expect(pending?.otpHash).toBeUndefined();

    const afterLock = await request(app).post('/api/auth/verify-otp').send({ email, otp: code });
    expect(afterLock.status).toBe(400);
    expect(afterLock.body.code).toBe('OTP_ATTEMPTS_EXCEEDED');
  });

  it('rejects an expired OTP', async () => {
    enableConsoleProvider();
    const email = testEmail();
    await signup(email);
    await PendingSignup.updateOne({ email }, { $set: { otpExpiresAt: new Date(Date.now() - 1_000) } });

    const response = await request(app).post('/api/auth/verify-otp').send({ email, otp: lastOtp() });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('OTP_EXPIRED');
    expect(await User.findOne({ email })).toBeNull();
  });

  it('enforces the resend cooldown and hourly limit', async () => {
    enableConsoleProvider();
    const email = testEmail();
    await signup(email);

    const cooldown = await request(app).post('/api/auth/resend-otp').send({ email });
    const unknown = await request(app).post('/api/auth/resend-otp').send({ email: testEmail() });
    expect(cooldown.status).toBe(202);
    expect(cooldown.body).toEqual(unknown.body);

    await PendingSignup.updateOne(
      { email },
      { $set: { lastSentAt: new Date(Date.now() - 61_000), resendWindowStartedAt: new Date(), resendCount: 0 } },
    );
    for (let resend = 0; resend < 5; resend += 1) {
      await PendingSignup.updateOne({ email }, { $set: { lastSentAt: new Date(Date.now() - 61_000) } });
      const response = await request(app).post('/api/auth/resend-otp').send({ email });
      expect(response.status).toBe(202);
    }
    await PendingSignup.updateOne({ email }, { $set: { lastSentAt: new Date(Date.now() - 61_000) } });
    const limit = await request(app).post('/api/auth/resend-otp').send({ email });
    const missing = await request(app).post('/api/auth/resend-otp').send({ email: testEmail() });
    expect(limit.status).toBe(202);
    expect(limit.body).toEqual(missing.body);
  });

  it('creates only one User when the same code is verified concurrently', async () => {
    enableConsoleProvider();
    const email = testEmail();
    await signup(email);
    const otp = lastOtp();

    const responses = await Promise.all([
      request(app).post('/api/auth/verify-otp').send({ email, otp }),
      request(app).post('/api/auth/verify-otp').send({ email, otp }),
    ]);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(await User.countDocuments({ email })).toBe(1);
  });

  it('returns a retryable failure when the provider rejects delivery', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'brevo');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('BREVO_API_KEY', 'test-brevo-key');
    vi.stubEnv('EMAIL_FROM', 'verify@example.test');
    vi.stubEnv('EMAIL_FROM_NAME', 'AgriConnect Test');
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'sender_not_verified' }, { status: 401 })));
    const email = testEmail();

    const response = await signup(email);
    expect(response.status).toBe(502);
    expect(response.body.code).toBe('OTP_DELIVERY_FAILED');
    expect(response.body.retryable).toBe(true);
    expect(await User.findOne({ email })).toBeNull();
    const pending = await PendingSignup.findOne({ email }).select('+otpHash');
    expect(pending).toBeTruthy();
    expect(pending?.otpHash).toBeUndefined();
  });

  it('refuses the console provider in production', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'console');
    vi.stubEnv('NODE_ENV', 'production');
    await expect(getEmailProvider().sendOtp(testEmail(), '123456', 'Test')).rejects.toMatchObject({
      statusCode: 503,
      category: 'console_provider_forbidden',
    });
  });

  it('protects email health details to administrators and never returns credentials', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'brevo');
    vi.stubEnv('BREVO_API_KEY', 'health-test-api-key');
    vi.stubEnv('EMAIL_FROM', 'verify@example.test');
    vi.stubEnv('EMAIL_FROM_NAME', 'AgriConnect');
    const admin = await User.create({
      name: 'Email Health Admin',
      email: testEmail(),
      passwordHash: 'test-hash',
      role: 'admin',
      status: 'active',
    });
    const buyer = await User.create({
      name: 'Email Health Buyer',
      email: testEmail(),
      passwordHash: 'test-hash',
      role: 'buyer',
      status: 'active',
    });

    expect((await request(app).get('/api/health/email')).status).toBe(401);
    expect((await request(app).get('/api/health/email').set('Authorization', `Bearer ${signToken(buyer)}`)).status).toBe(403);
    const response = await request(app).get('/api/health/email').set('Authorization', `Bearer ${signToken(admin)}`);
    expect(response.status).toBe(200);
    expect(response.body.email).toMatchObject({
      provider: 'brevo',
      configured: true,
      credentialsPresent: true,
      senderConfigured: true,
    });
    expect(JSON.stringify(response.body)).not.toContain('health-test-api-key');
  });
});
