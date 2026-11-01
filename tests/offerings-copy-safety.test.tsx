import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OfferingsList } from '../src/components/OfferingsList';
import type { CourseEligibilityResult } from '../src/types';

const base:CourseEligibilityResult={
  offeringId:'off-1',courseId:'course-1',courseCode:'CAT-101',
  courseName:'درس آزمایشی ثبت',units:3,category:'اصلی',groupCode:'02',
  instructor:'استاد تست',dayOfWeek:'شنبه',startTime:'09:00',endTime:'10:30',
  capacity:30,enrolledCount:2,overallStatus:'AVAILABLE',
  isEligible:true,canSelect:true,primaryReason:'',allReasons:[],
  missingPrerequisites:[],missingCorequisites:[],
};
const display=(offering:CourseEligibilityResult)=>renderToStaticMarkup(
  <OfferingsList evaluations={[offering]} selectedOfferingIds={[offering.offeringId]}
    onToggleScheduleOffering={()=>{}} onOpenProfileModal={()=>{}} />,
);

describe('offering-list registered-code copy safety',()=>{
  it('does not imply portal readiness or permit copying an undefined imported code',()=>{
    const html=display(base);
    expect(html).not.toContain('کپی برای آموزشیار');
    expect(html).toContain('کپی فهرست کدها (0)');
    expect(html).toMatch(/disabled[^>]*>/);
    expect(html).not.toContain('undefined_02');
  });
  it('counts only concrete imported codes, not synthetic demo codes',()=>{
    const real=display({...base,rawCourseCode:'410123'});
    expect(real).toContain('کپی فهرست کدها (1)');
    expect(real).not.toContain('undefined_02');
    const demo=display({...base,rawCourseCode:'DEMO-410123'});
    expect(demo).toContain('کپی فهرست کدها (0)');
  });
});
