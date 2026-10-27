// ============================================================================
// DARSCHYN (درس‌چین) - Authentication Middleware
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../../src/types';
import { db } from '../db/database';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required.');
}
const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function generateToken(user: Partial<User>): string {
  const persisted = db.users.find(row => row.id === user.id);
  const identity = persisted || user;
  const roles = Array.isArray(identity.roles) ? identity.roles : [identity.roles || 'student'];
  const version = identity.sessionVersion ?? 0;
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error('Invalid persisted user session version');
  }
  return jwt.sign(
    { id: identity.id, mobile: identity.mobile, roles, permissions: identity.permissions || [], name: identity.name, sv: version },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'احراز هویت انجام نشده است.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; sv?: unknown; roles?: UserRole[], permissions?: string[] };
    const user = db.users.find((u) => u.id === decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: 'کاربر یافت نشد.' });
    }
    if (user.deactivatedAt) {
      return res.status(403).json({ success: false, error: 'حساب کاربری شما غیرفعال شده است.' });
    }
    // Legacy JWTs have no sv claim: honor them only until the account's first
    // password change. After that, even a stolen unexpired JWT is invalid.
    const version = user.sessionVersion ?? 0;
    if (!Number.isSafeInteger(version) || version < 0 ||
        (decoded.sv !== undefined && (typeof decoded.sv !== 'number' || !Number.isSafeInteger(decoded.sv) || decoded.sv < 0)) ||
        (decoded.sv ?? 0) !== version) {
      return res.status(401).json({ success: false, error: 'نشست قبلی شما منقضی شده است؛ دوباره وارد شوید.' });
    }

    if (!Array.isArray(user.roles)) {
      user.roles = user.roles ? [(user.roles as any)] : ['student'];
    }

    

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'توکن ورود منقضی شده یا نامعتبر است.' });
  }
}


export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const permissions = req.user?.permissions || [];
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    
    if (roles.includes('super-admin')) {
      return next(); // root owner bypass
    }

    if (!permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: `دسترسی غیرمجاز. نیاز به سطح دسترسی: ${permission}`,
      });
    }
    next();
  };
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const permissions = req.user?.permissions || [];
  if (!roles.includes('super-admin') && !permissions.includes('admin.panel.access')) {
    return res.status(403).json({
      success: false,
      error: 'دسترسی غیرمجاز. فقط مدیران سامانه مجاز به انجام این عملیات هستند.',
    });
  }
  next();
}


export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  if (!roles.includes('super-admin')) {
    return res.status(403).json({
      success: false,
      error: 'دسترسی غیرمجاز. این بخش فقط مختص مدیر ارشد سیستم می‌باشد.',
    });
  }
  next();
}
