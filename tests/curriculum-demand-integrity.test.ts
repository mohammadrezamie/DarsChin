import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { curriculumRouter } from '../server/routes/curriculum';
import { studentRouter } from '../server/routes/student';
import { generateToken } from '../server/middleware/auth';
import type { Curriculum, DemandSurvey, StudentAcademicProfile, Track, User } from '../src/types';

const app=express();
app.use(express.json());
app.use('/api/curriculum',curriculumRouter);
app.use('/api/student',studentRouter);
const id='demand-curriculum-safety-fixture';
const userId=id+'-manager', studentId=id+'-student';
const chartId=id+'-1403', wrongChartId=id+'-wrong-campus', trackId=id+'-power';
const surveyId=id+'-survey';
let token='', studentToken='', courseId='', campusId='', majorId='', degreeId='', entryYearId='',universityId='';

beforeAll(async()=>{
  await db.init(true);
  const campus=db.campuses.find(c=>c.active);
  const major=db.majors.find(m=>m.active && db.degreeLevels.some(d=>d.id===m.degreeLevelId&&d.active));
  const course=db.courses.find(c=>c.active);
  const entry=db.entryYears.find(e=>e.active);
  if(!campus||!major||!course||!entry)throw Error('Pilot synthetic academic fixtures required');
  campusId=campus.id;majorId=major.id;degreeId=major.degreeLevelId;
  courseId=course.id;entryYearId=entry.id;universityId=campus.universityId;
  const now=new Date().toISOString();
  const root:User={id:userId,name:'مدیر آزمون چارت',mobile:'09999988111',
    roles:['super-admin'],permissions:['curriculum.manage'],createdAt:now};
  const student:User={id:studentId,name:'دانشجوی آزمون',mobile:'09999988112',
    roles:['student'],createdAt:now};
  db.users.push(root,student);token='Bearer '+generateToken(root);studentToken='Bearer '+generateToken(student);
  const chart:Curriculum={id:chartId,universityId,campusId,degreeLevelId:degreeId,
    majorId,entryYearId,version:'test',name:'چارت ایمن برای تست',status:'active',createdAt:now};
  const wrong={...chart,id:wrongChartId,campusId:'unrelated-campus'};
  db.curricula.unshift(wrong);
  db.curricula.push(chart);
  const power:Track={id:trackId,majorId,name:'گرایش فرضی ایزوله',code:'INTEGRITY',active:true};
  db.tracks.push(power);
  const profile:StudentAcademicProfile={userId:studentId,universityId,campusId,
    degreeLevelId:degreeId,majorId,entryYearId,isTrackSelected:true,
    selectedTrackId:trackId,desiredTrackIds:[],updatedAt:now};
  db.studentProfiles.push(profile);
});

afterAll(()=>{
  const userSet=new Set([userId,studentId]), chartSet=new Set([chartId,wrongChartId]);
  db.data.users=db.users.filter(u=>!userSet.has(u.id));
  db.data.studentProfiles=db.studentProfiles.filter(p=>p.userId!==studentId);
  db.data.curricula=db.curricula.filter(c=>!chartSet.has(c.id));
  db.data.curriculumCourses=db.curriculumCourses.filter(cc=>!chartSet.has(cc.curriculumId));
  db.data.tracks=db.tracks.filter(t=>t.id!==trackId);
  db.data.demandSurveys=db.demandSurveys.filter(s=>s.id!==surveyId);
  db.data.demandResponses=db.demandResponses.filter(r=>r.surveyId!==surveyId);
  db.save();
});

describe('separation of cohorts, campuses and major tracks',()=>{
  it('stores a track-specific assignment exactly rather than silently making it common',async()=>{
    const payload={courseId,trackId,classification:'TRACK_REQUIRED',suggestedSemester:5};
    const r=await request(app).post(`/api/curriculum/${chartId}/courses`)
      .set('Authorization',token).send(payload);
    expect(r.status).toBe(200);
    expect(r.body.data.trackId).toBe(trackId);
    expect(db.curriculumCourses.some(cc=>cc.curriculumId===chartId&&cc.courseId===courseId&&cc.trackId===trackId)).toBe(true);
    const duplicate=await request(app).post(`/api/curriculum/${chartId}/courses`)
      .set('Authorization',token).send(payload);
    expect(duplicate.status).toBe(400);
  });
  it('rejects a foreign track or an invalid chart/course instead of storing a misleading assignment',async()=>{
    const wrong=await request(app).post(`/api/curriculum/${chartId}/courses`)
      .set('Authorization',token)
      .send({courseId,trackId:'foreign-major-track',suggestedSemester:4});
    expect(wrong.status).toBe(400);
    const absent=await request(app).post('/api/curriculum/does-not-exist/courses')
      .set('Authorization',token).send({courseId});
    expect(absent.status).toBe(404);
  });
  it('never assigns the student the first matching major from a different campus',async()=>{
    const answer=await request(app).get('/api/student/profile').set('Authorization',studentToken);
    expect(answer.status).toBe(200);
    expect(answer.body.data.curriculum?.id).toBe(chartId);
    const profile=db.studentProfiles.find(p=>p.userId===studentId)!;
    profile.campusId='unknown-other-campus';
    const noChart=await request(app).get('/api/student/profile').set('Authorization',studentToken);
    expect(noChart.body.data.curriculum).toBeNull();
    profile.campusId=campusId;
  });
  it('rejects deletion or moving a curriculum with demand history to another cohort',async()=>{
    const survey:DemandSurvey={
      id:surveyId,title:'نیازسنجی حفظ تاریخچه',description:'',
      targetTermId:'term-fixture',universityId,campusId,degreeLevelId:degreeId,
      majorId,curriculumId:chartId,entryYearIds:[entryYearId],trackIds:[trackId],
      courseIds:[courseId],recommendedMinimumByCourse:{[courseId]:10},
      status:'OPEN',createdBy:userId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    };
    db.demandSurveys.push(survey);
    const delCourse=await request(app).delete(`/api/curriculum/${chartId}/courses/${courseId}`)
      .set('Authorization',token);
    expect(delCourse.status).toBe(409);
    const delChart=await request(app).delete(`/api/curriculum/${chartId}`).set('Authorization',token);
    expect(delChart.status).toBe(409);
    const move=await request(app).put(`/api/curriculum/${chartId}`)
      .set('Authorization',token).send({entryYearId:'unrelated-cohort'});
    expect(move.status).toBe(409);
    expect(db.curricula.find(c=>c.id===chartId)?.entryYearId).toBe(entryYearId);
    expect(db.curriculumCourses.some(c=>c.curriculumId===chartId&&c.courseId===courseId)).toBe(true);
  });
});
