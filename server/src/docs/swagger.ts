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
        summary: 'Start signup and send an email verification OTP',
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
                  phone: { type: 'string', description: 'Optional contact phone number; email verification is the only registration verification.' },
                },
              },
            },
          },
        },
        responses: {
          202: { description: 'Pending signup created and code sent' },
          400: { description: 'Invalid signup input' },
          409: { description: 'Email already registered' },
          502: { description: 'Email provider rejected delivery' },
          503: { description: 'Email provider is not configured' },
        },
      },
    },
    '/api/auth/signup': {
      post: {
        summary: 'Alias for starting signup with an email verification OTP',
        responses: { 202: { description: 'Pending signup created and code sent' } },
      },
    },
    '/api/auth/verify-otp': {
      post: {
        summary: 'Verify a six-digit code and create the User account',
        security: [],
        responses: {
          200: { description: 'Email verified; session token and User returned' },
          400: { description: 'Invalid, expired, or locked code' },
          409: { description: 'Email already registered' },
        },
      },
    },
    '/api/auth/resend-otp': {
      post: {
        summary: 'Request a replacement signup OTP',
        security: [],
        responses: {
          202: { description: 'Generic request accepted' },
          429: { description: 'Cooldown or hourly limit reached' },
          502: { description: 'Email provider failed to deliver' },
        },
      },
    },
    '/api/auth/verification/email/resend': {
      post: {
        summary: 'Legacy email-link resend for existing accounts',
        security: [],
        responses: { 202: { description: 'Request accepted' } },
      },
    },
    '/api/auth/verification/email/confirm': {
      post: {
        summary: 'Consume a legacy one-time email verification token',
        security: [],
        responses: { 200: { description: 'Email verified' }, 400: { description: 'Invalid or expired token' } },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Log in with email and password to receive JWT',
        security: [],
        responses: { 200: { description: 'Success' }, 403: { description: 'Email verification required' } },
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
