import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { DashboardShowcaseSection } from '../src/pages/landing-sections/DashboardShowcaseSection';
import { StudentGuide } from '../src/pages/StudentGuide';
import { ContextualHelp } from '../src/components/ContextualHelp';
import { adminWorkspaceAccess } from '../src/utils/admin-navigation';
import { adminSectionHelp } from '../src/help/admin-sections';
import { studentSectionHelp } from '../src/help/student-sections';

const read = (p: string) => readFileSync(resolve(process.cwd(),p),'utf8');

describe('student-first product and private management contract', () => {
  it('does not advertise administration in public landing, showcase, or student demo', () => {
    for (const path of ['src/pages/Landing.tsx','src/pages/PlannerDemo.tsx','src/pages/DemoWorkspace.tsx','src/pages/auth/Login.tsx']) {
      expect(read(path)).not.toContain('to="/demo/admin"');
    }
    const html = renderToStaticMarkup(<MemoryRouter><DashboardShowcaseSection /></MemoryRouter>);
    expect(html).toContain('میز کار دانشجو');
    expect(html).not.toContain('پنل مدیریت');
    expect(html).not.toContain('مدیریت کاربران');
    expect(html).not.toContain('/demo/admin');
  });

  it('requires a real logged-in administrative role before rendering the admin demonstration', () => {
    const app=read('src/App.tsx');
    expect(app).toContain('const AdminDemoGate');
    expect(app).toContain('if (!user) return <Navigate to="/login" replace />');
    expect(app).toContain('if (!adminWorkspaceAccess(user).isAdmin)');
    expect(app).toContain('<Route path="/demo/admin" element={<AdminDemoGate />} />');
    expect(adminWorkspaceAccess({ roles: ['student'], permissions: [] }).isAdmin).toBe(false);
    expect(adminWorkspaceAccess({ roles: ['admin'], permissions: ['admin.panel.access'] }).isAdmin).toBe(true);
    expect(read('src/pages/auth/Login.tsx')).toContain('adminWorkspaceAccess(result.user).isAdmin');
    const management = read('src/components/UserManagement.tsx');
    expect(management).not.toContain("id: 'admin.create'");
    expect(management).not.toContain("id: 'admin.manage'");
    expect(adminWorkspaceAccess({ roles: ['student'], permissions: ['admin.panel.access'] }).isAdmin).toBe(false);
  });

  it('has a public student-only searchable guide with useful help sections and FAQ', () => {
    const html = renderToStaticMarkup(<MemoryRouter><StudentGuide /></MemoryRouter>);
    expect(html).toContain('راهنمای جامع دانشجو');
    expect(html).toContain('سؤال‌های متداول');
    expect(html).toContain('تداخل');
    expect(html).toContain('aria-label="ناوبری راهنمای دانشجو"');
    expect(html).not.toContain('پنل مدیریت');
    expect(html).not.toContain('مدیریت مدیران');
    expect(html).not.toContain('/demo/admin');
    expect(read('src/App.tsx')).toContain('<Route path="/help" element={<StudentGuide />} />');
    expect(read('src/components/StudentMobileDock.tsx')).toContain('to="/help"');
  });

  it('provides role-specific contextual help rather than mixing administrator instructions into student screens', () => {
    const student = renderToStaticMarkup(<ContextualHelp content={studentSectionHelp.schedule} audience="student" />);
    const admin = renderToStaticMarkup(<ContextualHelp content={adminSectionHelp('academic-rules')} audience="admin" />);
    expect(student).toContain('برنامهٔ هفتگی و تداخل‌سنج');
    expect(student).toContain('href="/help"');
    expect(student).not.toContain('پیش‌نویس');
    expect(admin).toContain('پیش‌نیاز و هم‌نیاز');
    expect(admin).not.toContain('href="/help"');
    expect(read('src/components/StudentDashboard.tsx')).toContain('studentSectionHelp[activeTab]');
    expect(read('src/components/AdminDashboard.tsx')).toContain('adminSectionHelp(activeTab)');
  });

  it('provides standalone display metadata while leaving private pages out of offline caches', () => {
    const manifest=JSON.parse(read('public/manifest.webmanifest'));
    expect(manifest.short_name).toBe('درس‌چین');
    expect(manifest.dir).toBe('rtl');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/dashboard?tab=offerings');
    expect(manifest.shortcuts.map((shortcut: { url: string }) => shortcut.url))
      .toEqual(expect.arrayContaining(['/dashboard?tab=schedule', '/dashboard?tab=registration']));
    expect(manifest.shortcuts.some((shortcut: { url: string }) => shortcut.url.includes('admin'))).toBe(false);
    expect(manifest.icons).toEqual(expect.arrayContaining([expect.objectContaining({src:'/app-icon.svg'})]));
    expect(read('index.html')).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(read('public/app-icon.svg')).toContain('<svg');
    expect(read('src/pages/StudentGuide.tsx')).not.toContain('localStorage');
  });
});
