import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { adminWorkspaceAccess } from '../src/utils/admin-navigation';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('separate administrator and student workspaces', () => {
  it('keeps the student workspace for all authenticated roles', () => {
    const app = read('src/App.tsx');
    const student = read('src/components/StudentDashboard.tsx');
    expect(app).toContain('<Route element={<ProtectedRoute />}>');
    expect(app).toContain('<Route path="/dashboard" element={<StudentDashboard />} />');
    expect(student).toContain('if (user) void fetchDashboardData()');
    expect(student).toContain('if (!user) {');
    expect(student).not.toContain("!user.roles?.includes('student')");
    expect(student).not.toContain("!user.roles.includes('student')");
  });

  it('never grants the administrator workspace from an ordinary student account', () => {
    const app = read('src/App.tsx');
    expect(app).toContain("<ProtectedRoute allowedRoles={['admin']}");
    expect(adminWorkspaceAccess({roles:['student'],permissions:[]}).isAdmin).toBe(false);
    expect(adminWorkspaceAccess({roles:['admin'],permissions:['admin.panel.access']}).isAdmin).toBe(true);
    expect(adminWorkspaceAccess({roles:['super-admin'],permissions:[]}).isAdmin).toBe(true);
  });

  it('does not discard a direct demand survey link until account-specific availability returns', () => {
    const student = read('src/components/StudentDashboard.tsx');
    expect(student).toContain('demandCheckedFor === user?.id');
    expect(student).toContain('setDemandCheckedFor(user.id)');
    expect(student).toContain("navigateWorkspace('offerings', true)");
  });

  it('keeps mobile installation guidance and unrelated desktop-only extensions separate', () => {
    const dock = read('src/components/StudentMobileDock.tsx');
    const nav = read('src/components/Navbar.tsx');
    expect(dock).toContain('Add to Home Screen');
    expect(dock).toContain('Install app');
    expect(dock).not.toContain('پنل مدیریت');
    expect(nav).toContain('onClick={() => setExtModalOpen(true)}');
    expect(nav).not.toContain("closeMenu(); setExtModalOpen(true)");
  });
});
