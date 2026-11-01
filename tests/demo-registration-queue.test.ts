import { beforeEach, describe, expect, it } from 'vitest';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';
import { buildRegistrationQueue } from '../src/domain/registration-queue';
import type { AcademicRule, CourseEligibilityResult, StudentPassedCourse } from '../src/types';

beforeEach(()=>resetBrowserDemo());

describe('isolated real-panel Educationalyar launchpad demo',()=>{
  it('offers a clearly fake differential course and obtains scoped demo curriculum rules',async()=>{
    const profile=(await browserDemoRequest<any>('/api/student/profile')).data!;
    expect(profile.curriculum?.id).toBe('demo-curriculum');
    const chart=(await browserDemoRequest<any>(`/api/curriculum/${profile.curriculum.id}/full`)).data!;
    expect(chart.corequisites).toContainEqual(expect.objectContaining({
      targetCourseId:'diff',relationshipType:'COREQUISITE',
      expression:{type:'COURSE',courseId:'math2'},
    }));
    const evaluated=(await browserDemoRequest<any>('/api/eligibility/evaluate',{method:'POST',
      body:JSON.stringify({plannedCourseIds:[]})})).data!;
    expect(evaluated.report.results.some((e:CourseEligibilityResult)=>
      e.courseId==='diff' && e.rawCourseCode==='DEMO-109')).toBe(true);
  });
  it('reorders dependent course ahead of requested ranking and changes once math II is passed',async()=>{
    const profile=(await browserDemoRequest<any>('/api/student/profile')).data!;
    const chart=(await browserDemoRequest<any>(`/api/curriculum/${profile.curriculum.id}/full`)).data!;
    const evaluated=(await browserDemoRequest<any>('/api/eligibility/evaluate',{
      method:'POST',body:JSON.stringify({plannedCourseIds:['off-diff','off-math2']}),
    })).data!;
    const evaluations=evaluated.report.results as CourseEligibilityResult[];
    const create=(passedCourses:StudentPassedCourse[])=>buildRegistrationQueue({
      evaluations, selectedOfferingIds:['off-diff','off-math2'],
      preferredCourseIds:['diff','math2'],
      rules:[...(chart.corequisites as AcademicRule[]),...(chart.prerequisites as AcademicRule[])],
      passedCourses, profile:profile.profile,
    });
    expect(create([]).steps.map(s=>s.courseId)).toEqual(['math2','diff']);
    const pass=await browserDemoRequest<any>('/api/student/passed-courses',{
      method:'POST',body:JSON.stringify({courseId:'math2',grade:17}),
    });
    expect(pass.success).toBe(true);
    const history=(await browserDemoRequest<any>('/api/student/passed-courses')).data!;
    expect(create(history.passedCourses).steps.map(s=>s.courseId)).toEqual(['diff','math2']);
  });
});
