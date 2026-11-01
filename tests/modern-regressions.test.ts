import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('modernization regression guards for existing academic/admin workflows', () => {
  it('preserves extra-unit metadata from the authoritative course record across eligibility projections', () => {
    const engine = src('src/domain/eligibility-engine.ts');
    const type = src('src/types/index.ts');
    const resultPart = type.slice(type.indexOf('export interface CourseEligibilityResult {'));
    expect(resultPart).toContain('isExtraUnit?: boolean');
    // Previously the planner referenced this value but all three known-course
    // evaluation branches omitted it, silently treating extra units as regular.
    expect(engine.match(/isExtraUnit: course\.isExtraUnit === true/g)).toHaveLength(3);
    expect(engine).not.toContain("isExtraUnit: course.name.includes(");
  });

  it('renders stored admin logs using defined database fields, not invented severity or timestamp', () => {
    const admin = src('src/components/AdminLogs.tsx');
    expect(admin).toContain('new Date(log.createdAt)');
    expect(admin).toContain('{log.adminId}');
    expect(admin).not.toContain('log.timestamp');
    expect(admin).not.toContain('log.userId');
    expect(admin).not.toContain('log.severity');
  });

  it('shows the server-supported CLOSED bug state instead of unsupported REJECTED', () => {
    const bugs = src('src/components/BugReportPanel.tsx');
    const schema = src('server/schemas/support.ts');
    expect(bugs).toContain("r.status === 'CLOSED'");
    expect(bugs).toContain('بسته شده');
    expect(bugs).not.toContain("r.status === 'REJECTED'");
    expect(schema).toContain("'CLOSED'");
  });

  it('keeps editable search shortcuts out of user text fields in the admin panel', () => {
    const admin = src('src/components/AdminDashboard.tsx');
    expect(admin).toContain("key === 'k' && (event.metaKey || event.ctrlKey)");
    expect(admin).toContain("event.key === '/' && !editable");
    expect(admin).toContain("desktopNavRef.current?.querySelector<HTMLInputElement>('input[type=\"search\"]')");
    expect(admin).toContain('setMobileMenuOpen(true)');
    expect(admin).toContain("document.removeEventListener('keydown', onNavigationShortcut)");
  });
});
