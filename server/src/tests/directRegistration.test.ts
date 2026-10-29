import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomBytes } from 'crypto';
import { app } from '../index.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { BuyerProfile } from '../models/BuyerProfile.js';
import { AuditLog } from '../models/AuditLog.js';

const password = 'ValidSignupPassword123!';
const testEmails = new Set<string>();

beforeAll(async () => {
  await connectDB();
}, 30_000);

afterEach(async () => {
  const emails = [...testEmails];
  const users = await User.find({ email: { $in: emails } }).select('_id').lean();
  const userIds = users.map(({ _id }) => _id);
  await BuyerProfile.deleteMany({ userId: { $in: userIds } });
  await AuditLog.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ email: { $in: emails } });
  testEmails.clear();
});

afterAll(async () => {
  await disconnectDB();
});

function testEmail(): string {
  const email = `signup-${randomBytes(8).toString('hex')}@registration-test.example`;
  testEmails.add(email);
  return email;
}

describe('registration without contact verification', () => {
  it('creates and signs in a buyer immediately without sending a verification message', async () => {
    const email = testEmail();
    const registration = await request(app).post('/api/auth/signup').send({
      name: 'Direct Signup User',
      email,
      password,
      role: 'buyer',
    });

    expect(registration.status).toBe(201);
    expect(registration.body.token).toBeTruthy();
    expect(registration.body.user).toMatchObject({
      email,
      role: 'buyer',
      status: 'active',
      emailVerified: true,
    });
    expect(await User.findOne({ email })).toBeTruthy();
    expect(await BuyerProfile.findOne({ userId: registration.body.user.id })).toBeTruthy();

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();

    const profile = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registration.body.token}`);
    expect(profile.status).toBe(200);
  });

  it('allows immediate login for requested elevated roles while keeping role approval pending', async () => {
    const email = testEmail();
    const registration = await request(app).post('/api/auth/register').send({
      name: 'Farmer Applicant',
      email,
      password,
      role: 'farmer',
      farm: {
        farmName: 'Applicant Farm',
        village: 'Test Village',
        district: 'Test District',
        state: 'Test State',
        pinCode: '123456',
      },
    });

    expect(registration.status).toBe(201);
    expect(registration.body.user).toMatchObject({
      role: 'buyer',
      requestedRole: 'farmer',
      status: 'pending_verification',
      emailVerified: true,
    });
    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('buyer');
    expect(login.body.user.requestedRole).toBe('farmer');
  });

  it('does not expose OTP or email verification endpoints', async () => {
    const email = testEmail();
    const otp = await request(app).post('/api/auth/verify-otp').send({ email, otp: '123456' });
    const resend = await request(app).post('/api/auth/resend-otp').send({ email });
    const verifyEmail = await request(app).post('/api/auth/verification/email/confirm').send({ token: 'a'.repeat(32) });

    expect(otp.status).toBe(404);
    expect(resend.status).toBe(404);
    expect(verifyEmail.status).toBe(404);
  });

  it('allows login and authenticated requests for legacy accounts marked unverified', async () => {
    const email = testEmail();
    const registration = await request(app).post('/api/auth/signup').send({
      name: 'Legacy User',
      email,
      password,
      role: 'buyer',
    });
    await User.updateOne({ email }, { $set: { emailVerified: false } });

    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    const profile = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registration.body.token}`);
    expect(profile.status).toBe(200);
  });
});
