import { Router } from 'express';
import {
  getAdminAnalytics,
  getUsers,
  verifyFarmerKYC,
  updateSystemSettings,
  getAuditLogs,
  getServiceZones,
  createServiceZone,
  updateServiceZone,
  deactivateServiceZone,
  getAdminOrders,
  assignDeliveryAgent,
  approveAccountRole,
  refundOrder,
  setFarmerRazorpayAccount,
} from '../controllers/adminController.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(USER_ROLES.ADMIN));
router.use((req: AuthRequest, res, next) => {
  if (!req.user?.isVerified) {
    res.status(403).json({ success: false, message: 'Verified administrator access is required.' });
    return;
  }
  next();
});

router.get('/analytics', getAdminAnalytics);
router.get('/users', getUsers);
router.patch('/users/:userId/verify', verifyFarmerKYC);
router.post('/settings', updateSystemSettings);
router.get('/audit-logs', getAuditLogs);
router.get('/service-zones', getServiceZones);
router.post('/service-zones', createServiceZone);
router.patch('/service-zones/:id', updateServiceZone);
router.delete('/service-zones/:id', deactivateServiceZone);
router.get('/orders', getAdminOrders);
router.post('/orders/:id/assign-delivery', assignDeliveryAgent);
router.patch('/users/:userId/role', approveAccountRole);
router.post('/orders/:id/refund', refundOrder);
router.patch('/farmers/:farmerId/razorpay-account', setFarmerRazorpayAccount);

export default router;
