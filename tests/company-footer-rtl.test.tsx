import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { COMPANY_NAME_FA, COMPANY_WEBSITE, SiteFooter } from '../src/components/SiteFooter';

describe('canonical company footer', () => {
  it('clearly names the owner, links the canonical corporate site and works in RTL', () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('aria-label="مالکیت و اطلاعات شرکت سازندهٔ درس‌چین"');
    expect(html).toContain('پروژه‌ای از شرکت');
    expect(html).toContain(COMPANY_NAME_FA);
    expect(html).toContain('کلیهٔ حقوق مادی و معنوی سامانهٔ درس‌چین متعلق به شرکت');
    expect(html).toContain(`href="${COMPANY_WEBSITE}"`);
    expect(html).toContain('tnacompany.ir');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('®');
    expect(html).not.toContain('شماره ثبت');
  });

  it('uses a dynamically computed Persian calendar year instead of a hardcoded 2026 notice', () => {
    const currentYear = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' })
      .format(new Date());
    expect(renderToStaticMarkup(<SiteFooter />)).toContain(`© ${currentYear}`);
  });

  it('keeps intentional center alignment on mobile and readable wide-screen balance', () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    expect(html).toContain('text-center');
    expect(html).toContain('md:flex-row');
    expect(html).toContain('md:text-right');
    expect(html).toContain('min-h-11');
  });
});

describe('Persian alignment and footer integration contract', () => {
  it('retains an RTL default but never overrides all headings and paragraphs to right-align', () => {
    const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
    expect(css).toContain('direction: rtl');
    expect(css).toContain('.darschin-page { min-inline-size: 0; text-align: right; }');
    expect(css).not.toMatch(/\.darschin-page\s+:where\(h1,\s*h2,\s*h3,\s*h4,\s*p\)\s*\{\s*text-align:\s*right/);
  });

  it('uses one top-level footer rather than duplicate per-route footers', () => {
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
    expect(app).toContain('<SiteFooter />');
    for (const path of ['Landing.tsx', 'PlannerDemo.tsx', 'DemoWorkspace.tsx']) {
      const page = readFileSync(new URL(`../src/pages/${path}`, import.meta.url), 'utf8');
      expect(page).not.toContain('<footer');
    }
    const recommendation = readFileSync(
      new URL('../src/pages/landing-sections/RecommendationSection.tsx', import.meta.url), 'utf8'
    );
    expect(recommendation).toContain('text-center md:text-right');
    expect(recommendation).not.toContain('text-left md:text-right');
    const demo = readFileSync(new URL('../src/pages/DemoWorkspace.tsx', import.meta.url), 'utf8');
    expect(demo).toContain('محدودیت محیط آزمایشی');
  });
});
