import type { RequestHandler } from 'express';
import { authenticate, isRootOwner, type AuthenticatedRequest } from './auth';
import { normalizeIranianMobile } from '../auth/normalize-mobile';

/**
 * Optional per-installation access policy. Public *source* does not mean
 * public account creation on an operator's *running instance*.
 *
 * This is a backend API gate. Static files and browser-only demo routes
 * require reverse-proxy access control if they must also be private.
 */
export function assertInstanceAccessConfiguration(): void {
  const mode = process.env.DARSCHYN_ACCESS_MODE ?? 'multiuser';
  if (mode !== 'multiuser' && mode !== 'owner_only') {
    throw new Error('DARSCHYN_ACCESS_MODE must be multiuser or owner_only.');
  }
  if (mode === 'owner_only' && !/^09\d{9}$/.test(process.env.ROOT_OWNER_MOBILE ?? '')) {
    throw new Error('Owner-only access requires a canonical ROOT_OWNER_MOBILE.');
  }
}

const OWNER_GUEST_ENDPOINTS = new Set([
  'POST /api/auth/login',
  'POST /api/auth/recover-password',
  'POST /api/auth/otp/send',
  'POST /api/auth/otp/verify',
]);

export const instanceAccessGate: RequestHandler = (req, res, next) => {
  // This middleware must be mounted at '/api', not as a global prefix check.
  // Express routes match /API case-insensitively by default; a raw
  // case-sensitive req.path.startsWith('/api/') would let /API bypass it.
  if (process.env.DARSCHYN_ACCESS_MODE !== 'owner_only') {
    next();
    return;
  }
  const apiPath = (req.baseUrl + req.path).toLowerCase();
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET' && (apiPath === '/api/health' ||
      apiPath === '/api/security/challenge' ||
      apiPath === '/api/auth/otp/captcha/generate')) {
    next();
    return;
  }
  // An owner-only server never accepts student/third-party registration.
  if (apiPath === '/api/auth/register') {
    res.status(403).json({ success: false, error: 'ثبت‌نام در این نصب خصوصی غیرفعال است.' });
    return;
  }
  if (OWNER_GUEST_ENDPOINTS.has(req.method + ' ' + apiPath)) {
    const mobile = req.body?.mobile;
    const configured = process.env.ROOT_OWNER_MOBILE;
    if (typeof mobile !== 'string' || !configured ||
        normalizeIranianMobile(mobile) !== configured) {
      res.status(403).json({ success: false, error: 'این نصب فقط برای مالک تنظیم شده است.' });
      return;
    }
    // The downstream login/recovery/OTP flow MUST still authenticate normally.
    next();
    return;
  }
  // Every other API, including admin, import, student and unknown API paths,
  // requires a valid signed owner token and the reserved root identity.
  const request = req as AuthenticatedRequest;
  authenticate(request, res, () => {
    if (!isRootOwner(request.user)) {
      res.status(403).json({ success: false, error: 'دسترسی فقط برای مالک این نصب مجاز است.' });
      return;
    }
    next();
  });
};
