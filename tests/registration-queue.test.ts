import { describe, expect, it } from 'vitest';
import { buildRegistrationQueue } from '../src/domain/registration-queue';
import type { AcademicRule, CourseEligibilityResult, StudentPassedCourse } from '../src/types';

const row = (courseId:string, courseName:string, code:string):CourseEligibilityResult => ({
  offeringId:'off-'+courseId,courseId,courseCode:code,courseName,
  units:3,category:'اصلی',groupCode:'01',instructor:'استاد نمونه',
  dayOfWeek:'شنبه',startTime:'08:00',endTime:'10:00',capacity:30,enrolledCount:10,
  overallStatus:'AVAILABLE',isEligible:true,canSelect:true,
  primaryReason:'نمونه آزمایشی',allReasons:[],missingPrerequisites:[],missingCorequisites:[],
});
const math=row('math2','ریاضی عمومی ۲','DEMO-101');
const diff=row('diff','معادلات دیفرانسیل','DEMO-109');
const physics=row('physics','فیزیک','DEMO-103');
const profile={majorId:'ee',entryYearId:'1403',selectedTrackId:'power'};
const rule=(relationshipType:AcademicRule['relationshipType'],targetCourseId:string,expression:AcademicRule['expression']):AcademicRule=>({
  id:relationshipType+targetCourseId,curriculumId:'c1',relationshipType,targetCourseId,expression,
});
const passed=(courseId:string,status:'PASSED'|'FAILED'='PASSED',grade=15):StudentPassedCourse=>({
  id:'pass-'+courseId,userId:'s1',courseId,status,grade,passedAt:'2026-01-01',
});
const input=(rules:AcademicRule[], passedCourses:StudentPassedCourse[]=[])=>({
  evaluations:[diff,math,physics],
  selectedOfferingIds:['off-diff','off-math2','off-physics'],
  preferredCourseIds:['diff','physics','math2'],
  profile,rules,passedCourses,
});
const coreq=rule('COREQUISITE','diff',{type:'COURSE',courseId:'math2'});

describe('manual Educationalyar registration priority queue',()=>{
  it('places a planned unpassed corequisite before its dependent course without changing other priorities',()=>{
    const queue=buildRegistrationQueue(input([coreq]));
    expect(queue.steps.map(s=>s.courseId)).toEqual(['physics','math2','diff']);
    expect(queue.steps.find(s=>s.courseId==='diff')?.dependencyNames).toEqual(['ریاضی عمومی ۲']);
    expect(queue.steps.find(s=>s.courseId==='diff')?.advancedForCorequisite).toBe(true);
  });
  it('does not force registering the corequisite first when it was already passed',()=>{
    const queue=buildRegistrationQueue(input([coreq],[passed('math2')]));
    expect(queue.steps.map(s=>s.courseId)).toEqual(['diff','physics','math2']);
    expect(queue.steps[0].dependencyNames).toEqual([]);
  });
  it('does not treat failed or low-grade attempts as passed',()=>{
    for(const attempt of [passed('math2','FAILED',14),passed('math2','PASSED',9)]){
      expect(buildRegistrationQueue(input([coreq],[attempt])).steps.at(-1)?.courseId).toBe('diff');
    }
  });
  it('warns when a corequisite is absent rather than silently claiming readiness',()=>{
    const data={...input([coreq]),selectedOfferingIds:['off-diff']};
    const queue=buildRegistrationQueue(data);
    expect(queue.hasUnresolvedRules).toBe(true);
    expect(queue.steps[0].ready).toBe(false);
    expect(queue.steps[0].warnings.join(' ')).toContain('ریاضی عمومی ۲');
  });
  it('keeps prerequisites distinct from same-semester corequisites',()=>{
    const prerequisite=rule('PREREQUISITE','diff',{type:'COURSE',courseId:'math2'});
    const queue=buildRegistrationQueue(input([prerequisite]));
    expect(queue.steps[0].courseId).toBe('diff');
    expect(queue.steps[0].ready).toBe(false);
    expect(queue.steps[0].warnings.join(' ')).toContain('پیش‌نیاز');
  });
  it('does not apply another track or entry-year rule to this cohort',()=>{
    const other={...coreq,id:'scoped-other-track',trackId:'control',entryYearId:'1402'};
    const queue=buildRegistrationQueue(input([other]));
    expect(queue.steps.map(s=>s.courseId)).toEqual(['diff','physics','math2']);
  });
  it('handles OR without automatically forcing all alternatives',()=>{
    const either=rule('COREQUISITE','diff',{type:'GROUP',operator:'OR',operands:[
      {type:'COURSE',courseId:'math2'},{type:'COURSE',courseId:'physics'},
    ]});
    const queue=buildRegistrationQueue(input([either]));
    expect(queue.steps.find(s=>s.courseId==='diff')?.dependencyNames).toHaveLength(1);
    expect(queue.steps.find(s=>s.courseId==='diff')?.warnings.join(' ')).toContain('یا');
  });
  it('flags cyclic configuration instead of claiming a safe queue',()=>{
    const reverse=rule('COREQUISITE','math2',{type:'COURSE',courseId:'diff'});
    const queue=buildRegistrationQueue(input([coreq,reverse]));
    expect(queue.hasCycle).toBe(true);
    expect(queue.steps).toHaveLength(3);
    expect(queue.steps.find(s=>s.courseId==='diff')?.warnings.join(' ')).toContain('چرخه');
  });
  it('prioritizes actual imported course codes but warns if only catalog code exists',()=>{
    const imported={...diff,rawCourseCode:'410019'};
    const q=buildRegistrationQueue({...input([]),evaluations:[imported,math,physics]});
    expect(q.steps[0].copyCode).toBe('410019');
    expect(q.steps[0].codeFromOffering).toBe(true);
    expect(q.steps[1].codeFromOffering).toBe(false);
    expect(q.steps[1].warnings.join(' ')).toContain('تأیید نشده');
  });
});
