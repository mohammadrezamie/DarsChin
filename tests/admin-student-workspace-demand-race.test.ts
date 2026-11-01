import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shouldRedirectClosedDemand } from '../src/utils/student-workspace-navigation';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const base = {
  tab: 'demand' as const,
  dashboardLoading: false,
  currentUserId: 'admin-1',
  checkedUserId: 'admin-1',
  demandChecked: false,
  demandFailed: false,
  demandAvailable: false,
};

describe('dual-role account and survey deep links', () => {
  it('does not discard a demand deep link before its separate API lookup finishes', () => {
    expect(shouldRedirectClosedDemand(base)).toBe(false);
    expect(shouldRedirectClosedDemand({ ...base, dashboardLoading: true, demandChecked: true })).toBe(false);
  });

  it('keeps open surveys and preserves the URL when lookup fails', () => {
    expect(shouldRedirectClosedDemand({ ...base, demandChecked: true, demandAvailable: true })).toBe(false);
    expect(shouldRedirectClosedDemand({ ...base, demandChecked: true, demandFailed: true })).toBe(false);
  });

  it('redirects only after an authoritative check confirms the survey is closed', () => {
    expect(shouldRedirectClosedDemand({ ...base, demandChecked: true })).toBe(true);
    expect(shouldRedirectClosedDemand({ ...base, tab: 'offerings', demandChecked: true })).toBe(false);
  });

  it('never confuses different accounts survey permissions on session changes', () => {
    expect(shouldRedirectClosedDemand({ ...base, currentUserId: 'admin-2', demandChecked: true })).toBe(false);
    expect(shouldRedirectClosedDemand({ ...base, currentUserId: null, demandChecked: true })).toBe(false);
  });

  it('keeps the student route authenticated but not student-role-only, while admin stays gated', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('<Route element={<ProtectedRoute />}>\n                  <Route path="/dashboard"');
    expect(app).toContain('<Route element={<ProtectedRoute allowedRoles={[\'admin\']} />}>');
    const student = read('src/components/StudentDashboard.tsx');
    expect(student).not.toContain("!user.roles.includes('student')");
    expect(student).not.toContain("!user.roles?.includes('student')");
    expect(student).toContain('shouldRedirectClosedDemand({');
    expect(student).toContain('setDemandCheck({ userId: checkedFor, checked: true, failed })');
  });

  it('explains safe app installation without promises of offline academic access', () => {
    const dock = read('src/components/StudentMobileDock.tsx');
    expect(dock).toContain('نصب درس‌چین روی صفحهٔ اصلی گوشی');
    expect(dock).toContain('Add to Home Screen');
    expect(dock).toContain('Open as Web App');
    expect(dock).toContain('Install app');
    expect(dock).toContain('به اینترنت نیاز دارند');
    expect(dock).not.toContain('پنل مدیریت');
  });
});
