import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';
import { UserRole } from '../config/constants.js';

export interface AuthRequest extends Request {
  user?: IUser;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (
  process.env.NODE_ENV === 'production' &&
  (!JWT_SECRET || JWT_SECRET.length < 32 || /^(replace_|your_|change_me|<)/i.test(JWT_SECRET) || JWT_SECRET === 'agriconnect_jwt_super_secret_dev_2026')
) {
  throw new Error('A strong JWT_SECRET is required in production.');
}

const signingSecret = JWT_SECRET || 'agriconnect_jwt_super_secret_dev_2026';
const JWT_ISSUER = 'agriconnect-api';
const JWT_AUDIENCE = 'agriconnect-web';

export function signToken(user: IUser): string {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    signingSecret,
    { algorithm: 'HS256', expiresIn: '15m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
  );
}

export function verifyAccessToken(token: string): { userId: string } {
  return jwt.verify(token, signingSecret, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as { userId: string };
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    return;
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid token. User no longer exists.' });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({ success: false, message: 'Account is suspended. Please contact administrator.' });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your email address before continuing.',
      });
      return;
    }

    req.user = user;
    next();
  } catch (err: any) {
    res.status(401).json({ success: false, message: 'Invalid or expired token', error: err.message });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to roles [${roles.join(', ')}]. Your role is ${req.user.role}.`,
      });
      return;
    }

    next();
  };
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId);
      if (user && user.status !== 'suspended') {
        req.user = user;
      }
    } catch {
      // Ignore token decode errors for optional auth
    }
  }
  next();
}
