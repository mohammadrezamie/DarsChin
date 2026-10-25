import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RegistrationLaunchpad } from '../src/components/RegistrationLaunchpad';
import type { CourseEligibilityResult, StudentAcademicProfile } from '../src/types';

describe('compact manual registration priority rows in Persian RTL',()=>{
  it('shows the full course, instructor, day, time and group without expanding details',()=>{
    const offering:CourseEligibilityResult={
      offeringId:'test-off-1',courseId:'test-course',courseCode:'410100',
      rawCourseCode:'410100',courseName:'مدارهای الکتریکی و سیستم‌های الکترونیکی پیشرفته',
      units:3,category:'اصلی',groupCode:'02',
      instructor:'دکتر نام خانوادگی طولانی استاد آزمایشی',
      dayOfWeek:'شنبه',startTime:'07:30',endTime:'09:00',
      capacity:24,enrolledCount:0,overallStatus:'AVAILABLE',isEligible:true,canSelect:true,
      primaryReason:'',allReasons:[],missingPrerequisites:[],missingCorequisites:[],
    };
    const html=renderToStaticMarkup(<RegistrationLaunchpad
      evaluations={[offering]} selectedOfferingIds={['test-off-1']}
      coursePriorities={['test-course']}
      profile={{userId:'student',majorId:'ee',entryYearId:'1403',currentTermId:'fall'} as StudentAcademicProfile}
      curriculumId="chart-example" onEditPriorities={()=>{}}
      onReorderCourses={()=>true} />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('صف سریع ثبت دروس');
    expect(html).toContain('مدارهای الکتریکی و سیستم‌های الکترونیکی پیشرفته');
    expect(html).toContain('دکتر نام خانوادگی طولانی استاد آزمایشی');
    expect(html).toContain('زمان: شنبه');
    expect(html).toContain('07:30');
    expect(html).toContain('09:00');
    expect(html).toContain('گروه 02');
    expect(html).toContain('aria-label="اولویت 1"');
    expect(html).toContain('کپی کد');
    expect(html).toContain('410100');
    expect(html).toContain('break-words');
    expect(html).not.toContain('block truncate');
    expect(html).toContain('این فهرست ثبت خودکار در آموزشیار نیست');
  });
});
