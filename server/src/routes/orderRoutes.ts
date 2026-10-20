import { Router } from 'express';
import {
  getBuyerOrders,
  getFarmerOrders,
  getOrderById,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.post('/', (_req, res) => {
  res.status(410).json({
    success: false,
    message: 'Direct order creation is disabled. Use Razorpay checkout to create and verify payment orders.',
  });
});
router.get('/buyer', getBuyerOrders);
router.get('/farmer', getFarmerOrders);
router.get('/:id', getOrderById);
router.patch('/:id/status', updateOrderStatus);

export default router;
