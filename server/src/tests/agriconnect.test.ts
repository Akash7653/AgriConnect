import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { CropListing } from '../models/CropListing.js';
import { ServiceZone } from '../models/ServiceZone.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { seedDatabase } from '../scripts/seed.js';
import { randomBytes } from 'crypto';
import { EmailOutbox } from '../models/EmailOutbox.js';
import { queueOrderConfirmation, processEmailOutbox } from '../services/email.js';

const testSeedPassword = randomBytes(32).toString('base64url');

beforeAll(async () => {
  process.env.SEED_PASSWORD = testSeedPassword;
  await connectDB();
  await seedDatabase();
}, 30000);

afterAll(async () => {
  await disconnectDB();
});

describe('AgriConnect SaaS Platform - Integration & Concurrency Tests', () => {
  let farmerToken = '';
  let buyerToken = '';
  let adminToken = '';
  let listingId = '';

  it('1. Should authenticate users and return valid JWT tokens with roles', async () => {
    // Farmer Login
    const farmerRes = await request(app).post('/api/auth/login').send({
      email: 'farmer@agriconnect.in',
      password: testSeedPassword,
    });
    expect(farmerRes.status).toBe(200);
    expect(farmerRes.body.success).toBe(true);
    expect(farmerRes.body.user.role).toBe('farmer');
    farmerToken = farmerRes.body.token;

    // Buyer Login
    const buyerRes = await request(app).post('/api/auth/login').send({
      email: 'buyer@agriconnect.in',
      password: testSeedPassword,
    });
    expect(buyerRes.status).toBe(200);
    expect(buyerRes.body.user.role).toBe('buyer');
    buyerToken = buyerRes.body.token;

    // Admin Login
    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@agriconnect.in',
      password: testSeedPassword,
    });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.user.role).toBe('admin');
    adminToken = adminRes.body.token;

    const farmerMarketplace = await request(app)
      .get('/api/crops')
      .set('Authorization', `Bearer ${farmerToken}`);
    expect(farmerMarketplace.status).toBe(403);

    const buyerMarketplace = await request(app)
      .get('/api/crops')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(buyerMarketplace.status).toBe(200);
  });

  it('2. Should allow farmer to publish a new crop listing with inventory', async () => {
    const res = await request(app)
      .post('/api/crops')
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        cropName: 'Organic Shimla Green Capsicum',
        category: 'Vegetables',
        description: 'Crisp green capsicum grown under naturally ventilated polyhouse.',
        qualityGrade: 'A+',
        pricePerUnitPaise: 4500, // ₹45.00/kg
        unit: 'kg',
        availableQuantity: 20, // Limited 20 kg to test concurrency reservation
        minOrderQuantity: 1,
        harvestDate: new Date().toISOString(),
        expectedShelfLifeDays: 6,
        village: 'Dharmavaram',
        district: 'Anantapur',
        state: 'Andhra Pradesh',
        pinCode: '515671',
        isOrganicCertified: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.listing.availableQuantity).toBe(20);
    listingId = res.body.listing._id;

    const stockUpdate = await request(app)
      .put(`/api/crops/${listingId}`)
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({ availableQuantity: 25 });
    expect(stockUpdate.status).toBe(200);
    expect(stockUpdate.body.listing.availableQuantity).toBe(25);
  });

  it('2a. Should upload and remove managed images only for the owning farmer', async () => {
    const otherFarmerLogin = await request(app).post('/api/auth/login').send({
      email: 'ramesh.farmer@agriconnect.in',
      password: testSeedPassword,
    });
    expect(otherFarmerLogin.status).toBe(200);
    const otherFarmerToken = otherFarmerLogin.body.token;

    const unauthorizedUpload = await request(app)
      .post(`/api/crops/${listingId}/images`)
      .set('Authorization', `Bearer ${otherFarmerToken}`)
      .attach('image', Buffer.from([0xff, 0xd8, 0xff, 0x00]), { filename: 'crop.jpg', contentType: 'image/jpeg' });
    expect(unauthorizedUpload.status).toBe(404);

    vi.stubEnv('CLOUDINARY_CLOUD_NAME', 'test-cloud');
    vi.stubEnv('CLOUDINARY_API_KEY', 'test-api-key');
    vi.stubEnv('CLOUDINARY_API_SECRET', 'test-api-secret');
    const providerFetch = vi.fn(async (input: string | URL | Request) => {
      const isDelete = String(input).includes('/image/destroy');
      return Response.json(isDelete
        ? { result: 'ok' }
        : { secure_url: 'https://images.example.test/crop.png', public_id: 'agriconnect/crops/test/crop', bytes: 16 });
    });
    vi.stubGlobal('fetch', providerFetch);

    try {
      const upload = await request(app)
        .post(`/api/crops/${listingId}/images`)
        .set('Authorization', `Bearer ${farmerToken}`)
        .attach('image', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]), {
          filename: 'crop.png',
          contentType: 'image/png',
        });
      expect(upload.status).toBe(201);
      expect(upload.body.image.url).toBe('https://images.example.test/crop.png');

      const remove = await request(app)
        .delete(`/api/crops/${listingId}/images`)
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ publicId: upload.body.image.publicId });
      expect(remove.status).toBe(200);
      expect((await CropListing.findById(listingId))?.imageAssets).toHaveLength(0);
      expect(providerFetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it('3. Should reject direct order creation without verified payment', async () => {
    const listingBefore = await CropListing.findById(listingId);
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        items: [{ listingId, quantity: 15 }],
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

    expect(orderRes.status).toBe(410);
    expect(orderRes.body.success).toBe(false);
    const updatedListing = await CropListing.findById(listingId);
    expect(updatedListing?.availableQuantity).toBe(listingBefore?.availableQuantity);
    expect(updatedListing?.reservedQuantity).toBe(listingBefore?.reservedQuantity);
  });

  it('4. Should keep legacy unauthenticated order submission disabled', async () => {
    const failedOrderRes = await request(app)
      .post('/api/orders')
      .send({
        items: [{ listingId, quantity: 1 }],
      });

    expect(failedOrderRes.status).toBe(401);
    expect(failedOrderRes.body.success).toBe(false);
  });

  it('5. Should protect admin endpoints and return platform financial analytics', async () => {
    // Unauthorized buyer trying to access admin analytics should be 403 Forbidden
    const forbiddenRes = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${buyerToken}`);
    expect(forbiddenRes.status).toBe(403);

    // Authorized admin
    const adminAnalyticsRes = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminAnalyticsRes.status).toBe(200);
    expect(adminAnalyticsRes.body.analytics.financials.gmvPaise).toBeGreaterThan(0);
    expect(adminAnalyticsRes.body.analytics.totalFarmers).toBeGreaterThanOrEqual(3);
  });

  it('6. Should report AI configuration without making an inference request', async () => {
    const status = await request(app).get('/api/ai/status');
    expect(status.status).toBe(200);
    expect(status.body.provider).toBe('xAI');
    expect(typeof status.body.configured).toBe('boolean');

    const invalidPrompt = await request(app).post('/api/ai/advisor').send({ prompt: '   ' });
    expect(invalidPrompt.status).toBe(400);
    expect(invalidPrompt.body.code).toBe('INVALID_REQUEST');
  });

  it('7. Should validate configured delivery zones without inventing coverage', async () => {
    await ServiceZone.deleteMany({});

    const unconfiguredRes = await request(app)
      .get('/api/serviceability')
      .query({ city: 'Hyderabad', state: 'Telangana', pinCode: '500081' });
    expect(unconfiguredRes.status).toBe(200);
    expect(unconfiguredRes.body.configured).toBe(false);
    expect(unconfiguredRes.body.serviceable).toBe(true);

    await ServiceZone.create({
      name: 'Hyderabad Central',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCodes: ['500081'],
      active: true,
      fulfilmentMethods: ['supplier_delivery'],
    });

    const supportedRes = await request(app)
      .get('/api/serviceability')
      .query({ city: 'Hyderabad', state: 'Telangana', pinCode: '500081' });
    expect(supportedRes.body.serviceable).toBe(true);

    const unsupportedRes = await request(app)
      .get('/api/serviceability')
      .query({ city: 'Hyderabad', state: 'Telangana', pinCode: '500082' });
    expect(unsupportedRes.status).toBe(200);
    expect(unsupportedRes.body.serviceable).toBe(false);

    await ServiceZone.deleteMany({});
  });

  it('8. Should reject admin self-registration and keep requested role access pending approval', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Untrusted Role User',
      email: `role-test-${Date.now()}@example.com`,
      password: 'StrongPassword123!',
      phone: '9123456789',
      role: 'admin',
    });

    expect(res.status).toBe(400);

    const customerRegistration = await request(app).post('/api/auth/register').send({
      name: 'Approved Later User',
      email: `approved-later-${Date.now()}@example.com`,
      password: 'StrongPassword123!',
      phone: '9123456789',
    });
    expect(customerRegistration.status).toBe(201);
    expect(customerRegistration.body.user.role).toBe('buyer');

    const roleRequest = await request(app).post('/api/auth/register').send({
      name: 'Farmer Applicant',
      email: `farmer-request-${Date.now()}@example.com`,
      password: 'StrongPassword123!',
      phone: '9123456789',
      role: 'farmer',
      farm: { farmName: 'Applicant Farm', village: 'Test Village', district: 'Test District', state: 'Test State', pinCode: '123456' },
    });
    expect(roleRequest.status).toBe(201);
    expect(roleRequest.body.user.role).toBe('buyer');
    expect(roleRequest.body.user.requestedRole).toBe('farmer');
    expect(roleRequest.body.user.requestedFarm.farmName).toBe('Applicant Farm');
    expect(roleRequest.body.user.status).toBe('pending_verification');

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@agriconnect.in',
      password: testSeedPassword,
    });
    const pendingApplicants = await request(app)
      .get('/api/admin/users?requestedRole=requested&status=pending_verification')
      .set('Authorization', `Bearer ${adminLogin.body.token}`);
    expect(pendingApplicants.status).toBe(200);
    expect(pendingApplicants.body.users.some((user: { _id: string; requestedRole: string }) =>
      user._id === roleRequest.body.user.id && user.requestedRole === 'farmer'
    )).toBe(true);

    const approval = await request(app)
      .patch(`/api/admin/users/${roleRequest.body.user.id}/role`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({
        role: 'farmer',
        farm: roleRequest.body.user.requestedFarm,
      });
    expect(approval.status).toBe(200);
    expect(approval.body.user.role).toBe('farmer');
    expect(approval.body.user.requestedRole).toBeUndefined();
    expect(approval.body.user.status).toBe('active');

    const manualApproval = await request(app)
      .patch(`/api/admin/users/${customerRegistration.body.user.id}/role`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ role: 'logistics' });
    expect(manualApproval.status).toBe(200);
    expect(manualApproval.body.user.role).toBe('logistics');
  });

  it('9. Should allow admin assignment and only the assigned driver to complete delivery', async () => {
    const buyer = await User.findOne({ email: 'buyer@agriconnect.in' });
    const farmer = await User.findOne({ email: 'farmer@agriconnect.in' });
    const listing = await CropListing.findOne({ farmerId: farmer?._id, status: 'active' });
    expect(buyer).toBeDefined();
    expect(farmer).toBeDefined();
    expect(listing).toBeDefined();

    const order = await Order.create({
      orderNumber: `SEC-${Date.now()}`,
      buyerId: buyer!._id,
      buyerName: buyer!.name,
      buyerRole: buyer!.role,
      buyerPhone: buyer!.phone,
      items: [{
        listingId: listing!._id,
        cropName: listing!.cropName,
        unit: listing!.unit,
        quantity: 1,
        unitPricePaise: listing!.pricePerUnitPaise,
        totalPaise: listing!.pricePerUnitPaise,
        farmerId: farmer!._id,
        farmerName: farmer!.name,
        farmLocation: `${listing!.location.district}, ${listing!.location.state}`,
        qualityGrade: listing!.qualityGrade,
      }],
      pricing: { grossProductValuePaise: 2500, farmerPayoutPaise: 2250, platformCommissionPaise: 200, operationsReservePaise: 50, deliveryFeePaise: 0, finalPayablePaise: 2500 },
      deliveryAddress: { recipientName: buyer!.name, phone: buyer!.phone, addressLine1: 'Farm road', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', pinCode: '500081' },
      deliverySlot: { date: new Date().toISOString().slice(0, 10), timeWindow: '07:00 AM - 11:00 AM' },
      status: 'ready_for_pickup',
      statusHistory: [{ status: 'ready_for_pickup', timestamp: new Date(), role: 'farmer' }],
      payment: { status: 'pending', gateway: 'cod_verified' },
    });

    const buyerLogin = await request(app).post('/api/auth/login').send({ email: buyer!.email, password: testSeedPassword });
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@agriconnect.in', password: testSeedPassword });
    const logisticsLogin = await request(app).post('/api/auth/login').send({
      email: 'logistics@agriconnect.in',
      password: testSeedPassword,
    });
    expect(logisticsLogin.status).toBe(200);
    let deliveryAgentToken = logisticsLogin.body.token;
    const agent = await User.findOne({ email: 'logistics@agriconnect.in' });
    const secondAgent = await User.findOne({ role: 'logistics', email: /^approved-later-/ });
    expect(secondAgent).toBeDefined();
    const secondAgentLogin = await request(app).post('/api/auth/login').send({
      email: secondAgent!.email,
      password: 'StrongPassword123!',
    });
    expect(secondAgentLogin.status).toBe(200);

    const deniedAssignment = await request(app)
      .post(`/api/admin/orders/${order!._id}/assign-delivery`)
      .set('Authorization', `Bearer ${buyerLogin.body.token}`)
      .send({ deliveryAgentId: agent!._id.toString() });
    expect(deniedAssignment.status).toBe(403);

    const unassignedClaim = await request(app)
      .post(`/api/logistics/claim/${order._id}`)
      .set('Authorization', `Bearer ${deliveryAgentToken}`);
    expect(unassignedClaim.status).toBe(409);

    const assignment = await request(app)
      .post(`/api/admin/orders/${order!._id}/assign-delivery`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ deliveryAgentId: agent!._id.toString() });
    expect(assignment.status).toBe(200);
    expect(assignment.body.order.logistics.assignmentHistory).toHaveLength(1);

    const reassign = await request(app)
      .post(`/api/admin/orders/${order!._id}/assign-delivery`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ deliveryAgentId: secondAgent!._id.toString() });
    expect(reassign.status).toBe(200);
    expect(reassign.body.order.logistics.assignmentHistory).toHaveLength(2);

    const farmerOrders = await request(app)
      .get('/api/orders/farmer')
      .set('Authorization', `Bearer ${farmerToken}`);
    const farmerOrder = farmerOrders.body.orders.find((entry: { _id: string }) => entry._id === order.id);
    expect(farmerOrder.items).toHaveLength(1);
    expect(farmerOrder.buyerPhone).toBeUndefined();
    expect(farmerOrder.deliveryAddress.phone).toBeUndefined();
    expect(farmerOrder.deliveryAddress.addressLine1).toBeUndefined();

    const unrelatedFarmerLogin = await request(app).post('/api/auth/login').send({
      email: 'ramesh.farmer@agriconnect.in',
      password: testSeedPassword,
    });
    const unrelatedOrderView = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Authorization', `Bearer ${unrelatedFarmerLogin.body.token}`);
    expect(unrelatedOrderView.status).toBe(403);

    const staleAgentClaim = await request(app)
      .post(`/api/logistics/claim/${order._id}`)
      .set('Authorization', `Bearer ${deliveryAgentToken}`);
    expect(staleAgentClaim.status).toBe(409);

    const pickup = await request(app)
      .post(`/api/logistics/claim/${order._id}`)
      .set('Authorization', `Bearer ${secondAgentLogin.body.token}`);
    expect(pickup.status).toBe(200);
    expect(pickup.body.order.status).toBe('picked_up');

    const dispatch = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${secondAgentLogin.body.token}`)
      .send({ status: 'out_for_delivery' });
    expect(dispatch.status).toBe(200);

    const staleAgentCompletion = await request(app)
      .post(`/api/logistics/complete/${order._id}`)
      .set('Authorization', `Bearer ${deliveryAgentToken}`)
      .send({ recipientSignature: 'Recipient confirmed' });
    expect(staleAgentCompletion.status).toBe(403);

    const directDeliveredStatus = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${secondAgentLogin.body.token}`)
      .send({ status: 'delivered' });
    expect(directDeliveredStatus.status).toBe(403);
    deliveryAgentToken = secondAgentLogin.body.token;

    const completion = await request(app)
      .post(`/api/logistics/complete/${order._id}`)
      .set('Authorization', `Bearer ${secondAgentLogin.body.token}`)
      .send({ recipientSignature: 'Recipient confirmed' });
    expect(completion.status).toBe(400);

    const cashCompletion = await request(app)
      .post(`/api/logistics/complete/${order._id}`)
      .set('Authorization', `Bearer ${deliveryAgentToken}`)
      .send({ recipientSignature: 'Recipient confirmed', cashCollected: true });
    expect(cashCompletion.status).toBe(200);
    expect(cashCompletion.body.order.status).toBe('delivered');
    expect(cashCompletion.body.order.payment.status).toBe('captured');
    expect(cashCompletion.body.order.payment.cashCollectedAt).toBeDefined();
    const codPayout = await PayoutLedger.findOne({ orderId: order._id, entryType: 'sale' });
    expect(codPayout?.settlementStatus).toBe('on_hold');
    expect(codPayout?.automaticPayoutEligibleAt).toBeUndefined();
    const farmerPayouts = await request(app)
      .get('/api/payouts/my-ledger')
      .set('Authorization', `Bearer ${farmerToken}`);
    const expectedPending = farmerPayouts.body.ledgers
      .filter((ledger: { settlementStatus: string }) => ['accrued', 'processing', 'on_hold'].includes(ledger.settlementStatus))
      .reduce((sum: number, ledger: { farmerPayoutPaise: number }) => sum + ledger.farmerPayoutPaise, 0);
    expect(farmerPayouts.body.summary.pendingSettlementPaise).toBe(expectedPending);
  });

  it('10. Should prevent manual confirmation and refunds before provider payment capture', async () => {
    const buyer = await User.findOne({ email: 'buyer@agriconnect.in' });
    const order = await Order.create({
      orderNumber: `REF-${Date.now()}`,
      buyerId: buyer!._id,
      buyerName: buyer!.name,
      buyerRole: buyer!.role,
      buyerPhone: buyer!.phone,
      items: [],
      pricing: { grossProductValuePaise: 1000, farmerPayoutPaise: 900, platformCommissionPaise: 80, operationsReservePaise: 20, deliveryFeePaise: 0, finalPayablePaise: 1000 },
      deliveryAddress: { recipientName: buyer!.name, phone: buyer!.phone, addressLine1: 'Address', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', pinCode: '500081' },
      deliverySlot: { date: new Date().toISOString().slice(0, 10), timeWindow: '07:00 AM - 11:00 AM' },
      status: 'pending_payment',
      statusHistory: [{ status: 'pending_payment', timestamp: new Date(), role: 'buyer' }],
      payment: { status: 'pending', gateway: 'razorpay_standard' },
    });
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@agriconnect.in', password: testSeedPassword });
    const invalidConfirmation = await request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ status: 'confirmed' });
    expect(invalidConfirmation.status).toBe(409);
    expect(invalidConfirmation.body.message).toContain('payment is captured');

    const result = await request(app)
      .post(`/api/admin/orders/${order._id}/refund`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ reason: 'Customer requested cancellation', idempotencyKey: `refund-test-${Date.now()}-key` });
    expect(result.status).toBe(409);
  });

  it('11. Should queue order email once and not send when Resend is unconfigured', async () => {
    const orderId = new Order()._id.toString();
    const eventKey = `order-confirmation:${orderId}`;
    await queueOrderConfirmation(orderId);
    await queueOrderConfirmation(orderId);
    expect(await EmailOutbox.countDocuments({ eventKey })).toBe(1);
    const updateKey = `order-update:${orderId}:status:delivered`;
    const { queueOrderUpdate } = await import('../services/email.js');
    await queueOrderUpdate(orderId, 'status:delivered', 'Order delivered.');
    await queueOrderUpdate(orderId, 'status:delivered', 'Order delivered.');
    expect(await EmailOutbox.countDocuments({ eventKey: updateKey })).toBe(1);

    const priorApiKey = process.env.RESEND_API_KEY;
    const priorFrom = process.env.RESEND_FROM_EMAIL;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    expect(await processEmailOutbox()).toBe(0);
    process.env.RESEND_API_KEY = priorApiKey;
    process.env.RESEND_FROM_EMAIL = priorFrom;
    await EmailOutbox.deleteOne({ eventKey });
    await EmailOutbox.deleteOne({ eventKey: updateKey });
  });
});
