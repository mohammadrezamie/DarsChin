import { describe, expect, it } from 'vitest';
import { calculateAcademicLimits } from '../src/domain/academic-policy';
import type { AcademicPolicySettings, Course, CurriculumCourse, StudentAcademicProfile,
  StudentPassedCourse } from '../src/types';

const settings:AcademicPolicySettings={
  normalMinUnits:12,normalMaxUnits:20,gpaBonusThreshold:17,gpaBonusMaxUnits:24,
  summerMinUnits:1,summerMaxUnits:8,finalSemesterMaxUnits:24,
  finalSemesterThresholdUnits:24,finalSemesterRuleEnabled:true,
};
const courses:Course[]=[
  {id:'a',code:'A',name:'درس اصلی الف',units:3,active:true,category:'اصلی'},
  {id:'b',code:'B',name:'درس اصلی ب',units:3,active:true,category:'اصلی'},
  {id:'track',code:'TR',name:'درس گرایشی',units:2,active:true,category:'تخصصی'},
];
const links:CurriculumCourse[]=[
  {id:'one',curriculumId:'chart',courseId:'a',classification:'MAJOR_REQUIRED',suggestedSemester:1,active:true},
  {id:'duplicate',curriculumId:'chart',courseId:'a',classification:'MAJOR_REQUIRED',suggestedSemester:1,active:true},
  {id:'two',curriculumId:'chart',courseId:'b',classification:'MAJOR_REQUIRED',suggestedSemester:2,active:true},
  {id:'track',curriculumId:'chart',courseId:'track',trackId:'power',
    classification:'TRACK_REQUIRED',suggestedSemester:3,active:true},
];
const profile:StudentAcademicProfile={
  userId:'student',universityId:'university',campusId:'campus',
  degreeLevelId:'degree',majorId:'major',entryYearId:'year',isTrackSelected:false,
  selectedTrackId:null,desiredTrackIds:[],updatedAt:'',
};
const passed=(id:string,grade:number,status:'PASSED'|'FAILED'='PASSED'):StudentPassedCourse=>
  ({id:'attempt-'+id,courseId:id,userId:'student',grade,status,passedAt:''});

describe('compatibility credit policy avoids false completed units',()=>{
  it('never counts status=PASSED with a failing grade and never double-counts duplicate chart rows',()=>{
    const data=calculateAcademicLimits(profile,courses,links,[passed('a',9)],settings);
    expect(data.totalCurriculumUnits).toBe(6);
    expect(data.passedUnits).toBe(0);
    expect(data.remainingUnits).toBe(6);
    expect(data.remainingCoursesCount).toBe(2);
    const successful=calculateAcademicLimits(profile,courses,links,
      [passed('a',17),{...passed('a',17),id:'repeated-attempt'}],settings);
    expect(successful.passedUnits).toBe(3);
    expect(successful.remainingUnits).toBe(3);
  });
  it('never infers final semester for missing curriculum or undeclared required track',()=>{
    expect(calculateAcademicLimits(profile,courses,[],[],settings).isFinalSemester).toBe(false);
    const emptyOverride=calculateAcademicLimits(
      {...profile,isFinalSemesterOverride:true},courses,[],[],settings);
    expect(emptyOverride.isFinalSemester).toBe(false);
    expect(emptyOverride.effectiveMaxUnits).toBe(settings.normalMaxUnits);
    expect(calculateAcademicLimits(profile,courses,links,[],settings).isFinalSemester).toBe(false);
    const override=calculateAcademicLimits(
      {...profile,isFinalSemesterOverride:true},courses,links,[],settings);
    expect(override.isFinalSemester).toBe(true);
  });
});
