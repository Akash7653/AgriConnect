import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { CropListing } from '../models/CropListing.js';
import { ServiceZone } from '../models/ServiceZone.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { seedDatabase } from '../scripts/seed.js';
import { randomBytes } from 'crypto';

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

  it('6. Should provide multilingual AI advisor response in Telugu and Hindi', async () => {
    const aiTeRes = await request(app)
      .post('/api/ai/advisor')
      .send({ prompt: 'టమోటా ధరల వివరాలు ఏమిటి?', language: 'te' });
    expect(aiTeRes.status).toBe(200);
    expect(aiTeRes.body.success).toBe(true);
    expect(aiTeRes.body.response.length).toBeGreaterThan(20);

    const aiHiRes = await request(app)
      .post('/api/ai/advisor')
      .send({ prompt: 'टमाटर का मंडी भाव क्या है?', language: 'hi' });
    expect(aiHiRes.status).toBe(200);
    expect(aiHiRes.body.success).toBe(true);
    expect(aiHiRes.body.response.length).toBeGreaterThan(20);
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

  it('8. Should ignore a client-supplied elevated role during registration', async () => {
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

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@agriconnect.in',
      password: testSeedPassword,
    });
    const approval = await request(app)
      .patch(`/api/admin/users/${customerRegistration.body.user.id}/role`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ role: 'logistics' });
    expect(approval.status).toBe(200);
    expect(approval.body.user.role).toBe('logistics');
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
      payment: { status: 'captured', gateway: 'razorpay_standard' },
    });

    const buyerLogin = await request(app).post('/api/auth/login').send({ email: buyer!.email, password: testSeedPassword });
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@agriconnect.in', password: testSeedPassword });
    const logisticsLogin = await request(app).post('/api/auth/login').send({
      email: 'logistics@agriconnect.in',
      password: testSeedPassword,
    });
    expect(logisticsLogin.status).toBe(200);
    const deliveryAgentToken = logisticsLogin.body.token;
    const agent = await User.findOne({ email: 'logistics@agriconnect.in' });

    const deniedAssignment = await request(app)
      .post(`/api/admin/orders/${order!._id}/assign-delivery`)
      .set('Authorization', `Bearer ${buyerLogin.body.token}`)
      .send({ deliveryAgentId: agent!._id.toString() });
    expect(deniedAssignment.status).toBe(403);

    const assignment = await request(app)
      .post(`/api/admin/orders/${order!._id}/assign-delivery`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ deliveryAgentId: agent!._id.toString() });
    expect(assignment.status).toBe(200);

    const pickup = await request(app)
      .post(`/api/logistics/claim/${order._id}`)
      .set('Authorization', `Bearer ${deliveryAgentToken}`);
    expect(pickup.status).toBe(200);
    expect(pickup.body.order.status).toBe('picked_up');

    const completion = await request(app)
      .post(`/api/logistics/complete/${order._id}`)
      .set('Authorization', `Bearer ${deliveryAgentToken}`)
      .send({ recipientSignature: 'Recipient confirmed' });
    expect(completion.status).toBe(200);
    expect(completion.body.order.status).toBe('delivered');
  });
});
