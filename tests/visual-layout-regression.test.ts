import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(p:string)=>readFileSync(p,'utf8');
describe('بازبینی ساختاری رابط درس‌چین',()=>{
  it('سطح روشن و تاریک از پالت دانشگاهی پیروی می‌کنند',()=>{
    const css=read('src/index.css');
    expect(css).toContain('--dc-glass: rgb(255 255 255 / 96%);');
    expect(css).toContain('--dc-glass: rgb(22 34 53 / 96%);');
    expect(css).not.toContain('rgb(16 42 43 / 91%)');
    expect(css).toContain('.dc-landing-header,.darschin-global-nav,.dc-student-dock { background:var(--darschin-surface)');
  });
  it('سربرگ در عرض میانی کنترل فشرده و مسیر صفحه‌کلید دارد',()=>{
    const landing=read('src/pages/Landing.tsx');
    const theme=read('src/components/ThemeToggle.tsx');
    expect(landing).toContain('gap-1 2xl:flex');
    expect(landing).toContain('href="#main-content"');
    expect(landing).toContain('<main id="main-content">');
    expect(theme).toContain('lg:hidden');
    expect(theme).toContain('lg:inline-flex');
  });
  it('متن کم‌رنگ جزئیات دانشجو و حداقل عرض بزرگ حذف شده‌اند',()=>{
    const student=read('src/components/StudentDashboard.tsx');
    expect(student).not.toContain('text-[10px] leading-5 text-teal-100');
    expect(student).toContain('lg:min-w-[16rem]');
    expect(student).toContain('bg-amber-800 px-3 py-2');
  });
  it('ستون‌های صفحهٔ اول امکان کوچک شدن دارند و به مقصد مدیریت می‌رسند',()=>{
    const hero=read('src/pages/landing-sections/HeroSection.tsx');
    const manager=read('src/pages/landing-sections/DashboardShowcaseSection.tsx');
    expect(hero).toContain('lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]');
    expect(hero).toContain('href="#manager-workspace"');
    expect(manager).toContain('id="manager-workspace"');
    expect(manager).toContain('publicDemoEnabled && <div');
  });
});
