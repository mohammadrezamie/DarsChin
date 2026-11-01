import "dotenv/config";
// ============================================================================
// DARSCHYN (درس‌چین) - Backend Server Entry Point (Express + Vite)
// ============================================================================

import express from 'express';
import path from 'path';
import fs from 'node:fs';
import { getRouteMeta } from './src/seo/route-meta';
import { publicRobotsText, publicSitemapXml, renderSeoDocument } from './server/seo/html';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db/database';
import { authRouter } from './server/routes/auth';
import { otpRouter } from './server/routes/otp';
import { academicRouter } from './server/routes/academic';
import { curriculumRouter } from './server/routes/curriculum';
import { studentRouter } from './server/routes/student';
import { offeringsRouter } from './server/routes/offerings';
import { importsRouter } from './server/routes/imports';
import { syncRouter } from './server/routes/sync';
import { eligibilityRouter } from './server/routes/eligibility';
import { demandRouter } from './server/routes/demand';
import { smsCenterRouter } from './server/routes/sms-center';
import { assertTurnstileConfiguration, turnstilePublicConfiguration } from './server/security/turnstile';
import { adminRouter } from './server/routes/admin';
import { adminManagementRouter } from './server/routes/admin-management';
import { supportRouter } from './server/routes/support';
import { logger } from './server/utils/logger';
import { securityHeaders } from './server/middleware/security-headers';
import { createGuestAbuseLimiters } from './server/middleware/guest-abuse';

async function startServer() {
  // Initialize and seed database
  await db.init(true);

  const app = express();
  // Only the local reverse proxy may supply a client IP. Never use trust proxy
  // = true: an Internet client could spoof X-Forwarded-For to evade limits.
  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 'loopback' : false);
  const guestLimits = createGuestAbuseLimiters();
  const configuredPort = process.env.PORT ?? '3000';
  const PORT = Number.parseInt(configuredPort, 10);
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error(`Invalid PORT value: ${configuredPort}`);
  }
  // In production, expose the Node process only to the local reverse proxy by default.
  // Development remains reachable on the LAN/container interface unless HOST is set.
  const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

  assertTurnstileConfiguration();
  app.use(securityHeaders);
  // JSON Body Parser with limit for batch imports (2MB is sufficient for text data and prevents OOM)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Health check route with diagnostics
  app.get('/api/health', (req, res) => {
    const memoryUsage = process.memoryUsage();
    res.json({ 
      status: 'ok', 
      product: 'درس‌چین', 
      version: '3.3.6',
      releaseSha: /^[a-f0-9]{7,40}$/i.test(process.env.DARSCHYN_RELEASE_SHA || '')
        ? process.env.DARSCHYN_RELEASE_SHA
        : 'unidentified',
      uptime: process.uptime(),
      memory: {
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      }
    });
  });

  app.get('/api/security/challenge', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: { ...turnstilePublicConfiguration(), registrationOtpRequired: process.env.DARSCHYN_REGISTRATION_OTP_REQUIRED === 'true' } });
  });

  // Throttle before CAPTCHA generation or expensive password/SMS handlers.
  // Each policy has its own counter. Health, static pages and logged-in
  // application APIs are deliberately unaffected.
  app.get('/api/auth/otp/captcha/generate', guestLimits.captcha);
  app.post('/api/auth/login', guestLimits.login);
  app.post('/api/auth/register', guestLimits.register);
  app.post('/api/auth/otp/send', guestLimits.otpSend);

  // Only trusted configured HTTPS origins belong in the crawler sitemap.
  // Generate responses on the same server that serves the actual application.
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').set('Cache-Control', 'public, max-age=3600')
      .send(publicRobotsText(process.env.DARSCHYN_PUBLIC_SITE_URL));
  });
  app.get('/sitemap.xml', (_req, res) => {
    const xml = publicSitemapXml(process.env.DARSCHYN_PUBLIC_SITE_URL);
    if (!xml) return res.status(404).type('text/plain')
      .send('Public sitemap is unavailable until DARSCHYN_PUBLIC_SITE_URL is configured.');
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
  });

  // Register API routes
  app.use('/api/auth', authRouter);
  app.use('/api/auth/otp', otpRouter);
  app.use('/api/academic', academicRouter);
  app.use('/api/curriculum', curriculumRouter);
  app.use('/api/student', studentRouter);
  app.use('/api/offerings', offeringsRouter);
  app.use('/api/imports', importsRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/eligibility', eligibilityRouter);
  app.use('/api/demand', demandRouter);
  app.use('/api/sms-center', smsCenterRouter);
  app.use('/api/admin', adminRouter);
app.use('/api/admin-management', adminManagementRouter);
  app.use('/api/support', supportRouter);

  // Extension ZIP Download Endpoint
  app.get('/api/extension/download', async (req, res) => {
    try {
      const { ZipArchive } = await import('archiver');
      const archive = new ZipArchive({ zlib: { level: 9 } });
      const extDir = path.join(process.cwd(), 'extension');

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename=darschyn-chrome-extension-v3.3.6.zip');

      archive.pipe(res);
      archive.directory(extDir, false);
      
      await archive.finalize();
    } catch (err: any) {
      console.error('Error generating extension zip:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'خطا در ایجاد فایل فشرده افزونه' });
      }
    }
  });

  // Serve static extension files & mock portal if accessed directly
  const extensionPath = path.join(process.cwd(), 'extension');
  const mockPortalPath = path.join(process.cwd(), 'mock-educational-system');
  app.use('/extension-files', express.static(extensionPath));
  app.use('/mock-portal-static', express.static(mockPortalPath));

  // Global API error handler
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('API Error', { 
      error: err.message, 
      stack: err.stack,
      path: req.path,
      method: req.method
    });
    res.status(500).json({ success: false, error: 'خطای داخلی سرور' });
  });

  // Handle 404 for API routes explicitly to avoid Vite serving index.html
  app.use('/api', (req, res) => {
    res.status(404).json({ success: false, error: 'مسیر مورد نظر یافت نشد' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Do not let static directory-index handling bypass route-specific SEO.
    app.get('/index.html', (_req, res) => res.redirect(308, '/'));
    // Express 4 is non-strict about trailing slashes: /guide also matches
    // /guide/. Guard the exact path or this redirect loops forever.
    app.get('/guide', (req, res, next) => req.path === '/guide'
      ? res.redirect(308, '/guide/') : next());
    app.get('/guide/index.html', (_req, res) => res.redirect(308, '/guide/'));
    app.get('/guide/', (_req, res) => res.sendFile(path.join(distPath, 'guide', 'index.html')));
    app.use(express.static(distPath, { index: false }));
    const htmlTemplate = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
    app.get('*', (req, res) => {
      // A SPA fallback must never turn nonexistent URLs into indexable 200s.
      const route = getRouteMeta(req.path);
      if (!route.indexable) {
        res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
        res.set('Cache-Control', 'no-store');
      }
      const validSpaRoutes = new Set([
        '/', '/help', '/demo', '/demo/student', '/demo/admin',
        '/login', '/register', '/forgot-password', '/dashboard', '/admin',
      ]);
      const status = validSpaRoutes.has(req.path) ? 200 : 404;
      return res.status(status).type('html').send(
        renderSeoDocument(htmlTemplate, req.path, process.env.DARSCHYN_PUBLIC_SITE_URL),
      );
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`[درس‌چین] Server running on http://${HOST}:${PORT}`);
  });

  server.on('error', (err) => {
    logger.error('Server listener failed', {
      error: err.message,
      host: HOST,
      port: PORT,
    });
    process.exitCode = 1;
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  // A failed bootstrap must be visible to systemd, health gates and CI. A
  // silent exit code 0 previously masked failures in the VPS service.
  process.exitCode = 1;
});
