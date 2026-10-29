import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import { User } from '../models/User.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { BuyerProfile } from '../models/BuyerProfile.js';
import { signToken, AuthRequest } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';
import { AuditLog } from '../models/AuditLog.js';
import { SEEDED_DEMO_ACCOUNT_EMAILS } from '../config/demoAccounts.js';
import { PendingSignup } from '../models/PendingSignup.js';
import { createPendingSignup, checkSignupOtp, resendPendingSignupOtp, restoreClaimedOtp, SignupOtpError } from '../services/signupOtp.js';
import {
  isVerificationDeliveryConfigured,
  sendEmailVerification,
  VerificationError,
  verifyEmailToken,
} from '../services/accountVerification.js';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').max(254),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{10,20}$/, 'Invalid phone number').optional(),
  role: z.enum([USER_ROLES.FARMER, USER_ROLES.BUYER, USER_ROLES.BUSINESS, USER_ROLES.LOGISTICS]).default(USER_ROLES.BUYER),
  farm: z.object({
    farmName: z.string().trim().min(2).max(100),
    village: z.string().trim().min(2).max(80),
    district: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
    pinCode: z.string().trim().min(5).max(12),
  }).strict().optional(),
  language: z.enum(['en', 'te', 'hi']).default('en'),
}).strict().superRefine((data, context) => {
  if (data.role === USER_ROLES.FARMER && !data.farm) {
    context.addIssue({ code: 'custom', path: ['farm'], message: 'Farm details are required for a farmer access request' });
  }
  if (data.role !== USER_ROLES.FARMER && data.farm) {
    context.addIssue({ code: 'custom', path: ['farm'], message: 'Farm details can only be submitted with a farmer access request' });
  }
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

const passwordResetRequestSchema = z.object({
  email: z.string().email().max(254),
}).strict();

const passwordResetSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128),
}).strict();

const verificationEmailSchema = z.object({
  email: z.string().email().max(254),
}).strict();

const verificationTokenSchema = z.object({
  token: z.string().min(32).max(128),
}).strict();
const verifyOtpSchema = z.object({
  email: z.string().email().max(254),
  otp: z.string().regex(/^\d{6}$/, 'Enter the six-digit verification code.'),
}).strict();

const profileUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{10,20}$/).optional(),
  language: z.enum(['en', 'te', 'hi']).optional(),
  address: z.object({
    street: z.string().max(120).optional(),
    villageOrCity: z.string().max(80).optional(),
    district: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    pinCode: z.string().min(5).max(12).optional(),
  }).strict().optional(),
}).strict();

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.trim().toLowerCase();
    const existingUser = await User.findOne({ email });
    if (existingUser?.emailVerified) {
      res.status(409).json({ success: false, code: 'EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists. Please sign in.' });
      return;
    }

    if (existingUser && !await bcrypt.compare(data.password, existingUser.passwordHash)) {
      res.status(409).json({ success: false, code: 'EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists. Please sign in or request verification.' });
      return;
    }

    const passwordHash = existingUser?.passwordHash
      ?? await bcrypt.hash(data.password, await bcrypt.genSalt(12));
    await createPendingSignup({
      email,
      name: existingUser?.name ?? data.name,
      passwordHash,
      phone: existingUser?.phone ?? data.phone ?? '',
      role: existingUser?.role === USER_ROLES.ADMIN ? USER_ROLES.BUYER : existingUser?.role ?? USER_ROLES.BUYER,
      ...(!existingUser && data.role !== USER_ROLES.BUYER ? { requestedRole: data.role } : {}),
      ...(existingUser?.requestedRole ? { requestedRole: existingUser.requestedRole } : {}),
      ...(!existingUser && data.role === USER_ROLES.FARMER && data.farm ? { requestedFarm: data.farm } : {}),
      ...(existingUser?.requestedFarm ? { requestedFarm: existingUser.requestedFarm } : {}),
      language: existingUser?.language ?? data.language,
      ...(existingUser ? { legacyUserId: existingUser._id } : {}),
    });

    res.status(202).json({
      success: true,
      message: 'Verification code sent. Enter the six-digit code from your email to finish creating your account.',
      email,
      otpSent: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: error.issues[0]?.message ?? 'Check the registration details and try again.' });
      return;
    }
    if (error instanceof SignupOtpError) {
      res.status(error.statusCode).json({ success: false, code: error.code, message: error.message, retryable: error.code === 'OTP_DELIVERY_FAILED' });
      return;
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      res.status(400).json({ success: false, message: 'An account with this email already exists.' });
      return;
    }
    console.error('[auth] Signup could not be processed', { category: 'signup_processing_error' });
    res.status(500).json({ success: false, message: 'Registration could not be completed. Please try again.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const data = loginSchema.parse(req.body);

    if (process.env.NODE_ENV === 'production' && SEEDED_DEMO_ACCOUNT_EMAILS.includes(data.email as typeof SEEDED_DEMO_ACCOUNT_EMAILS[number])) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const user = await User.findOne({ email: data.email });
    if (!user) {
      const pending = await PendingSignup.findOne({ email: data.email }).select('+passwordHash');
      if (pending && await bcrypt.compare(data.password, pending.passwordHash)) {
        res.status(403).json({
          success: false,
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email with the six-digit code before signing in.',
        });
        return;
      }
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }
    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your email address before signing in.',
      });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ success: false, message: 'Account is suspended. Contact administration.' });
      return;
    }

    const token = signToken(user);

    await AuditLog.create({
      action: 'USER_LOGIN',
      userId: user._id,
      userName: user.name,
      role: user.role,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        requestedRole: user.requestedRole,
        requestedFarm: user.requestedFarm,
        status: user.status,
        phone: user.phone,
        language: user.language,
        isVerified: user.isVerified,
        emailVerified: user.emailVerified,
        address: user.address,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function verifySignupOtp(req: Request, res: Response): Promise<void> {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, code: 'OTP_INVALID', message: 'Enter the six-digit verification code.' });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  try {
    const checked = await checkSignupOtp(email, parsed.data.otp);
    if ('code' in checked || !checked.pending) {
      const code = 'code' in checked ? checked.code : 'OTP_INVALID';
      const message = code === 'OTP_EXPIRED'
        ? 'This code has expired. Request a new verification code.'
        : code === 'OTP_ATTEMPTS_EXCEEDED'
          ? 'Too many incorrect attempts. Request a new code to continue.'
          : 'That verification code is incorrect. Check it and try again.';
      res.status(400).json({ success: false, code, message });
      return;
    }

    const pending = checked.pending;
    let user;
    if (pending.legacyUserId) {
      user = await User.findOneAndUpdate(
        { _id: pending.legacyUserId, email, emailVerified: false },
        { $set: { emailVerified: true }, $unset: { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1, emailVerificationLastSentAt: 1 } },
        { new: true },
      );
      if (!user) {
        user = await User.findOne({ email });
        if (!user?.emailVerified) {
          res.status(409).json({ success: false, code: 'ACCOUNT_UNAVAILABLE', message: 'This signup could not be completed. Please contact support.' });
          return;
        }
      }
    } else {
      try {
        user = await User.create({
          name: pending.name,
          email,
          passwordHash: pending.passwordHash,
          role: pending.role,
          ...(pending.requestedRole ? { requestedRole: pending.requestedRole } : {}),
          ...(pending.requestedFarm ? { requestedFarm: pending.requestedFarm } : {}),
          phone: pending.phone ?? '',
          language: pending.language,
          isVerified: false,
          emailVerified: true,
          status: pending.requestedRole ? 'pending_verification' : 'active',
        });
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
          await PendingSignup.deleteOne({ _id: pending._id });
          res.status(409).json({ success: false, code: 'EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists. Please sign in.' });
          return;
        }
        await restoreClaimedOtp(pending, parsed.data.otp);
        throw error;
      }
    }

    await PendingSignup.deleteOne({ _id: pending._id });
    if (user.role === USER_ROLES.BUYER) {
      try {
        await BuyerProfile.updateOne(
          { userId: user._id },
          { $setOnInsert: { userId: user._id, buyerType: 'household', deliveryAddresses: [] } },
          { upsert: true },
        );
      } catch {
        console.error('[auth] Buyer profile initialization failed', { category: 'buyer_profile_write_error' });
      }
    }
    try {
      await AuditLog.create({
        action: 'USER_SIGNUP_VERIFIED',
        userId: user._id,
        userName: user.name,
        role: user.role,
        details: { requestedRole: user.requestedRole },
        ipAddress: req.ip,
      });
    } catch {
      console.error('[auth] Verified signup audit write failed', { category: 'audit_write_error' });
    }

    res.json({
      success: true,
      message: 'Email verified. You are now signed in.',
      token: signToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        requestedRole: user.requestedRole,
        requestedFarm: user.requestedFarm,
        status: user.status,
        phone: user.phone,
        language: user.language,
        isVerified: user.isVerified,
        emailVerified: user.emailVerified,
        address: user.address,
      },
    });
  } catch (error) {
    if (error instanceof SignupOtpError) {
      res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
      return;
    }
    console.error('[auth] Signup OTP verification failed', { category: 'otp_verification_processing_error' });
    res.status(500).json({ success: false, code: 'OTP_VERIFICATION_FAILED', message: 'Verification could not be completed. Please retry.' });
  }
}

export async function resendSignupOtp(req: Request, res: Response): Promise<void> {
  const parsed = verificationEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    return;
  }
  try {
    await resendPendingSignupOtp(parsed.data.email.trim().toLowerCase());
    res.status(202).json({
      success: true,
      message: 'If a signup for this email is waiting for verification, a new code will be sent when eligible.',
    });
  } catch (error) {
    if (error instanceof SignupOtpError) {
      if (error.code === 'OTP_COOLDOWN' || error.code === 'OTP_RESEND_LIMIT') {
        res.status(202).json({
          success: true,
          message: 'If a signup for this email is waiting for verification, a new code will be sent when eligible.',
        });
        return;
      }
      res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
        retryable: error.code === 'OTP_DELIVERY_FAILED',
      });
      return;
    }
    console.error('[auth] OTP resend could not be processed', { category: 'otp_resend_processing_error' });
    res.status(503).json({ success: false, code: 'OTP_RESEND_UNAVAILABLE', message: 'Verification is temporarily unavailable. Please retry.' });
  }
}

export async function resendEmailVerification(req: Request, res: Response): Promise<void> {
  const parsed = verificationEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    return;
  }
  try {
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (user && !user.emailVerified) {
      try {
        await sendEmailVerification(user._id.toString());
      } catch (error) {
        if (!(error instanceof VerificationError)) throw error;
        console.warn('[auth] Verification resend was not completed', { category: error.category });
      }
    }
    res.status(202).json({
      success: true,
      message: 'If an account needs verification, a link will be sent when email delivery is available. Check your inbox or try again shortly.',
    });
  } catch (error) {
    console.error('[auth] Email verification resend failed', { category: 'database_error' });
    res.status(500).json({ success: false, message: 'Could not process the request. Please try again shortly.' });
  }
}

export async function confirmEmailVerification(req: Request, res: Response): Promise<void> {
  const parsed = verificationTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'The email verification link is invalid or expired.' });
    return;
  }
  try {
    const result = await verifyEmailToken(parsed.data.token);
    res.json({ success: true, message: 'Email verified. You can now sign in.', ...result });
  } catch (error) {
    if (error instanceof VerificationError) {
      res.status(error.statusCode).json({ success: false, code: error.category.toUpperCase(), message: error.message });
      return;
    }
    console.error('[auth] Email verification failed', { category: 'database_error' });
    res.status(500).json({ success: false, message: 'Could not verify your email. Request a new link and try again.' });
  }
}

export async function requestPasswordReset(req: Request, res: Response): Promise<void> {
  const genericResponse = {
    success: true,
    message: 'If an account exists for that email, password reset instructions will be sent.',
  };
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    return;
  }

  try {
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (user) {
      const token = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await User.updateOne(
        { _id: user._id },
        { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } }
      );

      try {
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.RESEND_FROM_EMAIL;
        if (!apiKey || !from) {
          console.warn('[auth] Password reset email unavailable', { category: 'email_not_configured' });
        } else {
          const clientOrigin = (process.env.CLIENT_URL || 'https://agri-connect-seven-snowy.vercel.app')
            .split(',')[0]
            .trim();
          const resetUrl = new URL('/reset-password', clientOrigin);
          resetUrl.hash = new URLSearchParams({ token }).toString();
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from,
              to: [user.email],
              subject: 'Reset your AgriConnect password',
              html: `<p>We received a request to reset your AgriConnect password.</p><p><a href="${resetUrl.toString()}">Reset your password</a></p><p>This link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.</p>`,
              text: `Reset your AgriConnect password using this link: ${resetUrl.toString()}\n\nThis link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.`,
            }),
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) {
            console.warn('[auth] Password reset email delivery failed', {
              category: 'email_provider_http_error',
              status: response.status,
              requestId: response.headers.get('x-request-id') || response.headers.get('resend-request-id') || undefined,
            });
          }
        }
      } catch (error) {
        console.warn('[auth] Password reset email delivery failed', {
          category: error instanceof Error && error.name === 'TimeoutError' ? 'email_timeout' : 'email_network_error',
        });
      }
    }

    res.status(202).json(genericResponse);
  } catch {
    console.error('[auth] Password reset request failed', { category: 'database_error' });
    res.status(503).json({ success: false, message: 'Password reset is temporarily unavailable. Try again later.' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const parsed = passwordResetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: 'The reset link or new password is invalid.' });
    return;
  }

  try {
    const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
    const now = new Date();
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: now },
    });
    if (!user) {
      res.status(400).json({ success: false, message: 'This password reset link is invalid or has expired. Request a new one.' });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, await bcrypt.genSalt(12));
    const result = await User.updateOne(
      {
        _id: user._id,
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: now },
      },
      { $set: { passwordHash }, $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } }
    );
    if (result.modifiedCount !== 1) {
      res.status(400).json({ success: false, message: 'This password reset link is invalid or has expired. Request a new one.' });
      return;
    }

    try {
      await AuditLog.create({
        action: 'PASSWORD_RESET_COMPLETED',
        userId: user._id,
        userName: user.name,
        role: user.role,
        ipAddress: req.ip,
      });
    } catch {
      console.error('[auth] Password reset audit write failed', { category: 'audit_write_error' });
    }
    res.json({ success: true, message: 'Password updated. You can now sign in.' });
  } catch {
    console.error('[auth] Password reset completion failed', { category: 'reset_processing_error' });
    res.status(500).json({ success: false, message: 'Password could not be updated. Request a new reset link and try again.' });
  }
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    let profile: any = null;
    if (req.user.role === USER_ROLES.FARMER) {
      profile = await FarmerProfile.findOne({ userId: req.user._id });
    } else if (req.user.role === USER_ROLES.BUYER || req.user.role === USER_ROLES.BUSINESS) {
      profile = await BuyerProfile.findOne({ userId: req.user._id });
    }

    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        phone: req.user.phone,
        language: req.user.language,
        isVerified: req.user.isVerified,
        emailVerified: req.user.emailVerified,

        status: req.user.status,
        address: req.user.address,
        createdAt: req.user.createdAt,
      },
      profile,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const { name, phone, language, address } = profileUpdateSchema.parse(req.body);

    if (name) req.user.name = name;
    if (phone && phone !== req.user.phone) {
      req.user.phone = phone;
    }
    if (language) req.user.language = language;
    if (address) req.user.address = { ...req.user.address, ...address };

    await req.user.save();

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}
