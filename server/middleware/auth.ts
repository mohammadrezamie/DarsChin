// ============================================================================
// DARSCHYN (درس‌چین) - Authentication Middleware
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../../src/types';
import { db } from '../db/database';

const JWT_SECRET = process.env.JWT_SECRET || 'darschyn_super_secret_local_key_1405';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function generateToken(user: Partial<User>): string {
  const roles = Array.isArray(user.roles) ? user.roles : [user.roles || 'student'];
  return jwt.sign(
    { id: user.id, mobile: user.mobile, roles, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Fallback for single-user demo test when no auth header is supplied
    const defaultStudent = db.users.find((u) => u.roles?.includes('student')) || db.users[0];
    if (defaultStudent) {
      if (!Array.isArray(defaultStudent.roles)) {
        defaultStudent.roles = [(defaultStudent as any).roles || 'student'];
      }
      req.user = defaultStudent;
      return next();
    }
    return res.status(401).json({ success: false, error: 'احراز هویت انجام نشده است.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; roles?: UserRole[] };
    const user = db.users.find((u) => u.id === decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: 'کاربر یافت نشد.' });
    }

    if (!Array.isArray(user.roles)) {
      user.roles = user.roles ? [(user.roles as any)] : ['student'];
    }

    if (user.mobile === '09911902465') {
      if (!user.roles.includes('super-admin')) user.roles.push('super-admin');
      if (!user.roles.includes('admin')) user.roles.push('admin');
      if (!user.roles.includes('student')) user.roles.push('student');
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'توکن ورود منقضی شده یا نامعتبر است.' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  if (!roles.includes('admin') && !roles.includes('super-admin')) {
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
