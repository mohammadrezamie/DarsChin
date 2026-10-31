import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DemoWorkspace } from '../src/pages/DemoWorkspace';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const adminSource = () => readFileSync(resolve(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf8');
import { ADMIN_TABS, resolveAdminTab, adminWorkspaceAccess } from '../src/utils/admin-navigation';

describe('admin workspace navigation', () => {
  it('resolves only known deep links and falls back safely', () => {
    expect(resolveAdminTab(null, false)).toBe('overview');
    expect(resolveAdminTab('', false)).toBe('overview');
    expect(resolveAdminTab('courses', false)).toBe('courses');
    expect(resolveAdminTab('prerequisites', true)).toBe('overview');
    expect(resolveAdminTab('toString', true)).toBe('overview');
    expect(new Set(ADMIN_TABS).size).toBe(ADMIN_TABS.length);
  });

  it('prevents privileged workspace links for other admins', () => {
    for (const tab of ['academic-settings', 'users', 'diagnostics', 'logs']) {
      expect(resolveAdminTab(tab, false)).toBe('overview');
      expect(resolveAdminTab(tab, true)).toBe(tab);
    }
    expect(resolveAdminTab('support', false)).toBe('support');
  });

  it('only enables the demand workspace for an explicitly scoped, permitted department manager', () => {
    const scope = { campusId: 'campus-srb', degreeLevelId: 'be', majorId: 'ee' };
    expect(adminWorkspaceAccess(null).isAdmin).toBe(false);
    expect(adminWorkspaceAccess({ roles: ['student'], permissions: ['admin.panel.access'] }).isAdmin).toBe(false);
    expect(adminWorkspaceAccess({ roles: ['admin'], permissions: ['demand.manage'] }).isAdmin).toBe(false);
    expect(adminWorkspaceAccess({ roles: ['admin'], permissions: ['demand.manage'], demandScopes: [scope] }))
      .toMatchObject({ demandOnly: true, hasFullPanel: false, isAdmin: true });
    expect(adminWorkspaceAccess({ roles: ['admin'], permissions: ['admin.panel.access'], demandScopes: [scope] }))
      .toMatchObject({ demandOnly: false, hasFullPanel: true, isAdmin: true });
    expect(adminWorkspaceAccess({ roles: ['super-admin'] }))
      .toMatchObject({ isSuperAdmin: true, demandOnly: false, isAdmin: true });
  });

  it('keeps deep links, searchable navigation and section headings available after lazy loading', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/demo/admin?tab=courses']}>
        <DemoWorkspace role="admin" />
      </MemoryRouter>,
    );
    expect(html).toContain('مدیر آزمایشی');
    expect(resolveAdminTab('courses', true)).toBe('courses');
    const source = adminSource();
    expect(source).toContain('جست‌وجوی بخش‌های مدیریت');
    expect(source).toContain('میز کار / {activeCategory}');
    expect(source).toContain('aria-current={active ? \'page\' : undefined}');
    expect(source).toContain("activeTab === 'courses' && (");
  });

  it('does not render a nonexistent workspace for an invalid query', () => {
    expect(resolveAdminTab('prerequisites', true)).toBe('overview');
    const source = adminSource();
    expect(source).toContain("resolveAdminTab(searchParams.get('tab'), isSuperAdmin)");
    expect(source).toContain("id: 'overview' as AdminTab");
    expect(source).toContain("activeTab === 'overview' && (");
  });
});
