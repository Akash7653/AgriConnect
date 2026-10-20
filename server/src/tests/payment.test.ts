import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../index.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { CropListing } from '../models/CropListing.js';
import { Order } from '../models/Order.js';
import { Refund } from '../models/Refund.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { seedDatabase } from '../scripts/seed.js';
import { expirePendingOrders } from '../jobs/expirePendingOrders.js';

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

  it('1a. Creates cash-on-delivery orders without Razorpay and reuses the idempotency key', async () => {
    const before = await CropListing.findById(listingId);
    const idempotencyKey = `cod-checkout-${Date.now()}`;
    const payload = {
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
      deliverySlot: { date: new Date().toISOString().slice(0, 10), timeWindow: '07:00 AM - 11:00 AM' },
      paymentMethod: 'cod',
      idempotencyKey,
    };

    const created = await request(app)
      .post('/api/payment/create-order')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(payload);
    expect(created.status).toBe(201);
    expect(created.body.paymentMethod).toBe('cod');
    expect(created.body.razorpayOrderId).toBeUndefined();

    const order = await Order.findById(created.body.orderId);
    expect(order?.status).toBe('confirmed');
    expect(order?.payment.status).toBe('pending');
    expect(order?.payment.gateway).toBe('cod_verified');
    expect(order?.payment.paymentOrderId).toBeUndefined();

    const repeated = await request(app)
      .post('/api/payment/create-order')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send(payload);
    expect(repeated.status).toBe(200);
    expect(repeated.body.orderId).toBe(created.body.orderId);
    const afterRepeat = await CropListing.findById(listingId);
    expect(afterRepeat?.availableQuantity).toBe(before!.availableQuantity - 1);

    const cancelled = await request(app)
      .patch(`/api/orders/${created.body.orderId}/status`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ status: 'cancelled', note: 'Test order cancelled' });
    expect(cancelled.status).toBe(200);
    const afterCancel = await CropListing.findById(listingId);
    expect(afterCancel?.availableQuantity).toBe(before!.availableQuantity);
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

  it('6. Expired pending payment releases reserved stock transactionally', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'buyer@agriconnect.in',
      password: testSeedPassword,
    });
    const listing = await CropListing.findOne({ status: 'active', availableQuantity: { $gt: 2 } });
    expect(listing).toBeDefined();
    const before = await CropListing.findById(listing!._id);
    const createRes = await request(app)
      .post('/api/payment/create-order')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        items: [{ listingId: listing!._id.toString(), quantity: 1 }],
        deliveryAddress: {
          recipientName: 'Priya Sharma', phone: '9123456789', addressLine1: 'Madhapur',
          city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', pinCode: '500081',
        },
        deliverySlot: { date: new Date().toISOString().slice(0, 10), timeWindow: '07:00 AM - 11:00 AM' },
      });
    expect(createRes.status).toBe(201);

    const order = await Order.findById(createRes.body.orderId);
    order!.payment.expiresAt = new Date(Date.now() - 1000);
    await order!.save();

    expect(await expirePendingOrders()).toBe(1);
    const expired = await Order.findById(order!._id);
    expect(expired?.status).toBe('cancelled');
    expect(expired?.payment.status).toBe('failed');

    const after = await CropListing.findById(listing!._id);
    expect(after?.availableQuantity).toBe(before!.availableQuantity);
    expect(after?.reservedQuantity).toBe(before!.reservedQuantity);
  });

  it('7. Processes signed refund webhooks and restores inventory exactly once', async () => {
    const order = await Order.findOne({
      status: 'confirmed',
      'payment.status': 'captured',
      'payment.transactionId': /^pay_test_/,
    });
    expect(order).toBeDefined();
    const listing = await CropListing.findById(order!.items[0].listingId);
    const buyer = order!.buyerId;
    const refundId = `rfnd_test_${Date.now()}`;
    await Refund.create({
      orderId: order!._id,
      orderNumber: order!.orderNumber,
      paymentId: order!.payment.transactionId,
      amountPaise: order!.pricing.finalPayablePaise,
      currency: 'INR',
      status: 'pending',
      reason: 'Test refund webhook',
      idempotencyKey: `refund-webhook-${Date.now()}-key`,
      requestedBy: buyer,
    });

    const eventId = `refund-event-${Date.now()}`;
    const rawPayload = JSON.stringify({
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: refundId,
            payment_id: order!.payment.transactionId,
            amount: order!.pricing.finalPayablePaise,
            currency: 'INR',
            status: 'processed',
          },
        },
      },
    });
    const webhookSecret = 'unit-test-webhook-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;
    const signature = crypto.createHmac('sha256', webhookSecret).update(rawPayload).digest('hex');
    const response = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-event-id', eventId)
      .set('x-razorpay-signature', signature)
      .send(rawPayload);

    expect(response.status).toBe(200);
    expect((await Order.findById(order!._id))?.payment.status).toBe('refunded');
    expect((await Refund.findOne({ providerRefundId: refundId }))?.status).toBe('processed');
    const listingAfter = await CropListing.findById(listing!._id);
    expect(listingAfter?.availableQuantity).toBe(listing!.availableQuantity + order!.items[0].quantity);
    expect(await PayoutLedger.countDocuments({ orderId: order!._id, entryType: 'refund_adjustment' })).toBeGreaterThan(0);

    const duplicate = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-event-id', eventId)
      .set('x-razorpay-signature', signature)
      .send(rawPayload);
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.message).toContain('duplicate');
    expect((await CropListing.findById(listing!._id))?.availableQuantity).toBe(listingAfter?.availableQuantity);
  });

  it('8. Reconciles Razorpay Route transfer webhooks to payout ledgers', async () => {
    const farmerId = (await Order.findOne({ 'payment.status': 'captured' }))?.items[0].farmerId;
    expect(farmerId).toBeDefined();
    const ledger = await PayoutLedger.create({
      orderId: (await Order.findOne({ 'payment.status': 'captured' }))!._id,
      orderNumber: `PAYOUT-${Date.now()}`,
      farmerId,
      farmerName: 'Test Farmer',
      grossProductValuePaise: 10000,
      farmerSharePct: 90,
      farmerPayoutPaise: 9000,
      platformCommissionPaise: 800,
      operationsReservePaise: 200,
      settlementStatus: 'processing',
    });

    const transferId = `trf_test_${Date.now()}`;
    const eventId = `transfer-event-${Date.now()}`;
    const rawPayload = JSON.stringify({
      event: 'transfer.processed',
      payload: {
        transfer: {
          entity: { id: transferId, status: 'processed', notes: { payout_ledger_id: ledger._id.toString() } },
        },
      },
    });
    const webhookSecret = 'unit-test-webhook-secret';
    const signature = crypto.createHmac('sha256', webhookSecret).update(rawPayload).digest('hex');
    const response = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-event-id', eventId)
      .set('x-razorpay-signature', signature)
      .send(rawPayload);

    expect(response.status).toBe(200);
    const settled = await PayoutLedger.findById(ledger._id);
    expect(settled?.settlementStatus).toBe('settled');
    expect(settled?.razorpayTransferId).toBe(transferId);
  });
});
