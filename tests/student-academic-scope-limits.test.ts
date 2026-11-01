import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../server/db/database';
import type { Curriculum, CurriculumCourse, Course, StudentAcademicProfile } from '../src/types';

const prefix='test-academic-scope-limits-20261026';
const userId=prefix+'-student';
const chartId=prefix+'-matched';
const wrongChartId=prefix+'-foreign-campus';
const trackId=prefix+'-track';
const c1=prefix+'-common-1';
const c2=prefix+'-common-2';
const c3=prefix+'-track-specific';
const scope={universityId:prefix+'-university',campusId:prefix+'-campus',
  degreeLevelId:prefix+'-degree',majorId:prefix+'-major',entryYearId:prefix+'-year'};
const courses:Course[]=[
  {id:c1,code:prefix+'-1',name:'درس تست ۱',units:16,category:'اصلی',active:true},
  {id:c2,code:prefix+'-2',name:'درس تست ۲',units:16,category:'اصلی',active:true},
  {id:c3,code:prefix+'-3',name:'درس تست گرایشی',units:3,category:'تخصصی',active:true},
];
const assigned:CurriculumCourse[]=[
  {id:prefix+'-cc1',curriculumId:chartId,courseId:c1,classification:'MAJOR_REQUIRED',suggestedSemester:1,active:true},
  {id:prefix+'-cc2',curriculumId:chartId,courseId:c2,classification:'MAJOR_REQUIRED',suggestedSemester:2,active:true},
  {id:prefix+'-cc3',curriculumId:chartId,courseId:c1,trackId,classification:'TRACK_REQUIRED',suggestedSemester:3,active:true},
  {id:prefix+'-cc4',curriculumId:chartId,courseId:c3,trackId,classification:'TRACK_REQUIRED',suggestedSemester:4,active:true},
];
beforeAll(async()=>{
  await db.init(true);
  const chart:Curriculum={...scope,id:chartId,name:'چارت دقیق آزمایشی',version:'scope-test',
    status:'active',createdAt:'2026-10-26T00:00:00.000Z'};
  const wrong:Curriculum={...chart,id:wrongChartId,campusId:prefix+'-other-campus'};
  db.curricula.unshift(wrong);
  db.curricula.push(chart);
  db.courses.push(...courses);
  db.curriculumCourses.push(...assigned);
  const profile:StudentAcademicProfile={userId,...scope,isTrackSelected:false,desiredTrackIds:[],
    updatedAt:'2026-10-26T00:00:00.000Z'};
  db.studentProfiles.push(profile);
});
afterAll(()=>{
  db.data.studentProfiles=db.studentProfiles.filter(p=>p.userId!==userId);
  db.data.curricula=db.curricula.filter(c=>![chartId,wrongChartId].includes(c.id));
  db.data.curriculumCourses=db.curriculumCourses.filter(cc=>!cc.id.startsWith(prefix));
  db.data.courses=db.courses.filter(c=>!c.id.startsWith(prefix));
  db.save();
});
describe('student credit/graduation scope integrity',()=>{
  it('uses the exact matching active chart even if a different-campus chart comes first',()=>{
    const result=db.calculateStudentAcademicLimits(userId);
    expect(result.totalCurriculumUnits).toBe(32);
    expect(result.remainingUnits).toBe(32);
    expect(result.isFinalSemester).toBe(false);
  });
  it('never counts every unchosen track as an official graduation requirement',()=>{
    const profile=db.studentProfiles.find(p=>p.userId===userId)!;
    profile.isTrackSelected=true;profile.selectedTrackId=trackId;
    try{
      const result=db.calculateStudentAcademicLimits(userId);
      expect(result.totalCurriculumUnits).toBe(35);
      expect(result.remainingUnits).toBe(35);
      expect(result.isFinalSemester).toBe(false);
    } finally {
      profile.isTrackSelected=false;profile.selectedTrackId=null;
    }
  });
  it('keeps an explicit admin-approved last-term override even before the student declares a track',()=>{
    const profile=db.studentProfiles.find(p=>p.userId===userId)!;
    profile.isFinalSemesterOverride=true;
    profile.finalSemesterNotes='تأیید صریح مدیر آموزش در سناریوی آزمایشی';
    try {
      const result=db.calculateStudentAcademicLimits(userId);
      expect(result.isFinalSemester).toBe(true);
      expect(result.effectiveMaxUnits).toBe(result.policySettings.finalSemesterMaxUnits);
      expect(result.finalSemesterReason).toMatch(/تأیید صریح/);
    } finally {
      profile.isFinalSemesterOverride=null;
      profile.finalSemesterNotes=undefined;
    }
  });
  it('never fabricates a 140-unit matching chart or final-term eligibility when campus is unknown',()=>{
    const profile=db.studentProfiles.find(p=>p.userId===userId)!;
    const before=profile.campusId;
    profile.campusId='unknown-campus';
    try {
      const result=db.calculateStudentAcademicLimits(userId);
      expect(result.totalCurriculumUnits).toBe(0);
      expect(result.remainingUnits).toBe(0);
      expect(result.isFinalSemester).toBe(false);
      expect(result.effectiveMaxUnits).toBe(result.policySettings.normalMaxUnits);
      expect(result.finalSemesterReason).toMatch(/چارت فعال/);
    } finally {profile.campusId=before;}
  });
  it('does not invent a student curriculum before profile initialization',()=>{
    const result=db.calculateStudentAcademicLimits(prefix+'-unknown');
    expect(result.totalCurriculumUnits).toBe(0);
    expect(result.remainingCoursesCount).toBe(0);
    expect(result.isFinalSemester).toBe(false);
  });
});
