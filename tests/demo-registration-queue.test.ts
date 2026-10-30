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


describe('browser demo registration parity with the server plan',()=>{
  it('swaps the selected main group and retains the old one as a fallback',async()=>{
    const saved=await browserDemoRequest<any>('/api/student/plan/select',{
      method:'POST',body:JSON.stringify({offeringId:'off-math2-alt',action:'add'}),
    });
    expect(saved.success).toBe(true);
    expect(saved.data.selectedOfferingIds).toContain('off-math2-alt');
    expect(saved.data.selectedOfferingIds).not.toContain('off-math2');
    expect(saved.data.offeringPriorities.math2).toEqual(['off-math2-alt','off-math2']);
    const reloaded=(await browserDemoRequest<any>('/api/student/plan')).data;
    expect(reloaded.offeringPriorities.math2).toEqual(['off-math2-alt','off-math2']);
  });
  it('refuses two primary groups of one course without altering the saved plan',async()=>{
    const before=(await browserDemoRequest<any>('/api/student/plan')).data.selectedOfferingIds;
    const rejected=await browserDemoRequest<any>('/api/student/plan',{
      method:'PUT',body:JSON.stringify({selectedOfferingIds:[...before,'off-math2-alt']}),
    });
    expect(rejected.success).toBe(false);
    expect((await browserDemoRequest<any>('/api/student/plan')).data.selectedOfferingIds).toEqual(before);
  });
  it('refuses wrong-course reserve IDs and duplicate reserves without silent rewriting',async()=>{
    const before=(await browserDemoRequest<any>('/api/student/plan')).data.offeringPriorities;
    for(const priorities of [{math2:['off-physics']},{math2:['off-math2-alt','off-math2-alt']}]){
      const rejected=await browserDemoRequest<any>('/api/student/plan',{
        method:'PUT',body:JSON.stringify({offeringPriorities:priorities}),
      });
      expect(rejected.success).toBe(false);
      expect((await browserDemoRequest<any>('/api/student/plan')).data.offeringPriorities).toEqual(before);
    }
  });
});
