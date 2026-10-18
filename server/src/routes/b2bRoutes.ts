import { Router } from 'express';
import {
  createQuoteRequest,
  getQuoteRequests,
  submitQuoteResponse,
  saveProcurementList,
} from '../controllers/b2bController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.post('/rfq', createQuoteRequest);
router.get('/rfq', getQuoteRequests);
router.post('/rfq/:id/quote', submitQuoteResponse);
router.post('/procurement-list', saveProcurementList);

export default router;
