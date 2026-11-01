import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { initialRegistrationStage } from '../src/domain/student-flow-stage';
import { StudentWishlistBuilder } from '../src/components/StudentWishlistBuilder';

const src = (name: string) => readFileSync(name, 'utf8');

describe('موقت‌بودن دمو و بازیابی تجربهٔ دانشجو', () => {
  it('بدون درس منتخب استاد را نشان نمی‌دهد', () => {
    expect(initialRegistrationStage(0, 2)).toBe('courses');
    expect(initialRegistrationStage(5, 0)).toBe('courses');
    expect(initialRegistrationStage(5, 2)).toBe('preferences');
    expect(initialRegistrationStage(6, 1)).toBe('preferences');
  });
  it('اولین گام از دانشجو فقط نام درس را می‌خواهد', () => {
    const html = renderToStaticMarkup(<StudentWishlistBuilder curriculumId={null}
      wishlistCourseIds={[]} evaluations={[]} recommendations={[]}
      onSave={async () => true} courseFirst />);
    expect(html).toContain('اول درس‌هایت را انتخاب کن');
    expect(html).toContain('فقط اسم درس‌های موردنظرت را انتخاب کن');
    expect(html).not.toContain('حتی ۴۰ واحد');
  });
  it('بازکردن مجدد پنل مرحله را بازیابی می‌کند و ذخیرهٔ استاد آن را ناخواسته بازنشانی نمی‌کند', () => {
    const dashboard = src('src/components/StudentDashboard.tsx');
    expect(dashboard).toContain('registrationStageOwnerRef.current !== stageContext');
    expect(dashboard).toContain('initialRegistrationStage(savedStep, chosenIds.length)');
    expect(dashboard).toContain('registrationStageOwnerRef.current = null');
  });
  it('قابلیت بستن دمو از انتشار نهایی موجود است اما نسخهٔ Pages همچنان آزمایشی می‌ماند', () => {
    expect(src('src/config/demo-availability.ts')).toContain("VITE_PUBLIC_DEMO !== 'false'");
    expect(src('src/config/demo-availability.ts')).toContain("VITE_STATIC_PREVIEW === 'true'");
    expect(src('src/App.tsx')).toContain('{publicDemoEnabled && <>');
    expect(src('src/pages/Landing.tsx')).toContain('{publicDemoEnabled && <section');
  });
  it('رنگ‌های قدیمی لندینگ جایگزین تغییرات ناخواسته شده‌اند', () => {
    const css = src('src/index.css');
    const hero = src('src/pages/landing-sections/HeroSection.tsx');
    expect(css).toContain('--dc-canvas: #f4faf7');
    expect(css).not.toContain('--dc-canvas: #fff9fc');
    expect(hero).toContain('from-teal-700 via-emerald-700 to-amber-700');
  });
});
