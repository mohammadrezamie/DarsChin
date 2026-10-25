import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RegistrationLaunchpad } from '../src/components/RegistrationLaunchpad';
import type { CourseEligibilityResult, StudentAcademicProfile } from '../src/types';

const offering: CourseEligibilityResult = {
  offeringId: 'test-off-1', courseId: 'test-course', courseCode: '410100',
  rawCourseCode: '410100', courseName: 'مدارهای الکتریکی',
  units: 3, category: 'اصلی', groupCode: '02', instructor: 'استاد نمونه',
  dayOfWeek: 'شنبه', startTime: '07:30', endTime: '09:00',
  capacity: 24, enrolledCount: 0, overallStatus: 'AVAILABLE',
  isEligible: true, canSelect: true, primaryReason: '',
  allReasons: [], missingPrerequisites: [], missingCorequisites: [],
};
const profile = {
  userId: 'student', majorId: 'ee', entryYearId: '1403', currentTermId: 'fall',
} as StudentAcademicProfile;

function renderQueue(row: CourseEligibilityResult = offering) {
  return renderToStaticMarkup(<RegistrationLaunchpad
    evaluations={[row]} selectedOfferingIds={['test-off-1']}
    coursePriorities={['test-course']} profile={profile}
    curriculumId="chart-example" onEditPriorities={() => {}}
    onReorderCourses={() => {}}
  />);
}

describe('compact manual Educationalyar registration queue', () => {
  it('shows the real course/group and direct keyboard-accessible copy/reorder actions', () => {
    const html = renderQueue();
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('صف سریع ثبت دروس');
    expect(html).toContain('کپی بعدی');
    expect(html).toContain('کپی کد مدارهای الکتریکی');
    expect(html).toContain('علامت ثبت مدارهای الکتریکی');
    expect(html).toContain('انتقال مدارهای الکتریکی به بالا');
    expect(html).toContain('انتقال مدارهای الکتریکی به پایین');
    expect(html).toContain('ثبت خودکار در آموزشیار نیست');
    expect(html).toContain('02');
    expect(html).toMatch(/<li[^>]*><div class="flex min-w-0 items-center/);
    expect(html).not.toContain('flex-nowrap');
  });

  it('places optional details below the compact action row, not alongside it', () => {
    const html = renderQueue({ ...offering, rawCourseCode: undefined });
    expect(html).toContain('<details class="w-full border-t');
    expect(html).toContain('410100');
    expect(html).toContain('کد از کاتالوگ/تطبیق درس آمده');
    expect(html).toMatch(/<\/div><details class="w-full border-t/);
  });
});
