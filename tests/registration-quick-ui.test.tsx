import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RegistrationLaunchpad } from '../src/components/RegistrationLaunchpad';
import type { CourseEligibilityResult, StudentAcademicProfile } from '../src/types';

describe('fast manual Educationalyar registration UI in Persian RTL',()=>{
  it('renders quick course/group copy with explicit portal disclaimer and mobile touch affordances',()=>{
    const offering:CourseEligibilityResult={
      offeringId:'test-off-1',courseId:'test-course',courseCode:'410100',
      rawCourseCode:'410100',courseName:'مدارهای الکتریکی',
      units:3,category:'اصلی',groupCode:'02',instructor:'استاد نمونه',dayOfWeek:'شنبه',
      startTime:'07:30',endTime:'09:00',capacity:24,enrolledCount:0,
      overallStatus:'AVAILABLE',isEligible:true,canSelect:true,
      primaryReason:'',allReasons:[],missingPrerequisites:[],missingCorequisites:[],
    };
    const html=renderToStaticMarkup(<RegistrationLaunchpad
      evaluations={[offering]} selectedOfferingIds={['test-off-1']}
      coursePriorities={['test-course']}
      profile={{userId:'student',majorId:'ee',entryYearId:'1403',currentTermId:'fall'} as StudentAcademicProfile}
      curriculumId="chart-example" onEditPriorities={()=>{}}
    />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('کپی کد درس');
    expect(html).toContain('کپی شماره گروه');
    expect(html).toContain('کپی کد درس بعدی');
    expect(html).toContain('ثبت شد (دستی)');
    expect(html).toContain('به آموزشیار وصل نیست');
    expect(html).toContain('410100');
    expect(html).toContain('02');
    expect(html).toContain('text-right');
    expect(html).toContain('min-h-11');
  });
});