export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'AgriConnect SaaS Platform API',
    version: '1.0.0',
    description:
      'Direct Farm-to-Table Agricultural Commerce Engine. Connects farmers, FPOs, households, B2B buyers, logistics partners, and administrators with real-time Socket.IO synchronization, transparent payouts, and AI agricultural intelligence.',
    contact: {
      name: 'AgriConnect Engineering',
      email: 'tech@agriconnect.in',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/api/auth/register': {
      post: {
        summary: 'Create an account and return an authenticated session',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string' },
                  role: { type: 'string', enum: ['farmer', 'buyer', 'business', 'logistics'] },
                  phone: { type: 'string', description: 'Optional contact phone number; no phone or email verification is required.' },
                  farm: { type: 'object', description: 'Required when requesting farmer access; farmer access remains subject to administrator approval.' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Account created; access token and user returned' },
          400: { description: 'Invalid signup input' },
          409: { description: 'Email already registered' },
        },
      },
    },
    '/api/auth/signup': {
      post: {
        summary: 'Alias for immediate account creation',
        responses: { 201: { description: 'Account created; access token and user returned' } },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Log in with email and password to receive JWT',
        security: [],
        responses: { 200: { description: 'Success' }, 401: { description: 'Invalid email or password' } },
      },
    },
    '/api/health/email': {
      get: {
        summary: 'Report email provider configuration without exposing credentials',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Provider and credential-presence status' }, 403: { description: 'Administrator access required' } },
      },
    },
    '/api/crops': {
      get: {
        summary: 'Browse and filter available crop listings in real-time',
        responses: { 200: { description: 'List of crops' } },
      },
      post: {
        summary: 'Publish a new crop listing (Farmer only)',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Published' } },
      },
    },
    '/api/orders': {
      post: {
        summary: 'Place order with atomic concurrency-safe inventory reservation and transparent pricing calculation',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Order created' } },
      },
      get: {
        summary: 'Get user orders',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Orders list' } },
      },
    },
    '/api/payouts/my-ledger': {
      get: {
        summary: 'Farmer transparent payout ledger (90% farmer share, 8% platform, 2% ops)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Payout records' } },
      },
    },
    '/api/b2b/rfq': {
      post: {
        summary: 'Submit bulk B2B procurement RFQ for restaurants and institutions',
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'RFQ created' } },
      },
    },
    '/api/ai/advisor': {
      post: {
        summary: 'Agricultural AI advisory & Q&A (English, Telugu, Hindi)',
        responses: { 200: { description: 'Advisory response' } },
      },
    },
    '/api/admin/analytics': {
      get: {
        summary: 'Admin platform analytics with real GMV, platform revenue, and payout breakdowns',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Analytics data' } },
      },
    },
  },
};
