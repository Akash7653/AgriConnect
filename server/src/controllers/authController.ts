import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
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
