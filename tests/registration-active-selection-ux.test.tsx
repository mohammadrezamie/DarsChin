import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { activeRegistrationOfferingIds, canPrioritizeOffering } from '../src/domain/student-flow-stage';
import { RegistrationLaunchpad } from '../src/components/RegistrationLaunchpad';
import type { CourseEligibilityResult, StudentAcademicProfile } from '../src/types';

const mk = (id: string, courseId: string): CourseEligibilityResult => ({
  offeringId: id,courseId,courseCode: '123456',rawCourseCode:'123456',courseName:courseId,
  units:3,category:'اصلی',groupCode:id,instructor:'استاد '+id,dayOfWeek:'شنبه',
  startTime:'08:00',endTime:'10:00',capacity:30,enrolledCount:0,
  overallStatus:'AVAILABLE',isEligible:true,canSelect:true,primaryReason:'',
  allReasons:[],missingPrerequisites:[],missingCorequisites:[],
});
const a=mk('g-a','math'),b=mk('g-b','math'),old=mk('g-old','physics');
const profile = {userId:'student',majorId:'ee',entryYearId:'1403',currentTermId:'term'} as StudentAcademicProfile;

describe('صف فعال و جایگزین‌ها بدون نمایش اطلاعات کهنه',()=>{
  it('با حذف درس از سبد، برنامه قبلی را پاک نمی‌کند اما آن را از صف فعال کنار می‌گذارد',()=>{
    const prior=['g-a','g-old'];
    expect(activeRegistrationOfferingIds(prior,[a,old],['math'])).toEqual(['g-a']);
    expect(prior).toEqual(['g-a','g-old']);
    expect(activeRegistrationOfferingIds(prior,[a,old])).toEqual(prior);
    expect(activeRegistrationOfferingIds(prior,[a,old],[])).toEqual([]);
  });
  it('نامعتبر بودن هر یک از سه شرط، ارتقای استاد را غیرمجاز می‌کند',()=>{
    expect(canPrioritizeOffering(b)).toBe(true);
    expect(canPrioritizeOffering({...b,isEligible:false})).toBe(false);
    expect(canPrioritizeOffering({...b,canSelect:false})).toBe(false);
    expect(canPrioritizeOffering({...b,overallStatus:'BLOCKED_PREREQUISITE'})).toBe(false);
  });
  it('صف درس انتخاب‌شده بدون استاد، راهنمای درست نشان می‌دهد',()=>{
    const html=renderToStaticMarkup(<RegistrationLaunchpad
      evaluations={[a,old]} selectedOfferingIds={['g-old']}
      chosenCourseIds={['math']} coursePriorities={['math']}
      profile={profile} curriculumId="chart"
      onEditPriorities={()=>{}} onReorderCourses={()=>{}}/>);
    expect(html).toContain('درس‌ها را انتخاب کرده‌ای');
    expect(html).not.toContain('کپی کد physics');
  });
  it('جایگزین داخل صف مشترک قابل ارتقاست ولی نامجازها قفل‌اند',()=>{
    const html=renderToStaticMarkup(<RegistrationLaunchpad
      evaluations={[a,b]} selectedOfferingIds={['g-a']} coursePriorities={['math']}
      offeringPriorities={{math:['g-a','g-b']}} chosenCourseIds={['math']}
      profile={profile} curriculumId="chart" onSelectPrimaryOffering={()=>{}}
      onEditPriorities={()=>{}} onReorderCourses={()=>{}}/>);
    expect(html).toContain('گروه‌های جایگزین به ترتیب');
    expect(html).toContain('تبدیل به استاد اول');
    expect(html).toContain('انتخاب استاد g-b به‌عنوان استاد اول درس math');
    const locked=renderToStaticMarkup(<RegistrationLaunchpad
      evaluations={[a,{...b,isEligible:false,primaryReason:'ممنوع'}]}
      selectedOfferingIds={['g-a']} coursePriorities={['math']}
      offeringPriorities={{math:['g-a','g-b']}} chosenCourseIds={['math']}
      profile={profile} curriculumId="chart" onSelectPrimaryOffering={()=>{}}
      onEditPriorities={()=>{}} onReorderCourses={()=>{}}/>);
    expect(locked).toContain('ممنوع');
    expect(locked).toMatch(/disabled=""[^>]*aria-label="انتخاب استاد g-b به‌عنوان استاد اول درس math"/);
  });
});
