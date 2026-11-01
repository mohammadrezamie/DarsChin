import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HeroSection } from '../src/pages/landing-sections/HeroSection';
import { ThemeToggle } from '../src/components/ThemeToggle';

const source = (path:string) => readFileSync(resolve(process.cwd(),path),'utf8');

describe('UI-first student conversion: real features on small RTL screens',()=>{
  it('keeps mobile header sign-in visible without a 116px theme selector',()=>{
    const landing=source('src/pages/Landing.tsx');
    const theme=source('src/components/ThemeToggle.tsx');
    expect(landing).toContain('<Link to="/login" className="inline-flex min-h-11');
    expect(landing).toContain('min-[380px]:px-3');
    expect(landing).toContain('aria-modal="true"');
    expect(landing).toContain("event.key === 'Escape'");
    expect(theme).toContain('relative flex h-11 w-11 shrink-0');
    expect(theme).toContain('className="absolute inset-0 h-full w-full cursor-pointer');
    expect(theme).toContain('aria-label="انتخاب حالت نمایش"');
    expect(theme).not.toContain('w-[116px]');
    const themeMarkup=renderToStaticMarkup(<ThemeToggle />);
    expect(themeMarkup).toContain('<option value="system"');
    expect(themeMarkup).toContain('value="dark"');
    expect(themeMarkup).toContain('value="light"');
  });

  it('shows one primary student demo CTA and a clear signup path, with no fabricated official data',()=>{
    const hero=renderToStaticMarkup(<MemoryRouter><HeroSection /></MemoryRouter>);
    expect(hero).toContain('href="/demo/student"');
    expect(hero).toContain('href="/register"');
    expect(hero).toContain('داده‌ها نمونه‌اند');
    expect(hero).toContain('هیچ ثبت خودکاری');
    expect(hero).toContain('grid-cols-3');
    expect(hero).toContain('مزیت‌های اصلی');
    expect(hero).toContain('داده نمونه');
    expect(hero).toContain('aria-pressed="true"');
    expect(hero).not.toContain('سقف واحد رسمی دانشگاه');
  });

  it('keeps the tablet experience single-column until a genuinely wide desktop and honors reduced motion',()=>{
    const conditions=source('src/pages/landing-sections/EligibilitySection.tsx');
    const suggestions=source('src/pages/landing-sections/RecommendationSection.tsx');
    const workspace=source('src/pages/landing-sections/DashboardShowcaseSection.tsx');
    expect(conditions).toContain('lg:flex-row');
    expect(suggestions).toContain('lg:flex-row');
    expect(conditions).not.toContain('md:flex-row');
    expect(suggestions).not.toContain('md:flex-row');
    expect(conditions).toContain('style={reduceMotion ? undefined');
    expect(suggestions).toContain('style={reduceMotion ? undefined');
    expect(workspace).toContain('grid-cols-2 gap-2');
    expect(workspace).toContain('useReducedMotion()');
    expect(conditions).not.toContain('حذف محدودیت‌ها');
    expect(suggestions).not.toContain('توصیه می‌شود حتماً اخذ گردد');
  });
});
