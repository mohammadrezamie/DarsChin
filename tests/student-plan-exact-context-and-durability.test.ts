import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, type DatabaseSchema } from '../server/db/database';
import { studentRouter } from '../server/routes/student';
import { generateToken } from '../server/middleware/auth';
import type { User, StudentAcademicProfile, Course, CourseOffering, CurriculumCourse } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/student', studentRouter);

const studentId='synthetic-atomic-planning-student';
const otherId='synthetic-atomic-planning-peer';
const courseId='synthetic-atomic-planning-course';
const offeringId='synthetic-atomic-planning-offer';
const alternateId='synthetic-atomic-planning-alternative';
const foreignId='synthetic-foreign-campus-offer';
const privateMarker='SYNTHETIC_PRIVATE_PATH:/private/student-plan.env';
let previous: DatabaseSchema;
let token='';
let otherToken='';
let chartId='';
let termId='';
let campusId='';

beforeAll(async()=>{await db.init(true);});
beforeEach(()=>{
  previous=db.data;
  const chart=previous.curricula.find(c=>c.status==='active');
  const term=previous.academicTerms.find(t=>t.isCurrent) ?? previous.academicTerms[0];
  if(!chart || !term)throw Error('Missing synthetic chart/term');
  chartId=chart.id;termId=term.id;campusId=chart.campusId;
  const user=(id:string,mobile:string):User=>({
    id,mobile,name:'Synthetic planning student',roles:['student'],createdAt:new Date().toISOString()
  });
  const me=user(studentId,'09900006713'),other=user(otherId,'09900006714');
  const profile:StudentAcademicProfile={
    userId:studentId,universityId:chart.universityId,campusId:chart.campusId,
    degreeLevelId:chart.degreeLevelId,majorId:chart.majorId,entryYearId:chart.entryYearId,
    isTrackSelected:false,desiredTrackIds:[],currentTermId:termId,updatedAt:new Date().toISOString(),
  };
  const course:Course={id:courseId,code:'SYN-001',name:'درس آزمایشی برنامه‌ریز',
    units:2,category:'تخصصی',active:true};
  const curriculumCourse:CurriculumCourse={id:'cc-'+courseId,curriculumId:chartId,
    courseId,classification:'MAJOR_REQUIRED',suggestedSemester:1,active:true};
  const offering=(id:string,campus=campusId,groupCode='41'):CourseOffering=>({
    id,termId,campusId:campus,courseId,groupCode,instructor:'Synthetic teacher',
    dayOfWeek:'شنبه',startTime:'08:00',endTime:'09:30',
    capacity:30,enrolledCount:0,active:true,source:'manual',
  });
  db.data={
    ...previous,
    users:[me,other],
    studentProfiles:[profile,{...profile,userId:otherId}],
    curricula:[{...chart}],
    courses:[...previous.courses,course],
    curriculumCourses:[...previous.curriculumCourses,curriculumCourse],
    courseOfferings:[
      offering(offeringId),offering(alternateId,campusId,'42'),
      offering(foreignId,'synthetic-foreign-campus','43'),
    ],
    studentPlans:[],studentPassedCourses:[],auditLogs:[],
  };
  token='Bearer '+generateToken(me);
  otherToken='Bearer '+generateToken(other);
});
afterEach(()=>{vi.restoreAllMocks();db.data=previous;});

const post=(route:string,auth=token)=>request(app).post('/api/student'+route).set('Authorization',auth);
const put=(route:string,auth=token)=>request(app).put('/api/student'+route).set('Authorization',auth);
const get=(route:string,auth=token)=>request(app).get('/api/student'+route).set('Authorization',auth);
const failedSave=()=>vi.spyOn(db,'save').mockImplementationOnce(()=>{throw Error(privateMarker);});
const noLeak=(res:{body:unknown})=>expect(JSON.stringify(res.body)).not.toContain(privateMarker);

describe('real student term/chart-scoped planning and durable writes',()=>{
  it('returns an empty plan on GET without writing a phantom record',async()=>{
    const spy=vi.spyOn(db,'save');
    const response=await get('/plan');
    expect(response.status).toBe(200);
    expect(response.body.data.selectedOfferingIds).toEqual([]);
    expect(db.studentPlans).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('denies selecting another campus or a wrong entry year, without leaving a plan',async()=>{
    const foreign=await post('/plan/select').send({offeringId:foreignId,action:'add'});
    expect(foreign.status).toBe(403);
    const otherCampus=await put('/plan').send({selectedOfferingIds:[foreignId]});
    expect(otherCampus.status).toBe(400);
    db.studentProfiles[0].entryYearId='synthetic-wrong-year';
    expect((await post('/plan/select').send({offeringId,action:'add'})).status).toBe(409);
    expect((await put('/plan').send({selectedOfferingIds:[offeringId]})).status).toBe(409);
    expect(db.studentPlans).toHaveLength(0);
  });

  it('rejects unpublished or duplicate active charts and never chooses an arbitrary chart',async()=>{
    db.curricula[0].status='draft';
    expect((await put('/plan').send({selectedOfferingIds:[offeringId]})).status).toBe(409);
    db.curricula[0].status='active';
    db.curricula.push({...db.curricula[0],id:'synthetic-duplicate-active-chart'});
    expect((await post('/plan/select').send({offeringId,action:'add'})).status).toBe(409);
    expect(db.studentPlans).toHaveLength(0);
  });

  it('rejects duplicate groups of one course and keeps selected offerings authoritative',async()=>{
    const group=await put('/plan').send({selectedOfferingIds:[offeringId,alternateId]});
    expect(group.status).toBe(400);
    const same=await put('/plan').send({selectedOfferingIds:[offeringId,offeringId]});
    expect(same.status).toBe(400);
    expect(db.studentPlans).toHaveLength(0);
  });

  it('allows a scoped group and swaps its alternative without selecting both',async()=>{
    const first=await post('/plan/select').send({offeringId,action:'add'});
    expect(first.status).toBe(200);
    expect(first.body.selectedOfferingIds).toEqual([offeringId]);
    const swap=await post('/plan/select').send({offeringId:alternateId,action:'add'});
    expect(swap.status).toBe(200);
    expect(swap.body.selectedOfferingIds).toEqual([alternateId]);
    expect(swap.body.plan.offeringPriorities[courseId]).toEqual([alternateId,offeringId]);
    expect(db.studentPlans.filter(p=>p.userId===studentId)).toHaveLength(1);
    expect((await get('/plan',otherToken)).body.data.selectedOfferingIds).toEqual([]);
  });

  it('does not commit a phantom plan or altered priorities after write failure',async()=>{
    let fail=failedSave();
    const attempt=await post('/plan/select').send({offeringId,action:'add'});
    fail.mockRestore();
    expect(attempt.status).toBe(503);noLeak(attempt);
    expect(db.studentPlans).toHaveLength(0);

    const valid=await post('/plan/select').send({offeringId,action:'add'});
    expect(valid.status).toBe(200);
    const old=JSON.stringify(db.studentPlans);
    fail=failedSave();
    const update=await put('/plan').send({coursePriorities:[courseId]});
    fail.mockRestore();
    expect(update.status).toBe(503);noLeak(update);
    expect(JSON.stringify(db.studentPlans)).toBe(old);

    fail=failedSave();
    const removal=await post('/plan/select').send({offeringId,action:'remove'});
    fail.mockRestore();
    expect(removal.status).toBe(503);noLeak(removal);
    expect(JSON.stringify(db.studentPlans)).toBe(old);
  });

  it('saves wishlist and journey steps without phantom updates on failed disk writes',async()=>{
    const original=JSON.stringify(db.studentPlans);
    let fail=failedSave();
    const basket=await put('/wishlist').send({courseIds:[courseId]});
    fail.mockRestore();
    expect(basket.status).toBe(503);noLeak(basket);
    expect(JSON.stringify(db.studentPlans)).toBe(original);

    fail=failedSave();
    const step=await put('/journey').send({step:5});
    fail.mockRestore();
    expect(step.status).toBe(503);noLeak(step);
    expect(JSON.stringify(db.studentPlans)).toBe(original);
    expect((await put('/wishlist').send({courseIds:[courseId]})).status).toBe(200);
    expect((await put('/journey').send({step:5})).status).toBe(200);
    const after=(await get('/plan')).body.data;
    expect(after.wishlistCourseIds).toEqual([courseId]);
    expect(after.journeyStep).toBe(5);
  });
  it('calculates graduation units using only the exact active cohort, never another campus',()=>{
    const initial=db.calculateStudentAcademicLimits(studentId);
    expect(initial.totalCurriculumUnits).toBeGreaterThan(0);
    db.studentProfiles[0].campusId='synthetic-mismatched-campus';
    const wrong=db.calculateStudentAcademicLimits(studentId);
    expect(wrong.totalCurriculumUnits).toBe(0);
    expect(wrong.remainingUnits).toBe(0);
    expect(wrong.isFinalSemester).toBe(false);
    db.studentProfiles[0].campusId=campusId;
    db.curricula.push({...db.curricula[0],id:'synthetic-second-active-chart'});
    const conflicted=db.calculateStudentAcademicLimits(studentId);
    expect(conflicted.totalCurriculumUnits).toBe(0);
    expect(conflicted.isFinalSemester).toBe(false);
  });

  it('does not treat unchosen track subjects as required for graduation',()=>{
    const before=db.calculateStudentAcademicLimits(studentId);
    const trackCourse:Course={
      id:'synthetic-foreign-track-requirement',
      name:'درس گرایش انتخاب‌نشده',code:'TRACK-EXTRA',units:4,active:true,category:'تخصصی',
    };
    db.courses.push(trackCourse);
    db.curriculumCourses.push({
      id:'synthetic-foreign-track-link',curriculumId:chartId,
      courseId:trackCourse.id,trackId:'synthetic-track-not-selected',
      classification:'TRACK_REQUIRED',suggestedSemester:6,active:true,
    });
    expect(db.calculateStudentAcademicLimits(studentId).remainingUnits).toBe(before.remainingUnits);
    expect(db.calculateStudentAcademicLimits(studentId).totalCurriculumUnits).toBe(before.totalCurriculumUnits);
    db.studentProfiles[0].selectedTrackId='synthetic-track-not-selected';
    const chosen=db.calculateStudentAcademicLimits(studentId);
    expect(chosen.totalCurriculumUnits).toBe(before.totalCurriculumUnits+4);
  });

  it('rejects cross-campus, wrong-term and wrong-course fallbacks even without primary selection',async()=>{
    const foreign=await put('/plan').send({offeringPriorities:{[courseId]:[foreignId]}});
    expect(foreign.status).toBe(400);
    const wrongTerm='synthetic-old-semester-alternative';
    db.courseOfferings.push({...db.courseOfferings[0],id:wrongTerm,termId:'different-term'});
    expect((await put('/plan').send({offeringPriorities:{[courseId]:[wrongTerm]}})).status).toBe(400);
    const wrongCourse='synthetic-mismatched-course-alternative';
    db.courseOfferings.push({...db.courseOfferings[0],id:wrongCourse,courseId:'other-course'});
    expect((await put('/plan').send({offeringPriorities:{[courseId]:[wrongCourse]}})).status).toBe(400);
    db.courseOfferings.find(row=>row.id===alternateId)!.active=false;
    expect((await put('/plan').send({offeringPriorities:{[courseId]:[alternateId]}})).status).toBe(400);
    expect(db.studentPlans).toHaveLength(0);
  });

  it('preserves valid scoped section alternatives and both priority formats',async()=>{
    const selected=await put('/plan').send({
      selectedOfferingIds:[offeringId],
      offeringPriorities:{[courseId]:[alternateId,offeringId]},
      coursePriorities:[courseId],
    });
    expect(selected.status).toBe(200);
    expect(selected.body.data.offeringPriorities[courseId]).toEqual([alternateId,offeringId]);
    expect(selected.body.data.coursePriorities).toEqual([courseId]);
    const legacy=await put('/plan').send({coursePriorities:{[courseId]:0}});
    expect(legacy.status).toBe(200);
    expect(legacy.body.data.coursePriorities).toEqual({[courseId]:0});
  });

  it('rejects unrelated course priorities and duplicated fallback IDs before any disk write',async()=>{
    const spy=vi.spyOn(db,'save');
    expect((await put('/plan').send({coursePriorities:['course-from-other-curriculum']})).status).toBe(400);
    expect((await put('/plan').send({coursePriorities:{'foreign-course':0}})).status).toBe(400);
    expect((await put('/plan').send({offeringPriorities:{[courseId]:[offeringId,offeringId]}})).status).toBe(400);
    expect((await put('/plan').send({coursePriorities:[courseId,courseId]})).status).toBe(400);
    expect((await put('/plan').send({selectedOfferingIds:[offeringId,offeringId]})).status).toBe(400);
    expect(db.studentPlans).toHaveLength(0);
    expect(spy).not.toHaveBeenCalled();
  });

});
