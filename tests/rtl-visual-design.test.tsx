import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FluidWeekTimetable } from '../src/components/FluidWeekTimetable';

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
    expect(student).toContain('min-[390px]:grid-cols-2');
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
      expect(s).toContain("event.key === 'Tab'");
      expect(s).toContain('right-0');
    }
    expect(read('src/index.css')).toContain('@media (prefers-reduced-motion: reduce)');
    expect(read('src/pages/landing-sections/HeroSection.tsx')).toContain('useReducedMotion()');
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
});
