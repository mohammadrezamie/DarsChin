import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');
const css = read('src/index.css');
const light = css.slice(css.indexOf('/*\n * هویت بصری درس‌چین'));
const darkStart = light.indexOf(':root.dark {');
const tokensLight = light.slice(0, darkStart);
const tokensDark = light.slice(darkStart, light.indexOf('@layer base', darkStart));
const hex = (source: string, token: string) => {
  const match = source.match(new RegExp('(?:^|\\n)\\s*' + token + ':\\s*(#[a-fA-F0-9]{6})', 'm'));
  if (!match) throw new Error('توکن رنگ یافت نشد: ' + token);
  return match[1].toLowerCase();
};
const brightness = (color: string) => {
  const rgb = color.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
};
const contrast = (a: string, b: string) => {
  const top = Math.max(brightness(a), brightness(b));
  const bottom = Math.min(brightness(a), brightness(b));
  return (top + .05) / (bottom + .05);
};

describe('هویت بصری فیروزه‌ای/زعفرانی درس‌چین', () => {
  it('متن اصلی و رنگ برند در روز و شب حداقل کنتراست AA را دارند', () => {
    const dayPaper = hex(tokensLight, '--darschin-surface');
    const nightPaper = hex(tokensDark, '--darschin-surface');
    for (const [label, tokens, surface] of [
      ['روز', tokensLight, dayPaper],
      ['شب', tokensDark, nightPaper],
    ] as const) {
      expect(contrast(hex(tokens, '--darschin-text'), surface), label + ' متن').toBeGreaterThanOrEqual(4.5);
      expect(contrast(hex(tokens, '--darschin-brand'), surface), label + ' برند').toBeGreaterThanOrEqual(4.5);
      expect(contrast(hex(tokens, '--darschin-muted'), surface), label + ' متن ثانویه').toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(hex(tokensLight, '--darschin-accent'), dayPaper)).toBeGreaterThanOrEqual(4.5);
  });

  it('پالت در دو تم واقعاً متفاوت است و رنگ‌های هوشمندانهٔ مشترک دارد', () => {
    expect(hex(tokensLight, '--darschin-surface')).not.toBe(hex(tokensDark, '--darschin-surface'));
    expect(hex(tokensLight, '--darschin-brand')).not.toBe(hex(tokensDark, '--darschin-brand'));
    expect(css).toContain('.dc-brand-text');
    expect(css).toContain('.dc-primary-action');
    expect(css).toContain('.dc-hero-preview');
    expect(css).toContain('.dc-demo-entry');
    expect(css).toContain('.dc-student-dock');
    expect(css).toContain('.dc-stepper');
    expect(css).toContain('.darschin-admin-panel');
  });

  it('تعامل با موبایل، دسترس‌پذیری و خروجی چاپ قربانی تغییر ظاهر نشده است', () => {
    expect(css).toContain('env(safe-area-inset-bottom');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (forced-colors: active)');
    expect(css).toContain('@media print');
    const theme = read('src/context/ThemeContext.tsx');
    const html = read('index.html');
    expect(theme).toContain("isDark ? '#0a1b1d' : '#f4faf7'");
    expect(html).toContain("dark ? '#0a1b1d' : '#f4faf7'");
    expect(html).toContain('name="theme-color" content="#f4faf7"');
  });

  it('نقاط ورود کاربر واقعاً از استایل جدید استفاده می‌کنند', () => {
    expect(read('src/pages/Landing.tsx')).toContain('dc-landing-header');
    expect(read('src/pages/Landing.tsx')).toContain('dc-demo-entry');
    expect(read('src/pages/landing-sections/HeroSection.tsx')).toContain('dc-hero-preview');
    expect(read('src/components/Navbar.tsx')).toContain('dc-brand-mark');
    expect(read('src/components/StudentMobileDock.tsx')).toContain('dc-student-dock');
    expect(read('src/components/StudentJourneyStepper.tsx')).toContain('dc-stepper');
  });
});
