// ============================================================================
// DARSCHYN (درس‌چین) - Backend Server Entry Point (Express + Vite)
// ============================================================================

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db/database';
import { authRouter } from './server/routes/auth';
import { otpRouter } from './server/routes/otp';
import { academicRouter } from './server/routes/academic';
import { curriculumRouter } from './server/routes/curriculum';
import { studentRouter } from './server/routes/student';
import { offeringsRouter } from './server/routes/offerings';
import { importsRouter } from './server/routes/imports';
import { eligibilityRouter } from './server/routes/eligibility';
import { adminRouter } from './server/routes/admin';
import { adminManagementRouter } from './server/routes/admin-management';
import { supportRouter } from './server/routes/support';
import { logger } from './server/utils/logger';

async function startServer() {
  // Initialize and seed database
  await db.init(true);

  const app = express();
  const PORT = 3000;

  // JSON Body Parser with limit for batch imports (2MB is sufficient for text data and prevents OOM)
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Health check route with diagnostics
  app.get('/api/health', (req, res) => {
    const memoryUsage = process.memoryUsage();
    res.json({ 
      status: 'ok', 
      product: 'درس‌چین', 
      version: '1.0.0',
      uptime: process.uptime(),
      memory: {
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      }
    });
  });

  // Register API routes
  app.use('/api/auth', authRouter);
app.use('/api/auth/otp', otpRouter);
  app.use('/api/academic', academicRouter);
  app.use('/api/curriculum', curriculumRouter);
  app.use('/api/student', studentRouter);
  app.use('/api/offerings', offeringsRouter);
  app.use('/api/imports', importsRouter);
  app.use('/api/eligibility', eligibilityRouter);
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[درس‌چین] Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
