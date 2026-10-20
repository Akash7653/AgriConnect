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

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').max(254),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{10,20}$/, 'Invalid phone number'),
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
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
}).strict();

const passwordResetRequestSchema = z.object({
  email: z.string().email().max(254),
}).strict();

const passwordResetSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128),
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

    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'An account with this email already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await User.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: USER_ROLES.BUYER,
      ...(data.role !== USER_ROLES.BUYER ? { requestedRole: data.role } : {}),
      ...(data.role === USER_ROLES.FARMER && data.farm ? { requestedFarm: data.farm } : {}),
      phone: data.phone,
      language: data.language,
      isVerified: true,
      status: data.role === USER_ROLES.BUYER ? 'active' : 'pending_verification',
    });

    // Create role-specific profile
    if (user.role === USER_ROLES.BUYER) {
      await BuyerProfile.create({
        userId: user._id,
        buyerType: 'household',
        deliveryAddresses: [],
      });
    }

    await AuditLog.create({
      action: 'USER_REGISTERED',
      userId: user._id,
      userName: user.name,
      role: user.role,
      details: { email: user.email, role: user.role, requestedRole: user.requestedRole },
      ipAddress: req.ip,
    });

    const token = signToken(user);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
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
        address: user.address,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const data = loginSchema.parse(req.body);

    if (process.env.NODE_ENV === 'production' && SEEDED_DEMO_ACCOUNT_EMAILS.includes(data.email.toLowerCase() as typeof SEEDED_DEMO_ACCOUNT_EMAILS[number])) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const user = await User.findOne({ email: data.email.toLowerCase() });
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
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
        address: user.address,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
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
    if (phone) req.user.phone = phone;
    if (language) req.user.language = language;
    if (address) req.user.address = { ...req.user.address, ...address };

    await req.user.save();

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}
