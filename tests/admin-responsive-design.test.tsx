import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AdminDashboard } from '../src/components/AdminDashboard';
import { AdminCrudTable } from '../src/components/AdminCrudTable';
import { DemoAuthProvider } from '../src/context/AuthContext';
import { ThemeToggle } from '../src/components/ThemeToggle';
import { ThemeProvider } from '../src/context/ThemeContext';
import { DemoWorkspace } from '../src/pages/DemoWorkspace';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('mobile-first admin and typography redesign', () => {
  it('renders the actual demo admin inside a structured new management shell', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/demo/admin']}><DemoWorkspace role="admin" /></MemoryRouter>);
    expect(html).toContain('مرکز مدیریت درس‌چین');
    expect(html).toContain('DARSCHIN / CONTROL CENTER');
    expect(html).toContain('بخش‌های مدیریت');
    expect(html).toContain('ناوبری دسکتاپ مدیریت');
    expect(html).toContain('aria-label="انتخاب حالت نمایش"');
    expect(html).toContain('aria-controls="admin-mobile-navigation"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('داده‌های آموزشی');
    expect(html).toContain('نمایش آزمایشی، بدون سرور');
    expect(html).toContain('مدیریت / پیشخوان');
  });

  it('provides mobile card layouts and desktop tables in reusable CRUD', () => {
    const html = renderToStaticMarkup(
      <AdminCrudTable title="دروس نمونه" endpoint="/api/academic/courses"
        columns={[{key:'name',label:'عنوان درس'}, {key:'units',label:'واحد',type:'number'}]} />,
    );
    expect(html).toContain('رکوردهای دروس نمونه');
    expect(html).toContain('md:hidden');
    expect(html).toContain('md:block');
    expect(html).toContain('افزودن مورد جدید');
  });

  it('exposes three accessible theme states', () => {
    const html = renderToStaticMarkup(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    expect(html).toContain('aria-label="انتخاب حالت نمایش"');
    expect(html).toContain('aria-label="حالت روز"');
    expect(html).toContain('aria-label="حالت خودکار"');
    expect(html).toContain('aria-label="حالت شب"');
    expect(html).toContain('aria-pressed="true"');
  });

  it('loads the repository-local Persian font assets instead of silently falling back', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    const ext = readFileSync(resolve(process.cwd(), 'extension/fonts.css'), 'utf8');
    expect(css).toContain('@import "../extension/fonts.css"');
    expect(css).toContain("'Vazirmatn'");
    expect(ext).toContain("font-family: 'Vazirmatn'");
    expect(ext).toContain('.woff2');
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain("darschyn_theme_mode");
    expect(html).toContain("document.documentElement.classList.toggle('dark'");
  });
});
