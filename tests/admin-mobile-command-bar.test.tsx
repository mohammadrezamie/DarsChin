import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DemoWorkspace } from '../src/pages/DemoWorkspace';

const source = () => readFileSync(resolve(process.cwd(), 'src/components/AdminDashboard.tsx'),'utf8');

describe('compact accessible mobile administration shell', () => {
  it('keeps a labelled workspace switcher available below the header in small layouts', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/demo/admin?tab=courses']}>
        <DemoWorkspace role="admin" />
      </MemoryRouter>,
    );
    expect(html).toContain('aria-label="ناوبری سریع مدیریت"');
    expect(html).toContain('aria-controls="admin-mobile-navigation"');
    expect(html).toContain('aria-label="بازکردن فهرست بخش‌های مدیریت"');
    expect(html).toContain('در حال مدیریت');
    expect(html).toContain('بانک دروس');
    expect(html).toContain('min-h-11');
    expect(html).toContain('top-0');
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
    expect(s).toContain("isBrowserDemo ? 'top-0' : ''");
  });

  it('compresses the title and moves the current section into the always-visible navigation', () => {
    const s = source();
    expect(s).not.toContain('DARSCHIN / CONTROL CENTER');
    expect(s).toContain('سامانهٔ مدیریت آموزشی');
    expect(s).toContain('مرکز مدیریت درس‌چین');
    expect(s).toContain('mt-2 hidden max-w-xl');
    expect(s).toContain("activeNavigation?.label || 'داشبورد و آمار'");
    expect(s).toContain('px-3.5 py-3.5');
  });
});
