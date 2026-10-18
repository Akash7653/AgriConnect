import { Router } from 'express';
import {
  getFarmerPayoutLedger,
  getAllPayoutLedgers,
  settleFarmerPayout,
} from '../controllers/payoutController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticateToken);

// Farmer views their own ledger
router.get('/my-ledger', requireRole(USER_ROLES.FARMER), getFarmerPayoutLedger);

// Admin ledger audit and settlement release
router.get('/all', requireRole(USER_ROLES.ADMIN), getAllPayoutLedgers);
router.post('/settle/:ledgerId', requireRole(USER_ROLES.ADMIN), settleFarmerPayout);

export default router;
