import { Router } from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
  requestPasswordReset,
  resetPassword,
  resendEmailVerification,
  resendPhoneVerification,
  confirmEmailVerification,
  confirmPhoneVerification,
} from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/password-reset/request', requestPasswordReset);
router.post('/password-reset/confirm', resetPassword);
router.post('/verification/email/resend', resendEmailVerification);
router.post('/verification/email/confirm', confirmEmailVerification);
router.post('/verification/phone/resend', resendPhoneVerification);
router.post('/verification/phone/confirm', confirmPhoneVerification);
router.get('/me', authenticateToken, getMe);
router.put('/profile', authenticateToken, updateProfile);

export default router;
