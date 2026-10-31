import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StudentJourneyStepper, STUDENT_JOURNEY_STEPS } from '../src/components/StudentJourneyStepper';
import { StudentWishlistBuilder } from '../src/components/StudentWishlistBuilder';
import { studentWorkspaceFromSearch } from '../src/utils/student-workspace-navigation';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const wizard = (step: number, overrides: Record<string, unknown> = {}) => renderToStaticMarkup(
  <StudentJourneyStepper step={step} busy={false} hasProfile={false} hasCurriculum={false}
    academicLimits={null} profile={null} wishlistCount={0}
    onOpenProfile={() => {}} onStep={() => {}} {...overrides} />,
);

describe('guided seven-step student workflow', () => {
  it('begins with a clear step, refuses to confirm a missing curriculum and does not show admin features', () => {
    const html = wizard(0);
    expect(STUDENT_JOURNEY_STEPS).toHaveLength(7);
    expect(html).toContain('پروندهٔ تحصیلی');
    expect(html).toContain('از ۷');
    expect(html).toContain('disabled');
    expect(html).not.toContain('پنل مدیریت');
    // Seven short progress bars must remain usable touch targets in app-style mobile mode.
    expect(html).toContain('min-h-11 min-w-0 items-center justify-center');
  });

  it('shows the server-calculated effective unit limit without hardcoded regulatory promises', () => {
    const html = wizard(2, { hasProfile: true, hasCurriculum: true, academicLimits: {
      effectiveMaxUnits: 19, isSummer: false,
    } });
    expect(html).toContain('۱۹ واحد');
    expect(html).toContain('سقف مؤثر');
    expect(html).toContain('تنظیمات و تحلیل سمت سرور');
    expect(html).not.toContain('۲۴ واحد می‌توانی');
  });

  it('allows an interest basket separate from registration, reachable by a student-only URL', () => {
    const html = renderToStaticMarkup(<StudentWishlistBuilder curriculumId={null}
      wishlistCourseIds={[]} evaluations={[]} recommendations={[]} onSave={async () => true}/>);
    expect(studentWorkspaceFromSearch('?tab=wishlist')).toBe('offerings');
    expect(html).toContain('اول درس‌هایی را که می‌خواهی انتخاب کن');
    expect(html).toContain('انتخاب واحد نهایی نیستند');
    expect(html).toContain('۴۰ واحد');
    expect(source('src/components/StudentWishlistBuilder.tsx')).not.toContain('onToggleScheduleOffering');
    expect(source('src/components/StudentDashboard.tsx')).toContain('<StudentWishlistBuilder');
  });

  it('does not overwhelm a first-time account with the whole offerings list', () => {
    const dash = source('src/components/StudentDashboard.tsx');
    expect(dash).toContain("journeyStep === 0 || journeyStep === 2");
    expect(dash).toContain('جدول گروه‌ها و انتخاب نهایی در مراحل بعد');
    expect(dash).toContain("apiRequest('/api/student/journey'");
    expect(dash).toContain("apiRequest('/api/student/wishlist'");
    expect(source('src/demo/mock-api.ts')).toContain("path === '/api/student/wishlist/catalog'");
    expect(source('src/demo/mock-api.ts')).toContain("path === '/api/student/journey'");
  });

  it('maintains a distinct history for previous failures and successes', () => {
    const records = source('src/components/PassedCoursesManager.tsx');
    expect(records).toContain('EXCUSED_EXAM_ABSENCE');
    expect(records).toContain('CLASS_ABSENCE_DROP');
    expect(records).toContain('نیمسال نامشخص (سوابق قدیمی)');
    expect(records).toContain("method:editingId?'PUT':'POST'");
  });
});
