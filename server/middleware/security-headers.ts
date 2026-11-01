import type { RequestHandler } from 'express';

/**
 * One security policy for Express pages, assets and API responses.
 * Based on the defense-in-depth pattern reviewed (read-only) in TakinTech,
 * without importing TNA/Laravel configuration or weakening demo isolation.
 *
 * Keep CSP minimal until all extension/third-party data paths are audited:
 * a strict script-src here could silently break the existing React/Vite app.
 */
export function securityHeadersFor(secure: boolean, production: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-DNS-Prefetch-Control': 'off',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=(), usb=()',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Origin-Agent-Cluster': '?1',
    'Content-Security-Policy': "base-uri 'self'; object-src 'none'; frame-ancestors 'self'",
  };
  if (secure && production) {
    // Do not advertise HSTS on HTTP staging or a reverse proxy with
    // unverified TLS configuration.
    headers['Strict-Transport-Security'] = 'max-age=31536000';
  }
  return headers;
}

/** Apply headers before any route, including API failures and static assets. */
export const securityHeaders: RequestHandler = (req, res, next) => {
  const headers = securityHeadersFor(req.secure, process.env.NODE_ENV === 'production');
  for (const [name, value] of Object.entries(headers)) {
    if (!res.hasHeader(name)) res.setHeader(name, value);
  }
  // Never cache bearer-token user data, even if one endpoint forgets a rule.
  if ((req.path === '/api' || req.path.startsWith('/api/')) && !res.hasHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
};
