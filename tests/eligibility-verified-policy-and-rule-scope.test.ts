import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateStudentEligibility } from '../src/domain/eligibility-engine';
import type {
  AcademicRule, Course, CourseOffering, Curriculum,
  CurriculumCourse, StudentAcademicProfile,
} from '../src/types';
const profile:StudentAcademicProfile={
  userId:'synthetic-final-student',universityId:'u',campusId:'c',degreeLevelId:'d',
  majorId:'m',entryYearId:'year-1403',isTrackSelected:false,
  desiredTrackIds:[],updatedAt:'',
};
const curriculum={id:'synthetic-final-curriculum',status:'active',name:'Synthetic curriculum'} as Curriculum;
const courses:Course[]=[
  {id:'basic',code:'SYN-BASIC',name:'Basic',units:2,category:'پایه',active:true},
  {id:'advanced',code:'SYN-ADV',name:'Advanced',units:2,category:'تخصصی',active:true},
];
const links:CurriculumCourse[]=courses.map(course=>({
  id:'cc-'+course.id,curriculumId:curriculum.id,courseId:course.id,
  classification:'MAJOR_REQUIRED',active:true,
}));
const advanced:CourseOffering={
  id:'off-advanced',courseId:'advanced',termId:'synthetic-term',campusId:'c',
  groupCode:'01',instructor:'Test professor',dayOfWeek:'شنبه',
  startTime:'09:00',endTime:'10:00',capacity:30,enrolledCount:0,
  active:true,source:'manual',
};
const prerequisite:AcademicRule={
  id:'rule-basic-before-advanced',curriculumId:curriculum.id,
  targetCourseId:'advanced',relationshipType:'PREREQUISITE',
  expression:{type:'COURSE',courseId:'basic'},
};
const check=(options:{
  profile?: StudentAcademicProfile;
  rules?: AcademicRule[];
  links?: CurriculumCourse[];
  allowFinalSemesterPrerequisiteOverride?: boolean;
}={})=>evaluateStudentEligibility({
  studentProfile:options.profile??profile,curriculum,curriculumCourses:options.links??links,
  allCourses:courses,tracks:[],academicRules:options.rules??[prerequisite],
  passedCourses:[],currentOfferings:[advanced],
  ...(options.allowFinalSemesterPrerequisiteOverride!==undefined
    ?{allowFinalSemesterPrerequisiteOverride:options.allowFinalSemesterPrerequisiteOverride}:{})
});
afterEach(()=>vi.restoreAllMocks());
describe('final semester and cohort rules never grant invented academic permission',()=>{
  it('does not waive prerequisites based on a hard-coded 24-unit final-semester estimate',()=>{
    expect(courses.reduce((n,c)=>n+c.units,0)).toBeLessThan(24);
    expect(check().results[0].overallStatus).toBe('BLOCKED_PREREQUISITE');
  });
  it('honours an explicit verified manual override and rejects an explicit policy denial',()=>{
    const approved={...profile,isFinalSemesterOverride:true};
    expect(check({profile:approved}).results[0].overallStatus).toBe('AVAILABLE');
    expect(check({profile:approved,allowFinalSemesterPrerequisiteOverride:false}).results[0].overallStatus)
      .toBe('BLOCKED_PREREQUISITE');
  });
  it('does not apply rules from another degree entry cohort or major',()=>{
    expect(check({rules:[{...prerequisite,entryYearId:'year-1404'}]}).results[0].overallStatus)
      .toBe('AVAILABLE');
    expect(check({rules:[{...prerequisite,majorId:'foreign-major'}]}).results[0].overallStatus)
      .toBe('AVAILABLE');
    expect(check({rules:[prerequisite]}).results[0].overallStatus)
      .toBe('BLOCKED_PREREQUISITE');
  });
  it('never treats disabled curriculum course links as available',()=>{
    expect(check({links:links.map(link=>link.courseId==='advanced'?{...link,active:false}:link)})
      .results[0].overallStatus).toBe('NOT_IN_CURRICULUM');
  });
  it('does not print individual student prerequisite decisions to server logs',()=>{
    const consoleSpy=vi.spyOn(console,'log').mockImplementation(()=>{});
    check();
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
