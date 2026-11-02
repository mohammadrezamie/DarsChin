import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { currentPrimaryCoverage } from '../src/domain/student-flow-stage';
import { StudentJourneyStepper } from '../src/components/StudentJourneyStepper';
import { RegistrationLaunchpad } from '../src/components/RegistrationLaunchpad';
import type { CourseEligibilityResult, StudentAcademicProfile } from '../src/types';

const row=(offeringId:string,courseId:string):CourseEligibilityResult=>({
  offeringId,courseId,courseCode:'123',rawCourseCode:'123',courseName:courseId,groupCode:'01',
  instructor:'استاد نمونه',units:3,category:'اصلی',dayOfWeek:'شنبه',startTime:'08:00',
  endTime:'10:00',capacity:30,enrolledCount:2,canSelect:true,isEligible:true,
  overallStatus:'AVAILABLE',primaryReason:'',allReasons:[],missingPrerequisites:[],missingCorequisites:[],
});
const a=row('a','math'),b=row('b','physics');
const profile={userId:'student',majorId:'ee',entryYearId:'1403',currentTermId:'term'} as StudentAcademicProfile;

describe('دقیق‌بودن راهنمای استاد اول و صف مشترک',()=>{
  it('گروه کهنه یا غیرمجاز، آمادگی برای ثبت نیست',()=>{
    expect(currentPrimaryCoverage(['math'],['b'],[a,b])).toEqual({total:1,ready:0,pending:1});
    expect(currentPrimaryCoverage(['math'],['a'],[{...a,isEligible:false}]).ready).toBe(0);
    expect(currentPrimaryCoverage(['math'],['a'],[{...a,canSelect:false}]).ready).toBe(0);
    expect(currentPrimaryCoverage(['math'],['a'],[{...a,overallStatus:'BLOCKED_PREREQUISITE'}]).ready).toBe(0);
    expect(currentPrimaryCoverage(['math','physics','math'],['a'],[a,b])).toEqual({total:2,ready:1,pending:1});
  });
  it('قدم مرور صف بدون استاد فعلی باز نیست',()=>{
    const base={step:5,busy:false,hasProfile:true,hasCurriculum:true,academicLimits:null,
      profile,wishlistCount:1,onOpenProfile:()=>{},onStep:()=>{}};
    const no=renderToStaticMarkup(<StudentJourneyStepper {...base} selectedGroupCount={0}/>);
    const yes=renderToStaticMarkup(<StudentJourneyStepper {...base} selectedGroupCount={1}/>);
    expect(no).toContain('گروه‌های قدیمی حساب نمی‌شوند');
    expect(no).toContain('disabled=""');
    expect(yes).toContain('۱ درس استاد اولِ مجاز دارد');
    expect(yes).not.toContain('گروه‌های قدیمی حساب نمی‌شوند');
  });
  it('هنگام ذخیره، کپی و علامت زدن و چینش غیرفعال می‌شوند',()=>{
    const html=renderToStaticMarkup(<RegistrationLaunchpad evaluations={[a]}
      selectedOfferingIds={['a']} coursePriorities={['math']} profile={profile}
      curriculumId="chart" planBusy={true} onEditPriorities={()=>{}}
      onReorderCourses={()=>{}}/>);
    expect(html).toMatch(/aria-label="کپی کد درس بعدی"[^>]*disabled=""/);
    expect(html).toMatch(/aria-label="کپی کد math"[^>]*disabled=""/);
    expect(html).toMatch(/aria-label="علامت ثبت math گروه 01"[^>]*disabled=""/);
    expect(html).toMatch(/aria-controls="registration-queue-list"[^>]*disabled=""/);
  });
});
