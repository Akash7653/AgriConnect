import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { CropListing } from '../models/CropListing.js';
import { seedDatabase } from '../scripts/seed.js';

beforeAll(async () => {
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
      password: 'AgriConnect2026!',
    });
    expect(farmerRes.status).toBe(200);
    expect(farmerRes.body.success).toBe(true);
    expect(farmerRes.body.user.role).toBe('farmer');
    farmerToken = farmerRes.body.token;

    // Buyer Login
    const buyerRes = await request(app).post('/api/auth/login').send({
      email: 'buyer@agriconnect.in',
      password: 'AgriConnect2026!',
    });
    expect(buyerRes.status).toBe(200);
    expect(buyerRes.body.user.role).toBe('buyer');
    buyerToken = buyerRes.body.token;

    // Admin Login
    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@agriconnect.in',
      password: 'AgriConnect2026!',
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

  it('3. Should verify transparent pricing and concurrency-safe stock reservation', async () => {
    // Buyer purchases 15 kg out of 20 kg available
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
        paymentMethod: 'upi_instant',
      });

    expect(orderRes.status).toBe(201);
    const order = orderRes.body.order;

    // Check pricing: 15 * 4500 = 67500 paise (₹675.00)
    expect(order.pricing.grossProductValuePaise).toBe(67500);
    // Farmer 90%: 67500 * 0.90 = 60750 paise
    expect(order.pricing.farmerPayoutPaise).toBe(60750);
    // Platform 8%: 67500 * 0.08 = 5400 paise
    expect(order.pricing.platformCommissionPaise).toBe(5400);
    // Ops Reserve 2%: 67500 * 0.02 = 1350 paise
    expect(order.pricing.operationsReservePaise).toBe(1350);

    // Verify stock has decreased atomically from 20 to 5
    const updatedListing = await CropListing.findById(listingId);
    expect(updatedListing?.availableQuantity).toBe(5);
    expect(updatedListing?.reservedQuantity).toBe(15);
  });

  it('4. Should reject overselling when requested quantity exceeds available stock', async () => {
    // Available is now 5 kg. Attempt to buy 10 kg.
    const failedOrderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        items: [{ listingId, quantity: 10 }],
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

    // Expect 409 Conflict due to atomic reservation check failure
    expect(failedOrderRes.status).toBe(409);
    expect(failedOrderRes.body.success).toBe(false);

    // Verify stock remains untouched at 5 kg
    const checkListing = await CropListing.findById(listingId);
    expect(checkListing?.availableQuantity).toBe(5);
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
    expect(aiTeRes.body.response).toContain('AgriConnect');

    const aiHiRes = await request(app)
      .post('/api/ai/advisor')
      .send({ prompt: 'टमाटर का मंडी भाव क्या है?', language: 'hi' });
    expect(aiHiRes.status).toBe(200);
    expect(aiHiRes.body.success).toBe(true);
    expect(aiHiRes.body.response).toContain('AgriConnect');
  });
});
