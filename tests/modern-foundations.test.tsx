import React from 'react';
import express from 'express';
import request from 'supertest';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { securityHeadersFor, securityHeaders } from '../server/middleware/security-headers';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';

describe('defense-in-depth HTTP architecture', () => {
  it('always protects against MIME sniffing, external framing and unsafe objects', () => {
    const h = securityHeadersFor(false, true);
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(h['Content-Security-Policy']).toContain("object-src 'none'");
    expect(h['Content-Security-Policy']).toContain("frame-ancestors 'self'");
    expect(h['Permissions-Policy']).toContain('camera=()');
    expect(h['Strict-Transport-Security']).toBeUndefined();
  });

  it('sets HSTS only when transport is HTTPS AND environment is production', () => {
    expect(securityHeadersFor(true, true)['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(securityHeadersFor(false, true)['Strict-Transport-Security']).toBeUndefined();
    expect(securityHeadersFor(true, false)['Strict-Transport-Security']).toBeUndefined();
  });

  it('secures both JSON success and errors without caching sensitive data', async () => {
    const app = express();
    app.use(securityHeaders);
    app.get('/api/student/profile', (_req, res) => res.json({ success: true }));
    app.get('/api/test/error', (_req, res) => res.status(403).json({ success: false }));
    app.get('/non-api', (_req, res) => res.status(200).send('ok'));
    for (const url of ['/api/student/profile','/api/test/error','/non-api']) {
      const response = await request(app).get(url);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['content-security-policy']).toContain("frame-ancestors 'self'");
      if (url.startsWith('/api/')) expect(response.headers['cache-control']).toBe('no-store');
    }
  });

  it('respects more specific response security policies set by preceding middleware', async () => {
    const app = express();
    app.use((_req,res,next)=>{res.setHeader('Content-Security-Policy',"default-src 'none'");next();});
    app.use(securityHeaders);
    app.get('/api/item',(_req,res)=>res.json({success:true}));
    expect((await request(app).get('/api/item')).headers['content-security-policy']).toBe("default-src 'none'");
  });
});

describe('responsive fault-tolerant UI foundation', () => {
  it('provides recoverable, Persian accessible route failure screen without exposing error internals', () => {
    const boundary = new AppErrorBoundary({ resetKey: '/dashboard', children: React.createElement('div',null,'workspace') });
    boundary.state = {hasError:true};
    const markup = renderToStaticMarkup(boundary.render() as React.ReactElement);
    expect(markup).toContain('نمایش این بخش با مشکل روبه‌رو شد');
    expect(markup).toContain('بارگذاری دوباره');
    expect(markup).toContain('صفحهٔ اصلی');
    expect(markup).toContain('min-h-12');
    expect(markup).not.toContain('stack trace');
    expect(AppErrorBoundary.getDerivedStateFromError()).toEqual({hasError:true});
  });

  it('keeps route boundaries near lazy suspense instead of recreating authenticated contexts', () => {
    const app = readFileSync(resolve(process.cwd(),'src/App.tsx'),'utf8');
    expect(app).toContain('<AppErrorBoundary resetKey={location.pathname}>');
    expect(app).toContain('<Suspense fallback={');
    expect(app).toContain('<AuthProvider>');
    expect(app).toContain('href="#darschin-page-content"');
    expect(app).toContain('role="status" aria-live="polite"');
    expect(app).toContain('darschin-loading-pulse');
  });

  it('uses container-based layout instead of assuming every embedded card has full viewport width', () => {
    const css=readFileSync(resolve(process.cwd(),'src/index.css'),'utf8');
    const landing=readFileSync(resolve(process.cwd(),'src/pages/Landing.tsx'),'utf8');
    expect(css).toContain('.darschin-demo-entry { container-type: inline-size; }');
    expect(css).toContain('@container (max-width: 23rem)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(landing).toContain('darschin-demo-entry__actions');
  });

  it('applies security policy before APIs and explicitly fails unknown API routes with JSON', () => {
    const server=readFileSync(resolve(process.cwd(),'server.ts'),'utf8');
    expect(server.indexOf('app.use(securityHeaders)')).toBeGreaterThan(-1);
    expect(server.indexOf('app.use(securityHeaders)')).toBeLessThan(server.indexOf("app.use('/api/auth'"));
    expect(server).toContain("app.use('/api', (req, res) => {");
  });
});
