import type { Request, Response, NextFunction } from 'express';
import { db } from '../db/database';

const VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export function turnstilePublicConfiguration() {
  const enabled = process.env.TURNSTILE_ENABLED === 'true';
  return { enabled, siteKey: enabled ? (process.env.TURNSTILE_SITE_KEY || '') : '' };
}

export function assertTurnstileConfiguration(): void {
  if (process.env.TURNSTILE_ENABLED !== 'true') return;
  if (!process.env.TURNSTILE_SITE_KEY || !process.env.TURNSTILE_SECRET_KEY) {
    throw new Error('TURNSTILE_ENABLED=true requires TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY.');
  }
  if (process.env.NODE_ENV === 'production') {
    const allowed = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || '').split(',')
      .map(hostname => hostname.trim()).filter(Boolean);
    if (!allowed.length) throw new Error('Production Turnstile requires TURNSTILE_ALLOWED_HOSTNAMES.');
    if (/^[123]x0{8}/.test(process.env.TURNSTILE_SITE_KEY) ||
        /^[123]x0{8}/.test(process.env.TURNSTILE_SECRET_KEY)) {
      throw new Error('Turnstile testing keys are forbidden in production.');
    }
  }
}

/**
 * Fallback for visitors unable to access Cloudflare, including the Iranian pilot.
 * The existing OTP CAPTCHA generator issues the random id and SVG. Its answer is
 * never sent by the server, and every successful answer is single-use.
 */
function validateLocalGuestChallenge(token: unknown): boolean {
  if (typeof token !== 'string' || token.length > 128) return false;
  const parts = /^local:([a-f0-9-]{36}):([a-z0-9]{1,12})$/i.exec(token.trim());
  if (!parts) return false;

  const challenge = db.captchaChallenges.find(item => item.id === parts[1]);
  const now = Date.now();
  if (!challenge || !Number.isFinite(challenge.expiresAt) ||
    challenge.expiresAt <= now || challenge.consumedAt ||
    challenge.attempts >= 5) return false;

  const valid = challenge.value.toLowerCase() === parts[2].toLowerCase();
  challenge.attempts += 1;
  if (valid) challenge.consumedAt = now;
  db.save();
  return valid;
}

/** Both Turnstile and the local image require a real server-side, single-use check. */
export async function validateGuestChallenge(token: unknown, expectedAction: string): Promise<boolean> {
  if (process.env.TURNSTILE_ENABLED !== 'true') return validateLocalGuestChallenge(token);
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) return false;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(VERIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const result = await response.json() as {
      success?: boolean; action?: string; hostname?: string;
    };
    if (!result.success || result.action !== expectedAction) return false;
    const allowed = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || '')
      .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    // Require an explicit hostname allowlist on public deployment.
    if (process.env.NODE_ENV === 'production' && !allowed.length) return false;
    if (allowed.length && (!result.hostname || !allowed.includes(result.hostname.toLowerCase()))) return false;
    return true;
  } catch {
    return false; // No fail-open if Iran/client/provider network is unavailable.
  } finally {
    clearTimeout(abort);
  }
}

export function requireGuestChallenge(action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!(await validateGuestChallenge(req.body?.captchaToken, action))) {
      return res.status(403).json({
        success: false,
        error: 'تأیید «من ربات نیستم» انجام نشد؛ در صورت مشکل اتصال دوباره تلاش کنید.',
      });
    }
    next();
  };
}
