import { Router } from 'express';
import {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
} from '../controllers/paymentController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Protected endpoints for client checkout
router.post('/create-order', authenticateToken, createPaymentOrder);
router.post('/verify', authenticateToken, verifyPayment);

// Dedicated Webhook endpoint (Raw body preserved, called by Razorpay)
router.post('/webhook', handleWebhook);

export default router;
