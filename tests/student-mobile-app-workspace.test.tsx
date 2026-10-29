import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseStudentWorkspace, studentWorkspaceParams } from '../src/domain/student-workspace-navigation';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('standalone mobile-first student experience', () => {
  it('opens installed mode in the student workspace with quick actions', () => {
    const manifest = JSON.parse(source('public/manifest.webmanifest'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/dashboard');
    expect(manifest.shortcuts.map((item: {url: string}) => item.url)).toContain('/dashboard?tab=registration');
    expect(manifest.shortcuts.map((item: {url: string}) => item.url)).toContain('/dashboard?tab=schedule');
  });

  it('uses the URL as the single workspace source of truth for history and reloads', () => {
    const file = source('src/components/StudentDashboard.tsx');
    expect(file).toContain('useSearchParams()');
    expect(file).toContain("parseStudentWorkspace(searchParams.get('tab'))");
    expect(file).toContain('studentWorkspaceParams(current, tab)');
    expect(parseStudentWorkspace('admin')).toBe('offerings');
    expect(studentWorkspaceParams(new URLSearchParams(), 'passed').get('tab')).toBe('passed');
  });

  it('replaces the oversized mobile welcome card with task-focused actions', () => {
    const dashboard = source('src/components/StudentDashboard.tsx');
    expect(dashboard).toContain('darschin-student-app-header');
    expect(dashboard).toContain('md:hidden');
    expect(dashboard).toContain('hidden md:block darschin-surface');
    expect(dashboard).toContain('setProfileModalOpen(true)');
    expect(dashboard).toContain('setImportModalOpen(true)');
    expect(dashboard).toContain('setDemandChecked(true)');
    expect(dashboard).toContain('demandChecked && !demandSurveyAvailable');
  });

  it('keeps desktop and admin spacing while reducing student-mobile web chrome', () => {
    const app = source('src/App.tsx');
    const navbar = source('src/components/Navbar.tsx');
    const dock = source('src/components/StudentMobileDock.tsx');
    expect(app).toContain("location.pathname === '/dashboard'");
    expect(app).toContain('px-2.5 pb-3 pt-3');
    expect(navbar).toContain('h-14 items-center');
    expect(dock).toContain('Add to Home Screen');
    expect(dock).toContain('Install app');
    expect(dock).not.toContain('پنل مدیریت');
  });
});
