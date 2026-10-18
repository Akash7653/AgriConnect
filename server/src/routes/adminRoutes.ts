import { Router } from 'express';
import {
  getAdminAnalytics,
  getUsers,
  verifyFarmerKYC,
  updateSystemSettings,
  getAuditLogs,
} from '../controllers/adminController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(USER_ROLES.ADMIN));

router.get('/analytics', getAdminAnalytics);
router.get('/users', getUsers);
router.patch('/users/:userId/verify', verifyFarmerKYC);
router.post('/settings', updateSystemSettings);
router.get('/audit-logs', getAuditLogs);

export default router;
