import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
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
import logisticsRoutes from './routes/logisticsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import { seedDatabaseIfEmpty } from './scripts/seed.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocketIO(server);

// Security & Utility Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // For swagger & dev scripts
  })
);
app.use(cors({ origin: '*', credentials: true }));

// Capture raw body buffer for Razorpay HMAC signature verification
app.use(
  express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Swagger Documentation UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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
app.use('/api/auth', authRoutes);
app.use('/api/crops', cropRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/b2b', b2bRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);

// Centralized Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await connectDB();
    // Auto-seed if database is fresh
    await seedDatabaseIfEmpty();

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
