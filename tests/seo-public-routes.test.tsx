import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { GettingStartedSection } from '../src/pages/landing-sections/GettingStartedSection';
import { getRouteMeta, normalizedPublicOrigin } from '../src/seo/route-meta';
import { renderSeoDocument, publicRobotsText, publicSitemapXml } from '../server/seo/html';

const file = (pathname: string) => readFileSync(resolve(process.cwd(), pathname), 'utf8');
const template = file('index.html');

describe('real SEO: public search discovery without private account indexing', () => {
  it('has accurate, distinct Persian metadata per route and prevents indexing private/demo pages', () => {
    expect(getRouteMeta('/').indexable).toBe(true);
    for (const path of ['/dashboard','/admin','/login','/register','/forgot-password',
      '/demo','/demo/student','/demo/admin','/unknown']) {
      expect(getRouteMeta(path).indexable).toBe(false);
      const html = renderSeoDocument(template, path, 'https://darschin.example');
      expect(html).toContain('name="robots" content="noindex, nofollow, noarchive"');
      expect(html).not.toContain('rel="canonical"');
      expect(html.match(/name="robots"/g)).toHaveLength(1);
      expect(html.match(/property="og:title"/g)).toHaveLength(1);
      expect(html.match(/name="description"/g)).toHaveLength(1);
      expect(html).not.toContain('<meta name="robots" content="index, follow"');
    }
    expect(getRouteMeta('/login').title).not.toBe(getRouteMeta('/').title);
  });

  it('renders a single self-referential canonical and WebSite JSON-LD only with configured HTTPS origin', () => {
    const html = renderSeoDocument(template, '/', 'https://darschin.example');
    expect(html).toContain('<link rel="canonical" href="https://darschin.example/"');
    expect(html).toContain('name="robots" content="index, follow"');
    expect(html).toContain('"@type":"WebSite"');
    expect(html.match(/property="og:description"/g)).toHaveLength(1);
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html.match(/name="robots"/g)).toHaveLength(1);
    expect(html).toContain('fa_IR');
    expect(renderSeoDocument(template, '/', undefined)).not.toContain('rel="canonical"');
    expect(renderSeoDocument(template, '/', 'https://untrusted.test/route')).not.toContain('rel="canonical"');
  });

  it('never uses a spoofed Host or insecure/malformed environment URL as a canonical', () => {
    for (const url of [undefined,'http://darschin.example','https://evil.example/path',
      'https://user:pass@darschin.example','https://darschin.example/?q=1',
      'https://darschin.example/#fragment','javascript:alert(1)']) {
      expect(normalizedPublicOrigin(url)).toBeNull();
      expect(publicSitemapXml(url)).toBeNull();
    }
    expect(normalizedPublicOrigin('https://darschin.example/')).toBe('https://darschin.example');
  });

  it('sitemaps only publicly readable pages, not customer or admin data', () => {
    const sitemap = publicSitemapXml('https://darschin.example')!;
    expect(sitemap).toContain('https://darschin.example/guide/');
    expect(sitemap).toContain('<loc>https://darschin.example/</loc>');
    expect(sitemap).not.toMatch(/\/admin|\/dashboard|\/demo|\/login|\/register|\/api/);
    const robots = publicRobotsText('https://darschin.example');
    expect(robots).toContain('Sitemap: https://darschin.example/sitemap.xml');
    expect(robots).toContain('Disallow: /api/');
    expect(publicRobotsText()).not.toContain('Sitemap:');
  });

  it('Vercel static hosting sends noindex HTTP headers before JS on sensitive and demo URLs', () => {
    const config = JSON.parse(file('vercel.json')) as {
      headers: {source: string; headers: {key: string;value: string}[]}[];
    };
    for (const route of ['/login','/register','/forgot-password','/dashboard','/admin','/demo','/demo/:path*']) {
      const entry = config.headers.find(item => item.source === route);
      expect(entry, route).toBeDefined();
      expect(entry!.headers).toEqual(expect.arrayContaining([
        {key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'},
      ]));
    }
    expect(config.headers.some(item => item.source === '/')).toBe(false);
  });

  it('ships readable standalone Persian guide HTML with descriptive content and self-hosted font', () => {
    const html = file('public/guide/index.html');
    expect(html).toContain('lang="fa" dir="rtl"');
    expect(html).toContain('<h1>');
    expect(html).toContain('name="description"');
    expect(html).toContain('/fonts/Vazirmatn-Persian.woff2');
    expect(html).toContain('چک‌لیست');
    expect(html).toContain('پیش‌نیاز');
    expect(html).toContain('/demo/student');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('در آموزشیار ثبت می‌کند.');
  });

  it('has a useful FAQ and step-by-step mobile-first path on the real landing', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><GettingStartedSection /></MemoryRouter>,
    );
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('راهنمای کامل');
    expect(html).toContain('href="/guide/"');
    expect(html).toContain('href="/demo/student"');
    expect(html).toContain('آیا درس‌چین خودش');
    expect(html).toContain('sm:grid-cols-2 lg:grid-cols-3');
    expect((html.match(/<details/g) ?? [])).toHaveLength(4);
    expect((html.match(/<article/g) ?? [])).toHaveLength(3);
    expect(file('src/pages/Landing.tsx')).toContain('<GettingStartedSection />');
  });
});
