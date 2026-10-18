import { Router } from 'express';
import {
  getAvailableDeliveries,
  claimDelivery,
  completeDelivery,
} from '../controllers/logisticsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/deliveries', getAvailableDeliveries);
router.post('/claim/:orderId', claimDelivery);
router.post('/complete/:orderId', completeDelivery);

export default router;
