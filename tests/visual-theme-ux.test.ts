import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isValidIranianMobileInput, normalizeIranianMobileInput } from '../src/utils/iranian-mobile';

const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const css = source('src/index.css');

function readColor(variable: string, scope: ':root' | ':root.dark'): string {
  // Locate the last definition within the selected scope: the aurora tokens
  // intentionally override the older progressive design-system values.
  const matches = [...css.matchAll(/:root(?:\.dark)?\s*\{([^}]+)\}/g)]
    .filter(match => match[0].startsWith(scope === ':root.dark' ? ':root.dark' : ':root {'));
  const definitions = matches.map(m => m[1].match(new RegExp(`--${variable}:\\s*(#[0-9a-fA-F]{6})`))?.[1]).filter(Boolean);
  if (!definitions.length) throw new Error(`Missing ${scope} --${variable}`);
  return definitions.at(-1)!;
}
function luminance(hex: string): number {
  const parts = hex.slice(1).match(/.{2}/g)!.map(n => parseInt(n,16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
  return .2126*parts[0] + .7152*parts[1] + .0722*parts[2];
}
function contrast(a: string, b: string): number {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x,y)=>x-y);
  return (hi+.05)/(lo+.05);
}

describe('visual identity day/night accessibility and layout contracts', () => {
  it('keeps readable primary/muted text and opaque brand CTA on both themes', () => {
    for (const scope of [':root', ':root.dark'] as const) {
      const bg = readColor('darschin-surface', scope);
      const primary = readColor('darschin-text', scope);
      const muted = readColor('darschin-muted', scope);
      expect(contrast(bg, primary)).toBeGreaterThanOrEqual(7);
      expect(contrast(bg, muted)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast('#314bca', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#4938bf', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain('@media (forced-colors: active)');
  });

  it('does not overwrite marketing text-center utilities through unlayered RTL CSS', () => {
    expect(css).not.toMatch(/\.darschin-page\s+:where\(h1, h2, h3, h4, p\)\s*\{\s*text-align:\s*right/);
    expect(css).toContain('direction: rtl;');
    expect(css).toContain('text-align: start;');
    expect(source('src/pages/landing-sections/DashboardShowcaseSection.tsx')).toContain('text-center');
  });

  it('uses one semantic theme across every primary product surface', () => {
    for (const file of ['src/pages/Landing.tsx','src/pages/DemoWorkspace.tsx']) {
      expect(source(file)).toContain('darschin-product-page');
    }
    expect(source('src/components/Navbar.tsx')).toContain('darschin-product-header');
    expect(source('src/components/StudentMobileDock.tsx')).toContain('darschin-mobile-dock');
    expect(source('src/components/StudentDashboard.tsx')).toContain('darschin-student-workspace');
    expect(source('src/components/AdminDashboard.tsx')).toContain('darschin-admin-workspace');
    expect(source('src/pages/landing-sections/HeroSection.tsx')).toContain('darschin-hero-preview');
    expect(source('src/pages/landing-sections/HeroSection.tsx')).toContain('darschin-primary-cta');
  });

  it('preserves dark and system-mode behavior and keeps the mobile browser color in sync', () => {
    const theme = source('src/context/ThemeContext.tsx');
    expect(theme).toContain("theme === 'system'");
    expect(theme).toContain("root.classList.toggle('dark', isDark)");
    expect(theme).toContain("'#090f1e' : '#f5f7fc'");
    expect(css).toContain(':root.dark');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    const initialDocument = source('index.html');
    expect(initialDocument).toContain('content="#f5f7fc"');
    expect(initialDocument).toContain("dark ? '#090f1e' : '#f5f7fc'");
  });
  it('allows actual Iranian mobile formats in the login journey without weakening server validation', () => {
    const examples = ['۰۹۱۲۳۴۵۶۷۸۹','٠٩١٢٣٤٥٦٧٨٩','+989123456789','۰۰۹۸۹۱۲۳۴۵۶۷۸۹','0912 345 6789'];
    for (const sample of examples) {
      expect(isValidIranianMobileInput(sample)).toBe(true);
      expect(normalizeIranianMobileInput(sample)).toBe('09123456789');
    }
    expect(isValidIranianMobileInput('0912345')).toBe(false);
    const login = source('src/pages/auth/Login.tsx');
    expect(login).toContain('isValidIranianMobileInput(mobile)');
    expect(login).toContain('setMobile(normalizeIranianMobileInput(mobile))');
    expect(login).toContain('login(normalizeIranianMobileInput(mobile), password, captchaToken)');
  });

  it('keeps course filters and icon-only account links accessible to assistive technology', () => {
    const courses = source('src/components/OfferingsList.tsx');
    expect(courses).toContain('id="selectOfferingsCategoryFilter"');
    expect(courses).toContain('aria-label="دسته‌بندی دروس ارائه‌شده"');
    for (const filename of [
      'src/pages/auth/Login.tsx',
      'src/pages/auth/Register.tsx',
      'src/pages/auth/ForgotPassword.tsx',
    ]) {
      expect(source(filename)).toContain('aria-label="بازگشت به صفحه اصلی درس‌چین"');
    }
    const hero = source('src/pages/landing-sections/HeroSection.tsx');
    expect(hero).toContain('text-slate-700 dark:text-slate-300">{offering.code}');
    expect(source('src/pages/landing-sections/RecommendationSection.tsx'))
      .toContain('bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300');
  });

});
