import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { CropListing } from '../models/CropListing.js';
import { ServiceZone } from '../models/ServiceZone.js';
import { Order, buildSellerFulfilments } from '../models/Order.js';
import { User } from '../models/User.js';
import { PayoutLedger } from '../models/PayoutLedger.js';
import { seedDatabase } from '../scripts/seed.js';
import { createHash, randomBytes } from 'crypto';
import { EmailOutbox } from '../models/EmailOutbox.js';
import { queueOrderConfirmation, processEmailOutbox } from '../services/email.js';
import bcrypt from 'bcryptjs';
import { AuditLog } from '../models/AuditLog.js';
import { BuyerProfile } from '../models/BuyerProfile.js';
import { PendingSignup } from '../models/PendingSignup.js';
import { signToken } from '../middleware/auth.js';
import { ensureTelanganaServiceZone } from '../services/defaultServiceZones.js';

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

  it('1a. Should issue a generic password reset response and consume a reset token once', async () => {
    const email = `password-reset-${randomBytes(8).toString('hex')}@example.test`;
    const initialPassword = 'InitialAdminPassword123!';
    const nextPassword = 'NewAdminPassword456!';
    const user = await User.create({
      name: 'Password Reset Test Admin',
      email,
      passwordHash: await bcrypt.hash(initialPassword, 12),
      role: 'admin',
      phone: '9123456789',
      isVerified: true,
      status: 'active',
    });
    const previousApiKey = process.env.RESEND_API_KEY;
    const previousFrom = process.env.RESEND_FROM_EMAIL;
    const previousClientUrl = process.env.CLIENT_URL;
    let emailPayload: { text: string } | undefined;
    const emailFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      emailPayload = JSON.parse(String(init?.body)) as { text: string };
      return Response.json({ id: 'reset-email-test' });
    });
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'AgriConnect <support@example.test>');
    vi.stubEnv('CLIENT_URL', 'http://localhost:3000');
    vi.stubGlobal('fetch', emailFetch);

    try {
      const requestReset = await request(app)
        .post('/api/auth/password-reset/request')
        .send({ email });
      expect(requestReset.status).toBe(202);
      expect(emailFetch).toHaveBeenCalledTimes(1);

      const resetLink = emailPayload?.text.match(/https?:\/\/\S+/)?.[0];
      expect(resetLink).toBeTruthy();
      const resetToken = new URL(resetLink!).hash.slice(1);
      const decodedToken = new URLSearchParams(resetToken).get('token');
      expect(decodedToken).toBeTruthy();
      const storedResetHash = await User.findById(user._id).select('+passwordResetTokenHash');
      expect(storedResetHash?.passwordResetTokenHash).not.toBe(decodedToken);

      const completed = await request(app)
        .post('/api/auth/password-reset/confirm')
        .send({ token: decodedToken, password: nextPassword });
      expect(completed.status).toBe(200);
      expect((await User.findById(user._id))?.passwordResetTokenHash).toBeUndefined();

      const reusedToken = await request(app)
        .post('/api/auth/password-reset/confirm')
        .send({ token: decodedToken, password: 'AnotherAdminPassword789!' });
      expect(reusedToken.status).toBe(400);

      const oldLogin = await request(app).post('/api/auth/login').send({ email, password: initialPassword });
      expect(oldLogin.status).toBe(401);
      const newLogin = await request(app).post('/api/auth/login').send({ email, password: nextPassword });
      expect(newLogin.status).toBe(200);

      const unknownEmail = await request(app)
        .post('/api/auth/password-reset/request')
        .send({ email: `missing-${randomBytes(8).toString('hex')}@example.test` });
      expect(unknownEmail.status).toBe(requestReset.status);
      expect(unknownEmail.body.message).toBe(requestReset.body.message);
    } finally {
      await AuditLog.deleteMany({ userId: user._id, action: 'PASSWORD_RESET_COMPLETED' });
      await User.deleteOne({ _id: user._id });
      vi.unstubAllGlobals();
      if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = previousApiKey;
      if (previousFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
      else process.env.RESEND_FROM_EMAIL = previousFrom;
      if (previousClientUrl === undefined) delete process.env.CLIENT_URL;
      else process.env.CLIENT_URL = previousClientUrl;
    }
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

    const listingEdit = await request(app)
      .put(`/api/crops/${listingId}`)
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({
        cropName: 'Organic Shimla Green Capsicum',
        category: 'Vegetables',
        description: 'Crisp green capsicum grown under naturally ventilated polyhouse.',
        pricePerUnitPaise: 4500,
        unit: 'crate',
        availableQuantity: 25,
        minOrderQuantity: 1,
        harvestDate: new Date().toISOString(),
        status: 'active',
        village: 'Dharmavaram',
        district: 'Anantapur',
        state: 'Andhra Pradesh',
        pinCode: '515671',
      });
    expect(listingEdit.status).toBe(200);
    expect(listingEdit.body.listing.unit).toBe('crate');
  });

  it('2b. Should prevent unapproved farmers from publishing products', async () => {
    const unapprovedFarmer = await User.create({
      name: 'Unapproved Farmer',
      email: `unapproved-farmer-${randomBytes(8).toString('hex')}@example.test`,
      passwordHash: 'not-used-by-this-test',
      role: 'farmer',
      isVerified: false,
      status: 'pending_verification',
    });
    try {
      const response = await request(app)
        .post('/api/crops')
        .set('Authorization', `Bearer ${signToken(unapprovedFarmer)}`)
        .send({
          cropName: 'Test Tomatoes',
          category: 'Vegetables',
          description: 'Tomatoes grown for the approval enforcement test.',
          pricePerUnitPaise: 1000,
          availableQuantity: 10,
          harvestDate: new Date().toISOString(),
          village: 'Test Village',
          district: 'Test District',
          state: 'Test State',
          pinCode: '123456',
        });
      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/approved, active farmers/i);
    } finally {
      await User.deleteOne({ _id: unapprovedFarmer._id });
    }
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

  it('2b. Should persist and serve product images through MongoDB when Cloudinary is not configured', async () => {
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', '');
    vi.stubEnv('CLOUDINARY_API_KEY', '');
    vi.stubEnv('CLOUDINARY_API_SECRET', '');
    const imageBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

    try {
      const upload = await request(app)
        .post(`/api/crops/${listingId}/images`)
        .set('Authorization', `Bearer ${farmerToken}`)
        .attach('image', imageBuffer, { filename: 'crop.png', contentType: 'image/png' });
      expect(upload.status).toBe(201);
      expect(upload.body.image.publicId).toMatch(/^gridfs:[a-f\d]{24}$/i);

      const imageUrl = new URL(upload.body.image.url);
      const download = await request(app).get(imageUrl.pathname);
      expect(download.status).toBe(200);
      expect(download.headers['content-type']).toContain('image/png');
      expect(download.body).toEqual(imageBuffer);

      const remove = await request(app)
        .delete(`/api/crops/${listingId}/images`)
        .set('Authorization', `Bearer ${farmerToken}`)
        .send({ publicId: upload.body.image.publicId });
      expect(remove.status).toBe(200);
      expect((await request(app).get(imageUrl.pathname)).status).toBe(404);
    } finally {
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
    expect(unconfiguredRes.body.serviceable).toBeNull();
    const invalidPinRes = await request(app)
      .get('/api/serviceability')
      .query({ city: 'Hyderabad', state: 'Telangana', pinCode: '50008' });
    expect(invalidPinRes.status).toBe(400);

    await ServiceZone.create({
      name: 'Hyderabad Central',
      city: 'Hyderabad',
      state: 'Telangana',
      postalCodes: ['500081'],
      active: true,
      estimatedDeliveryDays: 2,
      fulfilmentMethods: ['supplier_delivery'],
    });

    const supportedRes = await request(app)
      .get('/api/serviceability')
      .query({ city: 'Hyderabad', state: 'Telangana', pinCode: '500081' });
    expect(supportedRes.body.serviceable).toBe(true);
    expect(supportedRes.body.zone.estimatedDeliveryDays).toBe(2);

    const unsupportedRes = await request(app)
      .get('/api/serviceability')
      .query({ city: 'Hyderabad', state: 'Telangana', pinCode: '500082' });
    expect(unsupportedRes.status).toBe(200);
    expect(unsupportedRes.body.serviceable).toBe(false);

    await ServiceZone.deleteMany({});
    await ensureTelanganaServiceZone();
    await ensureTelanganaServiceZone();

    const statewidePrefixRes = await request(app)
      .get('/api/serviceability')
      .query({ city: 'Medchal', state: 'Telangana', pinCode: '501401' });
    expect(statewidePrefixRes.body).toMatchObject({
      configured: true,
      serviceable: true,
      zone: {
        name: 'Telangana Statewide',
        deliveryFeePaise: 0,
        freeDeliveryThresholdPaise: 0,
        estimatedDeliveryDaysMin: 1,
        estimatedDeliveryDaysMax: 3,
      },
    });

    const otherTelanganaPinRes = await request(app)
      .get('/api/serviceability')
      .query({ city: 'Hyderabad', state: 'Telangana', pinCode: '500099' });
    expect(otherTelanganaPinRes.body.serviceable).toBe(true);
    expect(await ServiceZone.countDocuments({ name: 'Telangana Statewide' })).toBe(1);
    await ServiceZone.deleteMany({});
  });

  it('8. Should return only valid, currently active storefront campaigns', async () => {
    const previousCampaigns = process.env.STOREFRONT_CAMPAIGNS_JSON;
    const now = Date.now();
    process.env.STOREFRONT_CAMPAIGNS_JSON = JSON.stringify([
      {
        id: 'active-campaign',
        title: 'Current vegetable campaign',
        description: 'Browse this configured vegetable campaign.',
        imageUrl: 'https://cdn.example.test/vegetables.webp',
        category: 'vegetables',
        ctaLabel: 'Browse vegetables',
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + 60_000).toISOString(),
      },
      {
        id: 'expired-campaign',
        title: 'Expired campaign',
        description: 'This campaign is no longer active.',
        imageUrl: 'https://cdn.example.test/expired.webp',
        category: 'fruits',
        ctaLabel: 'Browse fruits',
        endsAt: new Date(now - 60_000).toISOString(),
      },
    ]);

    try {
      const activeResponse = await request(app).get('/api/storefront/campaigns');
      expect(activeResponse.status).toBe(200);
      expect(activeResponse.body.campaigns).toHaveLength(1);
      expect(activeResponse.body.campaigns[0].id).toBe('active-campaign');

      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        process.env.STOREFRONT_CAMPAIGNS_JSON = 'not-json';
        const invalidResponse = await request(app).get('/api/storefront/campaigns');
        expect(invalidResponse.status).toBe(500);
        expect(invalidResponse.body.campaigns).toBeUndefined();
        expect(logSpy).toHaveBeenCalledWith('[storefront] Invalid STOREFRONT_CAMPAIGNS_JSON configuration');
      } finally {
        logSpy.mockRestore();
      }
    } finally {
      if (previousCampaigns === undefined) delete process.env.STOREFRONT_CAMPAIGNS_JSON;
      else process.env.STOREFRONT_CAMPAIGNS_JSON = previousCampaigns;
    }
  });

  it('8a. Should expose only public-safe active product data for the mobile storefront', async () => {
    const response = await request(app).get('/api/storefront/products').query({ limit: 24 });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.listings.length).toBeGreaterThan(0);
    for (const listing of response.body.listings) {
      expect(listing.farmerId.name).toBeTruthy();
      expect(listing.farmerId.phone).toBeUndefined();
    }
    expect(response.headers['cache-control']).toContain('max-age=30');
  });

  it('9. Should distinguish invalid coordinates and incomplete or unavailable geocoding results', async () => {
    const { clearGeocodingCacheForTests } = await import('../services/geocoding.js');
    clearGeocodingCacheForTests();
    const previousProvider = process.env.GEOCODING_PROVIDER;
    process.env.GEOCODING_PROVIDER = 'nominatim';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        address: {
          suburb: 'Test Suburb',
          county: 'Test District',
          state: 'Test State',
        },
        display_name: 'Test Suburb, Test State',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(Response.json({ features: [] }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        address: {
          city: 'Test City',
          county: 'Test District',
          state: 'Test State',
          postcode: '123456',
          country: 'India',
        },
        display_name: 'Test City, Test State',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const invalidCoordinates = await request(app)
        .post('/api/location/reverse-geocode')
        .send({ latitude: 120, longitude: 80 });
      expect(invalidCoordinates.status).toBe(400);

      const incompleteAddress = await request(app)
        .post('/api/location/reverse-geocode')
        .send({ latitude: 18.5, longitude: 73.8 });
      expect(incompleteAddress.status).toBe(422);
      expect(incompleteAddress.body.message).toMatch(/enter your city and PIN code manually/i);

      const compatibleCoordinates = await request(app)
        .post('/api/location/reverse-geocode')
        .send({ lat: 18.5, lon: 73.8, accuracy: 20 });
      expect(compatibleCoordinates.status).toBe(200);
      expect(compatibleCoordinates.body.address.pinCode).toBe('123456');

      clearGeocodingCacheForTests();
      const providerUnavailable = await request(app)
        .post('/api/location/reverse-geocode')
        .send({ latitude: 18.6, longitude: 73.8 });
      expect(providerUnavailable.status).toBe(502);
      expect(providerUnavailable.body.message).toMatch(/temporarily unavailable/i);
    } finally {
      vi.unstubAllGlobals();
      if (previousProvider === undefined) delete process.env.GEOCODING_PROVIDER;
      else process.env.GEOCODING_PROVIDER = previousProvider;
    }
  });

  it('9b. Categorizes geocoding rate limits, timeouts, network failures, and malformed results', async () => {
    const { clearGeocodingCacheForTests } = await import('../services/geocoding.js');
    clearGeocodingCacheForTests();
    const previousProvider = process.env.GEOCODING_PROVIDER;
    process.env.GEOCODING_PROVIDER = 'nominatim';
    const warningLog = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '2', 'x-request-id': 'geo-rate-limit-1' } }))
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '2', 'x-request-id': 'geo-rate-limit-2' } }))
      .mockRejectedValueOnce(Object.assign(new Error('provider timeout'), { name: 'TimeoutError' }))
      .mockRejectedValueOnce(Object.assign(new Error('provider timeout'), { name: 'TimeoutError' }))
      .mockRejectedValueOnce(new Error('network disconnected'))
      .mockRejectedValueOnce(new Error('network disconnected'))
      .mockResolvedValueOnce(new Response('not-json', { status: 200 }))
      .mockResolvedValueOnce(new Response('not-json', { status: 200 }))
      .mockResolvedValueOnce(Response.json({ address: {} }));
    fetchMock.mockResolvedValueOnce(Response.json({ features: [] }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const rateLimited = await request(app)
        .post('/api/location/reverse-geocode')
        .send({ latitude: 18.5, longitude: 73.8 });
      expect(rateLimited.status).toBe(503);
      expect(rateLimited.body.code).toBe('LOCATION_RATE_LIMITED');
      expect(rateLimited.headers['retry-after']).toBe('2');
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const timedOut = await request(app)
        .post('/api/location/reverse-geocode')
        .send({ latitude: 18.5, longitude: 73.8 });
      expect(timedOut.status).toBe(502);
      expect(timedOut.body.code).toBe('LOCATION_TIMEOUT');
      expect(fetchMock).toHaveBeenCalledTimes(4);

      const networkFailure = await request(app)
        .post('/api/location/reverse-geocode')
        .send({ latitude: 18.5, longitude: 73.8 });
      expect(networkFailure.status).toBe(502);
      expect(networkFailure.body.code).toBe('LOCATION_NETWORK_ERROR');
      expect(fetchMock).toHaveBeenCalledTimes(6);

      const malformedResult = await request(app)
        .post('/api/location/reverse-geocode')
        .send({ latitude: 18.5, longitude: 73.8 });
      expect(malformedResult.status).toBe(502);
      expect(malformedResult.body.code).toBe('LOCATION_MALFORMED_RESPONSE');
      expect(fetchMock).toHaveBeenCalledTimes(8);

      const incompleteResult = await request(app)
        .post('/api/location/reverse-geocode')
        .send({ latitude: 18.5, longitude: 73.8 });
      expect(incompleteResult.status).toBe(422);
      expect(incompleteResult.body.code).toBe('LOCATION_INCOMPLETE_RESULT');
      expect(fetchMock).toHaveBeenCalledTimes(10);
    } finally {
      vi.unstubAllGlobals();
      warningLog.mockRestore();
      if (previousProvider === undefined) delete process.env.GEOCODING_PROVIDER;
      else process.env.GEOCODING_PROVIDER = previousProvider;
    }
  }, 15000);

  it('10. Should reject admin self-registration and keep requested role access pending approval', async () => {
    const createApplicant = async (payload: Record<string, unknown>) => {
      const response = await request(app).post('/api/auth/register').send(payload);
      expect(response.status).toBe(201);
      expect(response.body.token).toBeTruthy();
      return response;
    };

    const res = await request(app).post('/api/auth/register').send({
      name: 'Untrusted Role User',
      email: `role-test-${randomBytes(8).toString('hex')}@example.com`,
      password: 'StrongPassword123!',
      phone: '9123456789',
      role: 'admin',
    });

    expect(res.status).toBe(400);

    const customerRegistration = await createApplicant({
      name: 'Approved Later User',
      email: `approved-later-${randomBytes(8).toString('hex')}@example.com`,
      password: 'StrongPassword123!',
      phone: '9123456789',
    });
    expect(customerRegistration.body.user.role).toBe('buyer');

    const roleRequest = await createApplicant({
      name: 'Farmer Applicant',
      email: `farmer-request-${randomBytes(8).toString('hex')}@example.com`,
      password: 'StrongPassword123!',
      phone: '9123456789',
      role: 'farmer',
      farm: { farmName: 'Applicant Farm', village: 'Test Village', district: 'Test District', state: 'Test State', pinCode: '123456' },
    });
    expect(roleRequest.body.user.role).toBe('buyer');
    expect(roleRequest.body.user.requestedRole).toBe('farmer');
    expect(roleRequest.body.user.requestedFarm.farmName).toBe('Applicant Farm');
    expect(roleRequest.body.user.status).toBe('pending_verification');

    const additionalRoleRequests: Array<{ id: string; requestedRole: 'business' | 'logistics' }> = [];
    for (const requestedRole of ['business', 'logistics'] as const) {
      const response = await createApplicant({
        name: `${requestedRole} Applicant`,
        email: `${requestedRole}-request-${randomBytes(8).toString('hex')}@example.com`,
        password: 'StrongPassword123!',
        phone: '9123456789',
        role: requestedRole,
      });
      expect(response.body.user.role).toBe('buyer');
      expect(response.body.user.requestedRole).toBe(requestedRole);
      expect(response.body.user.status).toBe('pending_verification');
      additionalRoleRequests.push(response.body.user);
    }

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
    for (const applicant of additionalRoleRequests) {
      expect(pendingApplicants.body.users.some((user: { _id: string; requestedRole: string }) =>
        user._id === applicant.id && user.requestedRole === applicant.requestedRole
      )).toBe(true);
    }

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

    for (const applicant of additionalRoleRequests) {
      const roleApproval = await request(app)
        .patch(`/api/admin/users/${applicant.id}/role`)
        .set('Authorization', `Bearer ${adminLogin.body.token}`)
        .send({ role: applicant.requestedRole });
      expect(roleApproval.status).toBe(200);
      expect(roleApproval.body.user.role).toBe(applicant.requestedRole);
      expect(roleApproval.body.user.requestedRole).toBeUndefined();
      expect(roleApproval.body.user.status).toBe('active');
    }

    const manualApproval = await request(app)
      .patch(`/api/admin/users/${customerRegistration.body.user.id}/role`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ role: 'logistics' });
    expect(manualApproval.status).toBe(200);
    expect(manualApproval.body.user.role).toBe('logistics');
    const manuallyApprovedUser = await User.findById(customerRegistration.body.user.id);
    expect(manuallyApprovedUser?.emailVerified).toBe(true);
  });

  it('10b. Does not require phone or email delivery configuration for signup', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'brevo');
    vi.stubEnv('BREVO_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', 'verify@example.test');
    vi.stubEnv('EMAIL_FROM_NAME', 'AgriConnect');
    const email = `verification-unconfigured-${randomBytes(8).toString('hex')}@example.test`;
    try {
      const response = await request(app).post('/api/auth/register').send({
        name: 'Unconfigured Verification User',
        email,
        password: 'VerificationPassword123!',
      });
      expect(response.status).toBe(201);
      expect(response.body.token).toBeTruthy();
      expect(await User.findOne({ email })).toBeTruthy();
      expect(await PendingSignup.findOne({ email })).toBeNull();
    } finally {
      const user = await User.findOne({ email });
      if (user) {
        await BuyerProfile.deleteMany({ userId: user._id });
        await AuditLog.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
      vi.unstubAllEnvs();
    }
  });

  it('10a. Creates an account without sending verification email', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('EMAIL_FROM_NAME', 'AgriConnect');
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    vi.stubEnv('EMAIL_FROM', 'verify@example.test');
    let emailBody = '';
    const providerFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).startsWith('https://api.resend.com/emails')) {
        emailBody = String(init?.body);
      }
      return Response.json({ id: 'verification-test' });
    });
    vi.stubGlobal('fetch', providerFetch);

    const email = `contact-verification-${randomBytes(8).toString('hex')}@example.test`;
    try {
      const registration = await request(app).post('/api/auth/register').send({
        name: 'Contact Verification User',
        email,
        password: 'VerificationPassword123!',
      });
      expect(registration.status).toBe(201);
      expect(registration.body.token).toBeTruthy();
      expect(registration.body.user.emailVerified).toBe(true);
      expect(await User.findOne({ email })).toBeTruthy();
      expect(await PendingSignup.findOne({ email })).toBeNull();

      const login = await request(app).post('/api/auth/login').send({
        email,
        password: 'VerificationPassword123!',
      });
      expect(login.status).toBe(200);
      expect(login.body.token).toBeTruthy();
      const authenticatedProfile = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${login.body.token}`);
      expect(authenticatedProfile.status).toBe(200);

      expect(providerFetch).not.toHaveBeenCalled();
    } finally {
      const user = await User.findOne({ email });
      if (user) {
        await BuyerProfile.deleteMany({ userId: user._id });
        await AuditLog.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
      await PendingSignup.deleteMany({ email });
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it('10c. Does not expose email verification endpoints for legacy accounts', async () => {
    const token = randomBytes(32).toString('base64url');
    const email = `expired-verification-${randomBytes(8).toString('hex')}@example.test`;
    const user = await User.create({
      name: 'Expired Verification User',
      email,
      passwordHash: await bcrypt.hash('VerificationPassword123!', 12),
      role: 'buyer',
      phone: '',
      emailVerified: false,
      emailVerificationTokenHash: createHash('sha256').update(token).digest('hex'),
      emailVerificationExpiresAt: new Date(Date.now() - 1000),
      isVerified: false,
      status: 'active',
    });
    try {
      const invalid = await request(app)
        .post('/api/auth/verification/email/confirm')
        .send({ token: randomBytes(32).toString('base64url') });
      const expired = await request(app)
        .post('/api/auth/verification/email/confirm')
        .send({ token });
      expect(invalid.status).toBe(404);
      expect(expired.status).toBe(404);
      expect(await User.findById(user._id)).toMatchObject({ emailVerified: false });
    } finally {
      await BuyerProfile.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    }
  });

  it('10d. Does not send or require verification email when registration email delivery is down', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    vi.stubEnv('EMAIL_FROM', 'verify@example.test');
    vi.stubEnv('EMAIL_FROM_NAME', 'AgriConnect');
    const providerFetch = vi.fn(async () => new Response('provider unavailable', { status: 503 }));
    vi.stubGlobal('fetch', providerFetch);
    const email = `verification-retry-${randomBytes(8).toString('hex')}@example.test`;
    try {
      const registration = await request(app).post('/api/auth/register').send({
        name: 'Retry Verification User',
        email,
        password: 'VerificationPassword123!',
      });
      expect(registration.status).toBe(201);
      expect(registration.body.token).toBeTruthy();
      expect(await User.findOne({ email })).toBeTruthy();

      const retry = await request(app).post('/api/auth/resend-otp').send({ email });
      expect(retry.status).toBe(404);
      expect(providerFetch).not.toHaveBeenCalled();
    } finally {
      const user = await User.findOne({ email });
      if (user) {
        await BuyerProfile.deleteMany({ userId: user._id });
        await AuditLog.deleteMany({ userId: user._id });
        await User.deleteOne({ _id: user._id });
      }
      await PendingSignup.deleteMany({ email });
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it('10e. Keeps legacy accounts with no stored email verification field accessible', async () => {
    const email = `legacy-verification-${randomBytes(8).toString('hex')}@example.test`;
    const password = 'LegacyAccountPassword123!';
    const user = await User.create({
      name: 'Legacy Verified User',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'buyer',
      phone: '',
      isVerified: true,
      status: 'active',
    });
    try {
      await User.updateOne({ _id: user._id }, { $unset: { emailVerified: 1 }, $set: { phoneVerified: false } });
      expect((await User.findById(user._id))?.emailVerified).toBe(true);

      const login = await request(app).post('/api/auth/login').send({ email, password });
      expect(login.status).toBe(200);
      const protectedProfile = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${login.body.token}`);
      expect(protectedProfile.status).toBe(200);
    } finally {
      await AuditLog.deleteMany({ userId: user._id });
      await BuyerProfile.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    }
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

    const buyerClaim = await request(app)
      .post(`/api/logistics/claim/${order._id}`)
      .set('Authorization', `Bearer ${buyerLogin.body.token}`);
    expect(buyerClaim.status).toBe(403);
    const farmerClaim = await request(app)
      .post(`/api/logistics/claim/${order._id}`)
      .set('Authorization', `Bearer ${farmerToken}`);
    expect(farmerClaim.status).toBe(403);

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
    const buyerCompletion = await request(app)
      .post(`/api/logistics/complete/${order._id}`)
      .set('Authorization', `Bearer ${buyerLogin.body.token}`)
      .send({ recipientSignature: 'Recipient confirmed' });
    expect(buyerCompletion.status).toBe(403);
    const farmerCompletion = await request(app)
      .post(`/api/logistics/complete/${order._id}`)
      .set('Authorization', `Bearer ${farmerToken}`)
      .send({ recipientSignature: 'Recipient confirmed' });
    expect(farmerCompletion.status).toBe(403);

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

  it('9a. Should track multi-farmer preparation separately and block early delivery assignment', async () => {
    const buyer = await User.findOne({ email: 'buyer@agriconnect.in' });
    const firstFarmer = await User.findOne({ email: 'farmer@agriconnect.in' });
    const secondFarmer = await User.findOne({ email: 'ramesh.farmer@agriconnect.in' });
    const firstListing = await CropListing.findOne({ farmerId: firstFarmer?._id, status: 'active' });
    const secondListing = await CropListing.findOne({ farmerId: secondFarmer?._id, status: 'active' });
    expect(buyer && firstFarmer && secondFarmer && firstListing && secondListing).toBeTruthy();

    const items = [
      {
        listingId: firstListing!._id,
        cropName: firstListing!.cropName,
        unit: firstListing!.unit,
        quantity: 1,
        unitPricePaise: firstListing!.pricePerUnitPaise,
        totalPaise: firstListing!.pricePerUnitPaise,
        farmerId: firstFarmer!._id,
        farmerName: firstFarmer!.name,
        farmLocation: `${firstListing!.location.district}, ${firstListing!.location.state}`,
        qualityGrade: firstListing!.qualityGrade,
      },
      {
        listingId: secondListing!._id,
        cropName: secondListing!.cropName,
        unit: secondListing!.unit,
        quantity: 1,
        unitPricePaise: secondListing!.pricePerUnitPaise,
        totalPaise: secondListing!.pricePerUnitPaise,
        farmerId: secondFarmer!._id,
        farmerName: secondFarmer!.name,
        farmLocation: `${secondListing!.location.district}, ${secondListing!.location.state}`,
        qualityGrade: secondListing!.qualityGrade,
      },
    ];
    const totalPaise = items.reduce((total, item) => total + item.totalPaise, 0);
    const order = await Order.create({
      orderNumber: `MULTI-${Date.now()}`,
      buyerId: buyer!._id,
      buyerName: buyer!.name,
      buyerRole: buyer!.role,
      buyerPhone: buyer!.phone,
      items,
      sellerFulfilments: buildSellerFulfilments(items, 'confirmed'),
      pricing: {
        grossProductValuePaise: totalPaise,
        farmerPayoutPaise: Math.round(totalPaise * 0.9),
        platformCommissionPaise: Math.round(totalPaise * 0.08),
        operationsReservePaise: totalPaise - Math.round(totalPaise * 0.9) - Math.round(totalPaise * 0.08),
        deliveryFeePaise: 0,
        finalPayablePaise: totalPaise,
      },
      deliveryAddress: { recipientName: buyer!.name, phone: buyer!.phone, addressLine1: 'Farm road', city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana', pinCode: '500081' },
      deliverySlot: { date: new Date().toISOString().slice(0, 10), timeWindow: '07:00 AM - 11:00 AM' },
      status: 'confirmed',
      statusHistory: [{ status: 'confirmed', timestamp: new Date(), role: 'buyer' }],
      payment: { status: 'captured', gateway: 'razorpay_standard' },
    });

    const firstLogin = await request(app).post('/api/auth/login').send({ email: firstFarmer!.email, password: testSeedPassword });
    const secondLogin = await request(app).post('/api/auth/login').send({ email: secondFarmer!.email, password: testSeedPassword });
    const buyerLogin = await request(app).post('/api/auth/login').send({ email: buyer!.email, password: testSeedPassword });
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@agriconnect.in', password: testSeedPassword });
    const agent = await User.findOne({ email: 'logistics@agriconnect.in' });
    expect(firstLogin.status).toBe(200);
    expect(secondLogin.status).toBe(200);
    expect(buyerLogin.status).toBe(200);

    const updateSeller = (token: string, status: string) => request(app)
      .patch(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status });

    const firstAccepted = await updateSeller(firstLogin.body.token, 'accepted');
    expect(firstAccepted.status).toBe(200);
    expect(firstAccepted.body.order.status).toBe('accepted');
    expect((await Order.findById(order._id))?.status).toBe('confirmed');

    const buyerCannotAdvance = await updateSeller(buyerLogin.body.token, 'accepted');
    expect(buyerCannotAdvance.status).toBe(403);

    expect((await updateSeller(secondLogin.body.token, 'accepted')).status).toBe(200);
    expect((await Order.findById(order._id))?.status).toBe('accepted');
    expect((await updateSeller(firstLogin.body.token, 'preparing')).status).toBe(200);
    expect((await Order.findById(order._id))?.status).toBe('accepted');
    expect((await updateSeller(secondLogin.body.token, 'preparing')).status).toBe(200);
    expect((await Order.findById(order._id))?.status).toBe('preparing');
    expect((await updateSeller(firstLogin.body.token, 'ready_for_pickup')).status).toBe(200);
    expect((await Order.findById(order._id))?.status).toBe('preparing');

    const earlyAssignment = await request(app)
      .post(`/api/admin/orders/${order._id}/assign-delivery`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ deliveryAgentId: agent!._id.toString() });
    expect(earlyAssignment.status).toBe(409);

    expect((await updateSeller(secondLogin.body.token, 'ready_for_pickup')).status).toBe(200);
    const readyOrder = await Order.findById(order._id);
    expect(readyOrder?.status).toBe('ready_for_pickup');
    expect(readyOrder?.sellerFulfilments.every((seller) => seller.status === 'ready_for_pickup')).toBe(true);

    const assignment = await request(app)
      .post(`/api/admin/orders/${order._id}/assign-delivery`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ deliveryAgentId: agent!._id.toString() });
    expect(assignment.status).toBe(200);
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
