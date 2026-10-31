import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DemoWorkspace } from '../src/pages/DemoWorkspace';

const source = () => readFileSync(resolve(process.cwd(), 'src/components/AdminDashboard.tsx'),'utf8');

describe('compact accessible mobile administration shell', () => {
  it('keeps a labelled workspace switcher reachable on small screens after lazy loading', () => {
    const demo = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/demo/admin?tab=courses']}><DemoWorkspace role="admin" /></MemoryRouter>,
    );
    expect(demo).toContain('مدیر آزمایشی');
    const dashboard = source();
    expect(dashboard).toContain('aria-label="ناوبری سریع مدیریت"');
    expect(dashboard).toContain('aria-controls="admin-mobile-navigation"');
    expect(dashboard).toContain('aria-label="بازکردن فهرست بخش‌های مدیریت"');
    expect(dashboard).toContain('در حال مدیریت');
    expect(dashboard).toContain('activeNavigation?.label');
    expect(dashboard).toContain('min-h-11');
    expect(dashboard).toContain('top-0');
  });

  it('keeps one drawer trigger and maintains a keyboard-accessible right side drawer', () => {
    const s = source();
    expect(s).toContain('ref={menuTriggerRef}');
    expect(s.match(/ref=\{menuTriggerRef\}/g)).toHaveLength(1);
    expect(s).toContain('darschin-drawer absolute inset-y-0 right-0');
    expect(s).toContain('aria-modal="true"');
    expect(s).toContain('menuTriggerRef.current?.focus()');
    expect(s).toContain("event.key === 'Escape'");
    expect(s).toContain('z-30 flex min-w-0 items-center gap-3');
    expect(s).toContain("isBrowserDemo ? 'top-0' : 'top-[68px]'");
  });

  it('compresses the title and moves the current section into the always-visible navigation', () => {
    const s = source();
    expect(s).not.toContain('DARSCHIN / CONTROL CENTER');
    expect(s).toContain('درس‌چین / میز کار مدیریت');
    expect(s).toContain('مرکز مدیریت آموزشی');
    expect(s).toContain('hidden text-xs leading-6 text-slate-300 sm:block');
    expect(s).toContain("activeNavigation?.label || 'پیشخوان'");
    expect(s).toContain('px-4 py-4');
  });
});
