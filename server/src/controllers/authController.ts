import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { FarmerProfile } from '../models/FarmerProfile.js';
import { BuyerProfile } from '../models/BuyerProfile.js';
import { signToken, AuthRequest } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';
import { AuditLog } from '../models/AuditLog.js';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum([USER_ROLES.FARMER, USER_ROLES.BUYER, USER_ROLES.BUSINESS, USER_ROLES.LOGISTICS]),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  language: z.enum(['en', 'te', 'hi']).default('en'),
  // Farmer specific fields
  farmName: z.string().optional(),
  village: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  fpoAffiliation: z.string().optional(),
  // Business specific fields
  businessType: z.enum(['household', 'restaurant', 'hotel', 'supermarket', 'institution', 'retailer']).optional(),
  businessName: z.string().optional(),
  gstNumber: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const data = registerSchema.parse(req.body);

    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({ success: false, message: 'An account with this email already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const user = await User.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role,
      phone: data.phone,
      language: data.language,
      isVerified: data.role === USER_ROLES.BUYER, // Household buyers verified by default; farmers/businesses require verification
      status: 'active',
      address: {
        villageOrCity: data.village || '',
        district: data.district || '',
        state: data.state || '',
        pinCode: data.pinCode || '',
      },
    });

    // Create role-specific profile
    if (data.role === USER_ROLES.FARMER) {
      await FarmerProfile.create({
        userId: user._id,
        farmName: data.farmName || `${data.name}'s Farm`,
        fpoAffiliation: data.fpoAffiliation || '',
        location: {
          village: data.village || 'Village',
          district: data.district || 'District',
          state: data.state || 'Telangana',
          pinCode: data.pinCode || '500001',
        },
        primaryCrops: [],
        kycDetails: {
          verificationStatus: 'pending',
        },
      });
    } else if (data.role === USER_ROLES.BUYER || data.role === USER_ROLES.BUSINESS) {
      await BuyerProfile.create({
        userId: user._id,
        buyerType: data.role === USER_ROLES.BUSINESS ? data.businessType || 'restaurant' : 'household',
        businessName: data.businessName,
        gstNumber: data.gstNumber,
        deliveryAddresses: data.pinCode
          ? [
              {
                label: 'Primary',
                recipientName: data.name,
                phone: data.phone,
                addressLine1: data.village || 'Main Street',
                city: data.district || 'City',
                district: data.district || 'District',
                state: data.state || 'State',
                pinCode: data.pinCode,
                isDefault: true,
              },
            ]
          : [],
      });
    }

    await AuditLog.create({
      action: 'USER_REGISTERED',
      userId: user._id,
      userName: user.name,
      role: user.role,
      details: { email: user.email, role: user.role },
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
        phone: user.phone,
        language: user.language,
        isVerified: user.isVerified,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const data = loginSchema.parse(req.body);

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
        phone: user.phone,
        language: user.language,
        isVerified: user.isVerified,
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

    const { name, phone, language, address, farmDetails, bankDetails, businessDetails } = req.body;

    if (name) req.user.name = name;
    if (phone) req.user.phone = phone;
    if (language) req.user.language = language;
    if (address) req.user.address = { ...req.user.address, ...address };

    await req.user.save();

    if (req.user.role === USER_ROLES.FARMER) {
      const updateDoc: any = {};
      if (farmDetails) {
        if (farmDetails.farmName) updateDoc.farmName = farmDetails.farmName;
        if (farmDetails.fpoAffiliation) updateDoc.fpoAffiliation = farmDetails.fpoAffiliation;
        if (farmDetails.landSizeAcres) updateDoc.landSizeAcres = farmDetails.landSizeAcres;
        if (farmDetails.farmingPractice) updateDoc.farmingPractice = farmDetails.farmingPractice;
        if (farmDetails.location) updateDoc.location = farmDetails.location;
      }
      if (bankDetails) {
        updateDoc.bankDetails = bankDetails;
      }
      await FarmerProfile.findOneAndUpdate({ userId: req.user._id }, { $set: updateDoc });
    }

    if (req.user.role === USER_ROLES.BUYER || req.user.role === USER_ROLES.BUSINESS) {
      if (businessDetails) {
        await BuyerProfile.findOneAndUpdate({ userId: req.user._id }, { $set: businessDetails });
      }
    }

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
}
