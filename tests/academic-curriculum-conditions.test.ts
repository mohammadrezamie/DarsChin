import { describe, expect, it } from 'vitest';
import { evaluateStudentEligibility } from '../src/domain/eligibility-engine';
import type {
  AcademicRule, Course, CourseOffering, Curriculum, CurriculumCourse,
  StudentAcademicProfile, StudentPassedCourse,
} from '../src/types';

// Synthetic fixtures: the numerical thresholds here ARE NOT official IAU rules.
const courses:Course[]=[
  {id:'general-1',name:'درس آزمایشی ۱',code:'T1',category:'پایه',units:3,active:true},
  {id:'general-2',name:'درس آزمایشی ۲',code:'T2',category:'پایه',units:2,active:true},
  {id:'internship',name:'کارآموزی (آزمایشی)',code:'INT',category:'تخصصی',units:1,active:true},
];
const courseLinks:CurriculumCourse[]=[
  ...['chart-1402','chart-1403'].flatMap(id=>courses.map((c,index)=>({
    id:`${id}-${c.id}`,curriculumId:id,courseId:c.id,classification:'MAJOR_REQUIRED' as const,
    suggestedSemester:index+1,active:true,
  }))),
];
const curriculum=(id:string,entryYearId:string):Curriculum=>({
  id,universityId:'u',campusId:'campus',degreeLevelId:'be',majorId:'electrical',
  entryYearId,version:entryYearId+'-demo',name:'چارت نمونه '+entryYearId,
  status:'active',createdAt:'2026-10-25T00:00:00Z',
});
const profile=(entryYearId:string):StudentAcademicProfile=>({
  userId:'student',universityId:'u',campusId:'campus',degreeLevelId:'be',majorId:'electrical',
  entryYearId,isTrackSelected:false,desiredTrackIds:[],updatedAt:'',
});
const offering:CourseOffering={
  id:'internship-offer',termId:'term',campusId:'campus',courseId:'internship',
  groupCode:'01',dayOfWeek:'شنبه',startTime:'08:00',endTime:'09:00',
  capacity:20,enrolledCount:0,instructor:'استاد نمونه',source:'manual',active:true,
};
const passed:StudentPassedCourse[]=[
  {id:'p1',userId:'student',courseId:'general-1',status:'PASSED',grade:18,passedAt:''},
];
const rule=(id:string,minUnits:number):AcademicRule=>({
  id:'test-rule-'+id,curriculumId:id,targetCourseId:'internship',
  relationshipType:'PREREQUISITE',expression:{type:'MIN_PASSED_UNITS',minUnits},
});
function status(entryYearId:string,rules:AcademicRule[]){
  return evaluateStudentEligibility({
    studentProfile:profile(entryYearId),
    curriculum:curriculum('chart-'+entryYearId,entryYearId),
    curriculumCourses:courseLinks,allCourses:courses,tracks:[],
    academicRules:rules,passedCourses:passed,currentOfferings:[offering],
  }).results[0];
}

describe('per-curriculum editable conditions (all numbers are synthetic)',()=>{
  it('does not inherit the other entry year internship threshold',()=>{
    const rules=[rule('chart-1402',5),rule('chart-1403',3)];
    expect(status('1402',rules).overallStatus).toBe('BLOCKED_PREREQUISITE');
    expect(status('1403',rules).overallStatus).toBe('AVAILABLE');
  });
  it('supports a course with no prerequisites or credit minimum',()=>{
    expect(status('1402',[]).overallStatus).toBe('AVAILABLE');
  });
  it('can represent both course and credit conditions without hardcoding a named course',()=>{
    const mixed:AcademicRule={
      id:'mixed-example',curriculumId:'chart-1403',targetCourseId:'internship',
      relationshipType:'PREREQUISITE',
      expression:{type:'GROUP',operator:'AND',operands:[
        {type:'COURSE',courseId:'general-1'},
        {type:'MIN_PASSED_UNITS',minUnits:5},
      ]},
    };
    expect(status('1403',[mixed]).overallStatus).toBe('BLOCKED_PREREQUISITE');
  });
});
