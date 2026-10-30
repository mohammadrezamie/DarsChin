import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, type DatabaseSchema } from '../server/db/database';
import type { StudentAcademicProfile, StudentPassedCourse } from '../src/types';

let original: DatabaseSchema;
const id = 'test-20261030-exact-chart-limits';
let matching: StudentAcademicProfile;

beforeAll(async()=>{
  await db.init(true);
  original = db.data;
  const chart = original.curricula.find(row=>row.status==='active');
  if(!chart)throw new Error('Synthetic active curriculum missing');
  matching = {
    userId:id,universityId:chart.universityId,campusId:chart.campusId,
    degreeLevelId:chart.degreeLevelId,majorId:chart.majorId,
    entryYearId:chart.entryYearId,isTrackSelected:false,
    desiredTrackIds:[],currentTermId:original.academicTerms.find(t=>t.isCurrent)?.id,
    updatedAt:new Date().toISOString(),
  };
});
afterAll(()=>{db.data=original;});

describe('academic progress must never borrow another student chart',()=>{
  it('does not fabricate 140 curriculum units or 45 remaining courses for an unknown account',()=>{
    const result=db.calculateStudentAcademicLimits('unknown-account-without-profile');
    expect(result.totalCurriculumUnits).toBe(0);
    expect(result.remainingUnits).toBe(0);
    expect(result.remainingCoursesCount).toBe(0);
    expect(result.isFinalSemester).toBe(false);
  });

  it('resolves only an active chart matching the full university, campus, degree, major and entry year',()=>{
    const fake={...matching,campusId:'no-active-chart-on-this-campus'};
    db.data={...original,studentProfiles:[...original.studentProfiles,fake]};
    const result=db.calculateStudentAcademicLimits(id);
    expect(result.totalCurriculumUnits).toBe(0);
    expect(result.remainingUnits).toBe(0);
    expect(result.isFinalSemester).toBe(false);
    expect(result.finalSemesterReason).toContain('چارت فعال');
    db.data={...original,studentProfiles:[...original.studentProfiles,matching]};
    const valid=db.calculateStudentAcademicLimits(id);
    const chart=original.curricula.find(c=>c.status==='active'&&c.campusId===matching.campusId &&
      c.majorId===matching.majorId&&c.degreeLevelId===matching.degreeLevelId&&c.entryYearId===matching.entryYearId)!;
    const ids=new Set(original.curriculumCourses.filter(cc=>cc.curriculumId===chart.id).map(cc=>cc.courseId));
    const units=original.courses.filter(c=>ids.has(c.id)).reduce((sum,c)=>sum+(c.units||0),0);
    expect(valid.totalCurriculumUnits).toBe(units);
  });

  it('counts graduation progress only for courses on the matched active chart',()=>{
    const chart=original.curricula.find(c=>c.status==='active'&&c.campusId===matching.campusId &&
      c.majorId===matching.majorId&&c.degreeLevelId===matching.degreeLevelId&&c.entryYearId===matching.entryYearId)!;
    const chartIds=new Set(original.curriculumCourses.filter(cc=>cc.curriculumId===chart.id).map(cc=>cc.courseId));
    const foreign=original.courses.find(c=>!chartIds.has(c.id));
    if(!foreign)return;
    const passed:StudentPassedCourse={
      id:'test-foreign-passed',userId:id,courseId:foreign.id,status:'PASSED',grade:15,passedAt:new Date().toISOString(),
    };
    db.data={...original,studentProfiles:[...original.studentProfiles,matching],
      studentPassedCourses:[...original.studentPassedCourses,passed]};
    expect(db.calculateStudentAcademicLimits(id).passedUnits).toBe(0);
  });
});
