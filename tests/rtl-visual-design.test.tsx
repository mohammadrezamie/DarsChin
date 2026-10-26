import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FluidWeekTimetable } from '../src/components/FluidWeekTimetable';
import { ScheduleSection } from '../src/pages/landing-sections/ScheduleSection';

const read = (path:string) => readFileSync(resolve(process.cwd(), path),'utf8');

describe('Persian-first responsive UI guardrails',()=>{
  it('bundles Vazirmatn locally, sets RTL at document and CSS level and retains manual theme classes',()=>{
    const html=read('index.html');
    const css=read('src/index.css');
    const fonts=read('src/fonts.css');
    expect(html).toContain('lang="fa" dir="rtl"');
    expect(css).toContain('html {');
    expect(css).toContain('direction: rtl;');
    expect(css).toContain("font-family: 'Vazirmatn'");
    expect(css).toContain('@custom-variant dark');
    expect(fonts).toContain('font-display: swap');
    expect(fonts).toContain("url('../extension/fonts/");
    expect(fonts).toContain('font-weight: 100 900;');
    expect(fonts).not.toContain('fonts.googleapis.com');
  });
  it('keeps 320px layouts usable without forcing global horizontal scroll',()=>{
    const css=read('src/index.css');
    expect(css).toContain('overflow-x: clip');
    expect(css).toContain('@media (max-width: 639px)');
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('.darschin-crud-table td[data-label]');
    expect(css).toContain('.darschin-people-table td[data-label]');
    expect(css).toContain('font-size: 16px;'); // avoid iOS input focus zoom
    const student=read('src/components/StudentDashboard.tsx');
    expect(student).toContain('darschin-scroll-x flex flex-nowrap');
    expect(student).toContain('sticky top-[68px]');
    expect(student).toContain('justify-start');
  });
  it('shows Persian attribute labels for admin rows and root permission controls',()=>{
    const crud=read('src/components/AdminCrudTable.tsx');
    expect(crud).toContain('data-label={c.label}');
    expect(crud).toContain('data-label="عملیات"');
    expect(crud).toContain('darschin-crud-table');
    const users=read('src/components/UserManagement.tsx');
    expect(users).toContain('darschin-people-table');
    expect(users).toContain('data-label="مجوزها"');
    expect(users).toContain('accent-blue-600');
    expect(users).not.toContain('className="hidden"');
  });
  it('provides dismissible right-hand mobile drawers with keyboard focus trapping and scroll lock',()=>{
    for (const file of ['src/pages/Landing.tsx','src/components/Navbar.tsx']){
      const s=read(file);
      expect(s).toContain('darschin-drawer');
      expect(s).toContain('aria-modal="true"');
      expect(s).toContain("document.body.style.overflow = 'hidden'");
      // Preserve the main-branch regression guard: both Tab-branch styles are valid.
      expect(s).toMatch(/event\\.key\\s*(?:===|!==)\\s*'Tab'/);
      expect(s).toContain('event.shiftKey');
      expect(s).toContain('event.preventDefault()');
      expect(s).toContain('right-0');
    }
    expect(read('src/index.css')).toContain('@media (prefers-reduced-motion: reduce)');
    expect(read('src/pages/landing-sections/HeroSection.tsx')).toContain('useReducedMotion()');
  });
  it('constrains long RTL modals within small device height and exposes accessible close controls',()=>{
    const css=read('src/index.css');
    expect(css).toContain('.darschin-dialog');
    expect(css).toContain('92dvh');
    for (const file of [
      'src/components/AcademicProfileModal.tsx',
      'src/components/ImportOfferingsModal.tsx',
      'src/components/ExtensionModal.tsx',
      'src/components/PasswordChangeModal.tsx',
    ]) {
      const component=read(file);
      expect(component).toContain('darschin-dialog');
      expect(component).toContain('aria-modal="true"');
    }
    expect(read('src/components/AcademicProfileModal.tsx')).toContain('aria-label="بستن تنظیمات پروندهٔ تحصیلی"');
    expect(read('src/components/ExtensionModal.tsx')).toContain('aria-label="بستن پنجرهٔ افزونه"');
  });

  it('renders 07–20 timetable with an accessible day-by-day mobile panel and desktop all-days grid',()=>{
    const html=renderToStaticMarkup(<FluidWeekTimetable entries={[
      {id:'m',title:'مدارهای الکتریکی',day:'شنبه',start:'07:25',end:'09:10'},
      {id:'z',title:'پروژه بدون ساعت',day:null,start:null,end:null},
    ]}/>);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('۰۷:۰۰ تا ۲۰:۰۰');
    expect(html).toContain('07:00');
    expect(html).toContain('20:00');
    expect(html).toContain('پروژه بدون ساعت');
    expect(html).toContain('md:block');
  });

  it('fits the landing conflict preview on phones without clipping teacher names or forcing a wide grid', () => {
    const code = read('src/pages/landing-sections/ScheduleSection.tsx');
    const html = renderToStaticMarkup(<ScheduleSection />);

    // All schedule details are accessible in narrow-screen cards, not clipped
    // inside absolutely positioned fixed-width timetable cells.
    expect(html).toContain('aria-label="برنامهٔ هفتگی نمونه به تفکیک روز"');
    expect(html).toContain('aria-label="جدول هفتگی نمونه"');
    expect(html).toContain('دکتر احمدی');
    expect(html).toContain('دکتر کریمی');
    expect(html).toContain('دکتر رضایی');
    expect(html).toContain('گروه جایگزین در این مثال');
    expect(html).toContain('تداخل نمونه با');
    expect(code).toContain('grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden');
    expect(code).toContain('hidden min-w-0 lg:block');
    expect(code).toContain('grid-cols-[5rem_repeat(5,minmax(0,1fr))]');
    expect(code).toContain('[overflow-wrap:anywhere]');
    expect(code).toContain('shrink-0');
    expect(code).not.toContain('min-w-[700px]');
    expect(code).not.toContain('overflow-x-auto');
    expect(code).not.toContain('absolute inset-2');
    expect(code).not.toContain('left-full');
  });

  it('keeps other landing panels readable on small RTL screens', () => {
    const recommendation = read('src/pages/landing-sections/RecommendationSection.tsx');
    const eligibility = read('src/pages/landing-sections/EligibilitySection.tsx');
    const hero = read('src/pages/landing-sections/HeroSection.tsx');

    expect(recommendation).toContain('flex-wrap items-start justify-between gap-3');
    expect(recommendation).toContain('[overflow-wrap:anywhere]');
    expect(recommendation).toContain('text-[clamp(1.8rem,5vw,3rem)]');
    expect(recommendation).toContain('useReducedMotion()');
    expect(eligibility).toContain('min-h-[300px]');
    expect(eligibility).toContain('text-[clamp(1.8rem,5vw,3rem)]');
    expect(eligibility).toContain('useReducedMotion()');
    expect(hero).toContain('min-w-0 max-w-2xl');
    expect(hero).toContain('break-words text-sm font-extrabold');
    expect(hero).not.toContain('block truncate text-sm font-extrabold');
  });
});
