import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { connectDB } from './config/db.js';
import { initSocketIO } from './socket/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { swaggerDocument } from './docs/swagger.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import cropRoutes from './routes/cropRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import payoutRoutes from './routes/payoutRoutes.js';
import b2bRoutes from './routes/b2bRoutes.js';
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'AI request limit reached. Try again later.' },
});
const locationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Location lookup limit reached. Try again later.' },
});
import logisticsRoutes from './routes/logisticsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import serviceabilityRoutes from './routes/serviceabilityRoutes.js';
import storefrontRoutes from './routes/storefrontRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import { seedDatabaseIfEmpty } from './scripts/seed.js';
import { startPendingOrderExpiryJob } from './jobs/expirePendingOrders.js';
import { startEmailOutboxJob } from './jobs/emailOutbox.js';
import { startAutomaticPayoutJob } from './jobs/automaticPayouts.js';
import { getAllowedClientOrigins } from './config/clientOrigins.js';

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Try again later.' },
});
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
// Initialize Socket.IO
initSocketIO(server);

const allowedOrigins = getAllowedClientOrigins();

// Security & Utility Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        frameSrc: ["'self'", 'https://checkout.razorpay.com', 'https://api.razorpay.com'],
        connectSrc: ["'self'", 'https://checkout.razorpay.com', 'https://api.razorpay.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true,
  })
);

// Capture raw body buffer for Razorpay HMAC signature verification
app.use(
  express.json({
    limit: '1mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(morgan('dev'));
app.use('/api', apiLimiter);

// Swagger Documentation UI
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Healthcheck
app.get('/api/health', (_req, res) => {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const isLiveMode = razorpayKeyId?.startsWith('rzp_live_');
  const requiresLiveMode = process.env.NODE_ENV === 'production';
  const razorpayMode = isLiveMode
    ? 'Configured (Live Mode)'
    : requiresLiveMode
      ? 'Live credentials required'
      : razorpayKeyId
        ? 'Configured (Test Mode)'
        : 'Razorpay credentials required';

  res.json({
    status: 'healthy',
    platform: 'AgriConnect — From Farm to Every Table',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    realtime: 'Socket.IO active',
    razorpay: razorpayMode,
  });
});
// Root endpoint – simple health/info response
app.get('/', (_req, res) => {
  res.json({
    message: "Welcome to AgriConnect API",
    status: "ok",
    version: "1.0.0",
    realtime: "Socket.IO active",
  });
});

// Mount API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/crops', cropRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentLimiter, paymentRoutes);
app.use('/api/serviceability', serviceabilityRoutes);
app.use('/api/storefront', storefrontRoutes);
app.use('/api/location', locationLimiter, locationRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/b2b', b2bRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/notifications', notificationRoutes);

// Centralized Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await connectDB();
    if (process.env.NODE_ENV !== 'production') {
      await seedDatabaseIfEmpty();
    } else {
      startPendingOrderExpiryJob();
      startEmailOutboxJob();
      startAutomaticPayoutJob();
    }

    server.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🌱 AgriConnect Backend API is running on port ${PORT}`);
      console.log(`📖 Swagger API Docs: http://localhost:${PORT}/api-docs`);
      console.log(`⚡ Real-time Socket.IO initialized on ws://localhost:${PORT}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Failed to start AgriConnect server:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

export { app, server };
