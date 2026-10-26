import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildRegistrationQueue } from '../src/domain/registration-queue';
import type { AcademicRule } from '../src/types';
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
    expect(html).toContain('aria-label="کپی کد درس بعدی"');
    expect(html).toContain('کد ارائه');
    expect(html.split('جزئیات کد و وابستگی‌ها')[0]).toContain('410100');
    expect(html).toContain('min-h-11');
    expect(html).toContain('کد ارائه');
    expect(html).toContain('علامت ثبت مدارهای الکتریکی');
    expect(html).toContain('انتقال مدارهای الکتریکی به بالا');
    expect(html).toContain('انتقال مدارهای الکتریکی به پایین');
    expect(html).toContain('ثبت خودکار در آموزشیار نیست');
    expect(html).toContain('02');
    expect(html).toContain('کپی شماره گروه مدارهای الکتریکی');
    expect(html).toContain('کپی شماره گروه');
    expect(html).toMatch(/<li[^>]*><div class="flex min-w-0 flex-wrap items-center/);
    expect(html).toContain('min-[430px]:flex-nowrap');
    expect(html).toContain('gap-y-1.5');
    expect(html).toContain('h-11 w-11');
    expect(html).toContain('کپی سریع پس از بررسی فعال می‌شود');
    // The first render has no hydrated rules/history yet: no risky early copy.
    expect(html).toMatch(/aria-label="کپی کد درس بعدی"[^>]*disabled=""/);
    expect(html).toMatch(/disabled=""[^>]*aria-label="کپی کد مدارهای الکتریکی"/);
  });

  it('waits for real save feedback and locks reorder actions while writing',()=>{
    const component=readFileSync(resolve(process.cwd(),'src/components/RegistrationLaunchpad.tsx'),'utf8');
    const dashboard=readFileSync(resolve(process.cwd(),'src/components/StudentDashboard.tsx'),'utf8');
    expect(component).toContain('const saved=await onReorderCourses(order)');
    expect(component).toContain('if(saved===false)throw');
    expect(component).toContain('if(reorderLock.current||');
    expect(component).toContain('disabled={reordering||index===0}');
    expect(component).toContain('ترتیب ذخیره نشد');
    expect(dashboard).toContain('Promise<boolean>');
    expect(dashboard).toContain('return saved;');
  });

  it('shows the code but disables quick-copy for a blocked course, even with a real imported code',()=>{
    const blocked:CourseEligibilityResult={
      ...offering,overallStatus:'BLOCKED_PREREQUISITE',
      canSelect:false,isEligible:false,primaryReason:'پیش‌نیاز پاس نشده است',
    };
    const queue=buildRegistrationQueue({
      evaluations:[blocked],selectedOfferingIds:['test-off-1'],
      preferredCourseIds:['test-course'],rules:[],passedCourses:[],
      profile:{majorId:'ee',entryYearId:'1403',selectedTrackId:null},
    });
    expect(queue.hasUnresolvedRules).toBe(true);
    expect(queue.steps[0].ready).toBe(false);
    expect(queue.steps[0].warnings.join(' ')).toContain('پیش‌نیاز پاس نشده است');
    const html=renderQueue(blocked);
    expect(html).toContain('410100');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="کپی کد مدارهای الکتریکی"/);
  });

  it('does not promote a course with unresolved academic prerequisites to quick-copy', () => {
    const prerequisite: AcademicRule = {
      id: 'rule-1', curriculumId: 'chart-example', targetCourseId: 'test-course',
      relationshipType: 'PREREQUISITE', expression: { type: 'COURSE', courseId: 'missing-pre' },
    };
    const queue = buildRegistrationQueue({
      evaluations: [offering], selectedOfferingIds: ['test-off-1'],
      preferredCourseIds: ['test-course'], rules: [prerequisite],
      passedCourses: [], profile: { majorId: 'ee', entryYearId: '1403', selectedTrackId: null },
    });
    expect(queue.steps[0].copyCode).toBe('410100');
    expect(queue.steps[0].ready).toBe(false);
    const source = readFileSync(resolve(process.cwd(), 'src/components/RegistrationLaunchpad.tsx'), 'utf8');
    expect(source).toContain('s.ready&&!doneIds.includes(s.courseId)');
    expect(source).toContain('disabled={!rulesReady||!step.ready||!step.copyCode||locked}');
  });

  it('keeps quick-copy fail-closed until chart and passed-course rules resolve', () => {
    const component=readFileSync(resolve(process.cwd(),'src/components/RegistrationLaunchpad.tsx'),'utf8');
    expect(component).toContain('const rulesReady=Boolean(curriculumId)&&Boolean(profile?.userId)&&');
    expect(component).toContain('verifiedContextKey===academicContextKey&&!loading&&!error');
    expect(component).toContain('const next=rulesReady&&progressReady?queue.steps.find');
    expect(component).toContain('disabled={!rulesReady||!next?.copyCode}');
    expect(component).toContain('disabled={!rulesReady||!step.ready||!step.copyCode||locked}');
    expect(component).toContain('disabled={!rulesReady||!step.ready||locked}');
    expect(component).toContain('aria-label={`کپی شماره گروه ${step.courseName}`}');
    expect(component).toContain('کپی سریع تا دریافت اطلاعات غیرفعال است');
    expect(component).toContain('کپی سریع پس از بررسی فعال می‌شود');
    // Switching students or term/chart invalidates previous eligibility BEFORE effects run.
    expect(component).toContain('const academicContextKey=');
    expect(component).toContain('setVerifiedContextKey(academicContextKey)');
    expect(component).toContain('setVerifiedContextKey(null)');
    expect(component).toContain('},[academicContextKey]);');
    expect(component).toContain('const progressReady=progressLoadedKey===progressKey;');
    expect(component).toContain('const activeDoneIds=progressReady?doneIds:[];');
    expect(component).toContain('const done=activeDoneIds.includes(step.courseId);');
    expect(component).toContain('const locked=step.dependencyCourseIds.some(id=>!activeDoneIds.includes(id));');
    expect(component).toContain('disabled={!progressReady||(!done&&locked)}');
    expect(component).toContain('!Array.isArray(history.data.passedCourses)');
    expect(component).toContain('!Array.isArray(chart.data.prerequisites)');
    // The fallback copy textarea must not remain in the document on error.
    expect(component).toContain('finally { input.remove(); }');
  });

  it('keeps long course and instructor names visible on compact RTL rows', () => {
    const html=renderQueue({...offering,
      courseName:'مبانی بسیار طولانی مدارات الکتریکی و سیستم‌های دیجیتال',
      instructor:'استاد آزمایشی با نام خانوادگی طولانی برای بررسی واکنش‌گرایی',
    });
    expect(html).toContain('مبانی بسیار طولانی مدارات الکتریکی و سیستم‌های دیجیتال');
    expect(html).toContain('استاد آزمایشی با نام خانوادگی طولانی');
    expect(html).toContain('[overflow-wrap:anywhere]');
    expect(html).not.toContain('min-[430px]:truncate');
    expect(html).not.toContain('block truncate text-[11px]');
    expect(html).toContain('min-h-11');
  });

  it('places optional details below the compact action row, not alongside it', () => {
    const html = renderQueue({ ...offering, rawCourseCode: undefined });
    expect(html).toContain('<details class="w-full border-t');
    expect(html).toContain('410100');
    expect(html).toContain('کد از کاتالوگ/تطبیق درس آمده');
    expect(html).toMatch(/<\/div><details class="w-full border-t/);
  });
});
