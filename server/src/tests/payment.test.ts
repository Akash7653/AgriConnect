import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../index.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { CropListing } from '../models/CropListing.js';
import { Order } from '../models/Order.js';
import { seedDatabase } from '../scripts/seed.js';

const testSeedPassword = crypto.randomBytes(32).toString('base64url');

beforeAll(async () => {
  process.env.SEED_PASSWORD = testSeedPassword;
  await connectDB();
  await seedDatabase();
}, 30000);

afterAll(async () => {
  await disconnectDB();
});

describe('AgriConnect Razorpay Payment Integration & Security Tests', () => {
  let buyerToken = '';
  let listingId = '';
  let createdOrderId = '';
  let rzpOrderId = '';
  let amountPaise = 0;

  it('1. Should authenticate buyer and fetch test crop listing', async () => {
    const buyerRes = await request(app).post('/api/auth/login').send({
      email: 'buyer@agriconnect.in',
      password: testSeedPassword,
    });
    expect(buyerRes.status).toBe(200);
    buyerToken = buyerRes.body.token;

    const crop = await CropListing.findOne({ status: 'active', availableQuantity: { $gt: 10 } });
    expect(crop).toBeDefined();
    listingId = crop!._id.toString();
  });

  it('2. Should create Razorpay order with server-calculated amount and atomic stock reservation', async () => {
    const listingBefore = await CropListing.findById(listingId);
    const initialAvailable = listingBefore!.availableQuantity;

    const res = await request(app)
      .post('/api/payment/create-order')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        items: [{ listingId, quantity: 2 }],
        deliveryAddress: {
          recipientName: 'Priya Sharma',
          phone: '9123456789',
          addressLine1: 'Madhapur',
          city: 'Hyderabad',
          district: 'Hyderabad',
          state: 'Telangana',
          pinCode: '500081',
        },
        deliverySlot: {
          date: new Date().toISOString().split('T')[0],
          timeWindow: '07:00 AM - 11:00 AM',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.orderId).toBeDefined();
    expect(res.body.razorpayOrderId).toBeDefined();
    expect(res.body.amountPaise).toBeGreaterThan(0);

    createdOrderId = res.body.orderId;
    rzpOrderId = res.body.razorpayOrderId;
    amountPaise = res.body.amountPaise;

    // Check stock was decremented atomically by 2
    const listingAfter = await CropListing.findById(listingId);
    expect(listingAfter!.availableQuantity).toBe(initialAvailable - 2);
    expect(listingAfter!.reservedQuantity).toBeGreaterThanOrEqual(2);
  });

  it('3. Should reject payment verification with invalid signature and release stock', async () => {
    const listingBefore = await CropListing.findById(listingId);
    const initialAvailable = listingBefore!.availableQuantity;

    const res = await request(app)
      .post('/api/payment/verify')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        orderId: createdOrderId,
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: 'pay_test_fake_12345',
        razorpaySignature: 'invalid_tampered_signature_hash',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    // Order status should be marked cancelled/failed and stock restored
    const order = await Order.findById(createdOrderId);
    expect(order!.payment.status).toBe('failed');
    expect(order!.status).toBe('cancelled');

    const listingAfter = await CropListing.findById(listingId);
    expect(listingAfter!.availableQuantity).toBe(initialAvailable + 2);
  });

  it('4. Should verify valid cryptographic HMAC SHA256 payment signature and capture payment', async () => {
    // Create fresh order to verify successfully
    const createRes = await request(app)
      .post('/api/payment/create-order')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        items: [{ listingId, quantity: 1 }],
        deliveryAddress: {
          recipientName: 'Priya Sharma',
          phone: '9123456789',
          addressLine1: 'Madhapur',
          city: 'Hyderabad',
          district: 'Hyderabad',
          state: 'Telangana',
          pinCode: '500081',
        },
        deliverySlot: {
          date: new Date().toISOString().split('T')[0],
          timeWindow: '07:00 AM - 11:00 AM',
        },
      });

    expect(createRes.status).toBe(201);
    const validOrderId = createRes.body.orderId;
    const validRzpOrderId = createRes.body.razorpayOrderId;
    const validPaymentId = `pay_test_${Date.now()}`;

    // Compute genuine HMAC SHA256 signature using the configured test secret
    const secret = process.env.RAZORPAY_KEY_SECRET;
    expect(secret).toBeTruthy();
    const validSignature = crypto
      .createHmac('sha256', secret!)
      .update(`${validRzpOrderId}|${validPaymentId}`)
      .digest('hex');

    const verifyRes = await request(app)
      .post('/api/payment/verify')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        orderId: validOrderId,
        razorpayOrderId: validRzpOrderId,
        razorpayPaymentId: validPaymentId,
        razorpaySignature: validSignature,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.order.payment.status).toBe('captured');
    expect(verifyRes.body.order.status).toBe('confirmed');

    // Idempotency: submitting the same verification again should succeed safely without double charges
    const duplicateRes = await request(app)
      .post('/api/payment/verify')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        orderId: validOrderId,
        razorpayOrderId: validRzpOrderId,
        razorpayPaymentId: validPaymentId,
        razorpaySignature: validSignature,
      });

    expect(duplicateRes.status).toBe(200);
    expect(duplicateRes.body.message).toContain('idempotent');
  });

  it('5. Webhook should reject missing or invalid signature when secret is configured', async () => {
    const rawPayload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_123', order_id: 'order_123' } } },
    });

    // Unsigned webhook request
    const res = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .send(rawPayload);

    expect([400, 503]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});
