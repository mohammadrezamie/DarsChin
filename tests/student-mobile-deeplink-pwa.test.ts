import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { studentWorkspaceFromSearch, studentWorkspaceSearch } from '../src/utils/student-workspace-navigation';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('mobile student app launch and deep links', () => {
  it('recognizes every student workspace and rejects unexpected routes', () => {
    for (const value of ['offerings', 'schedule', 'registration', 'recommendations', 'passed', 'demand', 'support']) {
      expect(studentWorkspaceFromSearch('?tab=' + value)).toBe(value);
    }
    expect(studentWorkspaceFromSearch('?tab=admin')).toBe('offerings');
    expect(studentWorkspaceFromSearch('?tab=')).toBe('offerings');
    expect(studentWorkspaceFromSearch('')).toBe('offerings');
  });

  it('keeps existing harmless URL parameters intact when switching tabs', () => {
    expect(studentWorkspaceSearch('schedule', '?utm_source=app&tab=offerings')).toBe('?utm_source=app&tab=schedule');
    expect(studentWorkspaceFromSearch(studentWorkspaceSearch('registration'))).toBe('registration');
  });

  it('installs as a student-oriented standalone app with native OS shortcuts', () => {
    const manifest = JSON.parse(read('public/manifest.webmanifest'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/dashboard?tab=offerings');
    expect(manifest.shortcuts.map((item: { url: string }) => item.url))
      .toEqual(['/dashboard?tab=offerings', '/dashboard?tab=schedule', '/dashboard?tab=registration']);
    expect(manifest.shortcuts.some((item: { url: string }) => item.url.includes('admin'))).toBe(false);
  });

  it('supports hardware back and PWA shortcut routing without leaking admin controls', () => {
    const dashboard = read('src/components/StudentDashboard.tsx');
    expect(dashboard).toContain('useSearchParams');
    expect(dashboard).toContain("studentWorkspaceFromSearch(location.search)");
    expect(dashboard).toContain('setSearchParams(previous =>');
    expect(dashboard).toContain('navigateWorkspace(tab)');
    expect(dashboard).toContain('darschin-mobile-home');
    expect(dashboard).not.toContain('پنل مدیریت');
  });

  it('protects both safe areas and preserves accessible thumb controls', () => {
    expect(read('index.html')).toContain('viewport-fit=cover');
    expect(read('src/index.css')).toContain('safe-area-inset-top');
    const dock = read('src/components/StudentMobileDock.tsx');
    expect(dock).toContain('safe-area-inset-bottom');
    expect(dock).toContain('min-h-14');
    expect(read('src/App.tsx')).toContain('px-3 py-3 sm:px-6');
  });
});
