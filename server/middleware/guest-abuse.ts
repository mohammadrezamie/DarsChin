import { rateLimit } from 'express-rate-limit';

/**
 * One-process protection for the small student pilot. This complements the
 * one-use CAPTCHA and per-mobile OTP/login limits. Do not mistake in-memory
 * counters for distributed throttling or a reverse-proxy/WAF rate limit.
 *
 * Let express-rate-limit derive the key from Express' trusted req.ip so IPv6
 * addresses share their /56 network by default. Never trust arbitrary XFF.
 */
const shared = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  ipv6Subnet: 56,
  passOnStoreError: false,
  handler: (_req: unknown, res: import('express').Response) =>
    res.status(429).set('Cache-Control', 'no-store').json({
      success: false,
      error: 'درخواست‌های زیادی از این اتصال دریافت شد. کمی بعد دوباره تلاش کنید.',
    }),
};

export function createGuestAbuseLimiters() {
  return {
    captcha: rateLimit({ ...shared, windowMs: 5 * 60_000, limit: 240, identifier: 'guest-captcha' }),
    login: rateLimit({ ...shared, windowMs: 15 * 60_000, limit: 90, identifier: 'guest-login' }),
    register: rateLimit({ ...shared, windowMs: 60 * 60_000, limit: 80, identifier: 'guest-register' }),
    otpSend: rateLimit({ ...shared, windowMs: 15 * 60_000, limit: 60, identifier: 'guest-otp-send' }),
  };
}
