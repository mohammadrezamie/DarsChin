import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('role-isolated and on-demand workspace payloads', () => {
  it('does not eagerly load the admin panel into the student demo (or vice versa)', () => {
    const demo = source('src/pages/DemoWorkspace.tsx');
    expect(demo).toContain("lazy(() => import('../components/StudentDashboard')");
    expect(demo).toContain("lazy(() => import('../components/AdminDashboard')");
    expect(demo).not.toContain("import { StudentDashboard } from '../components/StudentDashboard'");
    expect(demo).not.toContain("import { AdminDashboard } from '../components/AdminDashboard'");
    expect(demo).toContain("role === 'student' ? <StudentDashboard /> : <AdminDashboard />");
    expect(demo).toContain('<Suspense fallback=');
  });

  it('loads student-only tools when their workspace or dialog is actually requested', () => {
    const dashboard = source('src/components/StudentDashboard.tsx');
    for (const name of [
      'StudentWishlistBuilder', 'OfferingsList', 'SchedulePlanner',
      'RegistrationLaunchpad', 'PassedCoursesManager', 'DemandWorkspace',
      'StudentHelpCenter', 'AcademicProfileModal', 'ImportOfferingsModal',
    ]) {
      expect(dashboard).toContain(`const ${name} = lazy(() => import('./${name}')`);
      expect(dashboard).not.toContain(`import { ${name} } from './${name}';`);
    }
    expect(dashboard).toContain("role=\"status\" aria-live=\"polite\"");
    expect(dashboard).toContain("{activeTab === 'registration' && (");
    expect(dashboard).toContain("{activeTab === 'schedule' && (");
    expect(dashboard).toContain("{isProfileModalOpen && (");
    expect(dashboard).toContain("{isImportModalOpen && (");
    expect(dashboard).not.toContain('isOpen={isImportModalOpen}');
  });

  it('does not download sensitive management tools until selected and authorized', () => {
    const admin = source('src/components/AdminDashboard.tsx');
    for (const name of [
      'AdminCrudTable', 'AdminCurriculumBuilder', 'UserManagement', 'AdminAcademicRules',
      'AdminAcademicSettings', 'AdminImportCenter', 'AdminSyncStatus',
      'AdminSupportPanel', 'AdminDiagnostics', 'AdminLogs', 'AdminSmsCenter',
    ]) {
      expect(admin).toContain(`const ${name} = lazy(() => import('./${name}')`);
      expect(admin).not.toContain(`import { ${name} } from './${name}';`);
    }
    expect(admin).toContain("activeTab === 'users' && isSuperAdmin");
    expect(admin).toContain("activeTab === 'logs' && isSuperAdmin");
    expect(admin).toContain('<Suspense fallback=');
    expect(source('src/App.tsx')).toContain("lazy(() => import('./components/AdminDashboard')");
  });
});
