import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { curriculumRouter } from '../server/routes/curriculum';
import { academicRouter } from '../server/routes/academic';
import { studentRouter } from '../server/routes/student';
import { eligibilityRouter } from '../server/routes/eligibility';
import { generateToken } from '../server/middleware/auth';
import type { Curriculum, DemandSurvey, StudentAcademicProfile, Track, User } from '../src/types';

const app=express();
app.use(express.json());
app.use('/api/curriculum',curriculumRouter);
app.use('/api/student',studentRouter);
app.use('/api/eligibility',eligibilityRouter);
app.use('/api/academic',academicRouter);
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
  it('creates a new draft for a valid campus/degree/major/entry-year, rejecting mismatches and duplicate versions', async()=>{
    const payload={
      universityId,campusId,degreeLevelId:degreeId,majorId,entryYearId,
      version:'visual-qa-fixture-20261025',name:'چارت تست قابل ساخت',status:'draft',
      notes:'صرفاً آزمایش ساخت چارت',
    };
    const mismatch=await request(app).post('/api/curriculum').set('Authorization',token)
      .send({...payload,majorId:'not-a-real-major'});
    expect(mismatch.status).toBe(400);
    const created=await request(app).post('/api/curriculum').set('Authorization',token).send(payload);
    expect(created.status).toBe(200);
    expect(created.body.data.status).toBe('draft');
    const duplicate=await request(app).post('/api/curriculum').set('Authorization',token).send(payload);
    expect(duplicate.status).toBe(409);
    const itemId=created.body.data.id;
    expect(db.curricula.some(x=>x.id===itemId)).toBe(true);
    db.data.curricula=db.curricula.filter(x=>x.id!==itemId);
  });
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
  it('requires an explicit track for ambiguous duplicate course assignments',async()=>{
    const shared=await request(app).post(`/api/curriculum/${chartId}/courses`)
      .set('Authorization',token).send({
        courseId,trackId:'',classification:'MAJOR_REQUIRED',suggestedSemester:3,
      });
    expect(shared.status).toBe(200);
    expect(shared.body.data.trackId).toBeNull();
    const ambiguous=await request(app).delete(`/api/curriculum/${chartId}/courses/${courseId}`)
      .set('Authorization',token);
    expect(ambiguous.status).toBe(409);
    const matching=db.curriculumCourses.filter(c=>c.curriculumId===chartId&&c.courseId===courseId);
    expect(matching).toHaveLength(2);
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
  it('rejects plans and recommendations when the student has no active exact-scope chart',async()=>{
    const profile=db.studentProfiles.find(p=>p.userId===studentId)!;
    const originalCampus=profile.campusId;
    const existingPlanCount=db.studentPlans.filter(p=>p.userId===studentId).length;
    const offering=db.courseOfferings[0];
    try{
      profile.campusId='unrelated-campus-should-not-match';
      const evaluate=await request(app).post('/api/eligibility/evaluate')
        .set('Authorization',studentToken).send({plannedCourseIds:[]});
      expect(evaluate.status).toBe(400);
      const saved=await request(app).put('/api/student/plan')
        .set('Authorization',studentToken)
        .send({selectedOfferingIds:['unrelated-selected-offering']});
      expect(saved.status).toBe(409);
      if(offering){
        const selected=await request(app).post('/api/student/plan/select')
          .set('Authorization',studentToken).send({offeringId:offering.id,action:'add'});
        expect(selected.status).toBe(409);
      }
      expect(db.studentPlans.filter(p=>p.userId===studentId)).toHaveLength(existingPlanCount);
    }finally{profile.campusId=originalCampus;}
  });
  it('rejects malformed eligibility selections without an internal server error',async()=>{
    const response=await request(app).post('/api/eligibility/evaluate')
      .set('Authorization',studentToken).send({plannedCourseIds:{bad:'payload'}});
    expect(response.status).toBe(400);
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
  it('does not delete an active chart used by students even before any survey is published',async()=>{
    const result=await request(app).delete(`/api/curriculum/${chartId}`)
      .set('Authorization',token);
    expect(result.status).toBe(409);
    expect(db.curricula.some(c=>c.id===chartId)).toBe(true);
  });
  it('rejects malformed status, empty version and inconsistent academic major on update',async()=>{
    for(const payload of [
      {status:'COMPLETELY_APPROVED'},
      {version:'  '},
      {majorId:'foreign-major'},
      {entryYearId:'missing-year'},
    ]){
      const result=await request(app).put(`/api/curriculum/${chartId}`)
        .set('Authorization',token).send(payload);
      expect(result.status).toBe(400);
    }
    expect(db.curricula.find(c=>c.id===chartId)?.status).toBe('active');
    expect(db.curricula.find(c=>c.id===chartId)?.version).toBe('test');
  });
  it('deletes only a truly unused draft and its local chart assignments',async()=>{
    const newYearId='test-standalone-unused-year';
    const draftId='test-standalone-unused-chart';
    db.entryYears.push({id:newYearId,year:1398,active:true});
    db.curricula.push({
      id:draftId,universityId,campusId,degreeLevelId:degreeId,majorId,
      entryYearId:newYearId,version:'unused',name:'چارت آزمایشی بدون دانشجو',
      status:'draft',createdAt:new Date().toISOString(),
    });
    db.curriculumCourses.push({
      id:'test-standalone-course',curriculumId:draftId,courseId,
      classification:'MAJOR_REQUIRED',suggestedSemester:1,active:true,
    });
    try{
      const result=await request(app).delete(`/api/curriculum/${draftId}`)
        .set('Authorization',token);
      expect(result.status).toBe(200);
      expect(db.curricula.some(c=>c.id===draftId)).toBe(false);
      expect(db.curriculumCourses.some(cc=>cc.curriculumId===draftId)).toBe(false);
      expect(db.courses.some(c=>c.id===courseId)).toBe(true);
    }finally{
      db.data.curricula=db.curricula.filter(c=>c.id!==draftId);
      db.data.curriculumCourses=db.curriculumCourses.filter(cc=>cc.curriculumId!==draftId);
      db.data.entryYears=db.entryYears.filter(y=>y.id!==newYearId);
    }
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
    const deleteCourse=await request(app).delete(`/api/academic/courses/${courseId}`)
      .set('Authorization',token);
    expect(deleteCourse.status).toBe(409);
    expect(db.courses.some(c=>c.id===courseId)).toBe(true);
    const deleteTrack=await request(app).delete(`/api/academic/tracks/${trackId}`)
      .set('Authorization',token);
    expect(deleteTrack.status).toBe(409);
    expect(db.tracks.some(t=>t.id===trackId)).toBe(true);
  });
  it('cannot delete a track still used only by academic rules or desired student tracks',async()=>{
    const dependent='test-rule-only-track';
    const ruleId='test-track-required-academic-rule';
    db.tracks.push({id:dependent,majorId,name:'گرایش فقط قانون آزمایشی',code:'TMP',active:true});
    db.academicRules.push({
      id:ruleId,curriculumId:chartId,targetCourseId:courseId,
      relationshipType:'PREREQUISITE',trackId:dependent,
      expression:{type:'MIN_PASSED_UNITS',minUnits:9},
    });
    const profile=db.studentProfiles.find(p=>p.userId===studentId)!;
    const before=[...(profile.desiredTrackIds||[])];
    try{
      const ruleConflict=await request(app).delete(`/api/academic/tracks/${dependent}`)
        .set('Authorization',token);
      expect(ruleConflict.status).toBe(409);
      db.data.academicRules=db.academicRules.filter(rule=>rule.id!==ruleId);
      profile.desiredTrackIds=[...before,dependent];
      const desiredConflict=await request(app).delete(`/api/academic/tracks/${dependent}`)
        .set('Authorization',token);
      expect(desiredConflict.status).toBe(409);
      expect(db.tracks.some(t=>t.id===dependent)).toBe(true);
    }finally{
      profile.desiredTrackIds=before;
      db.data.academicRules=db.academicRules.filter(rule=>rule.id!==ruleId);
      db.data.tracks=db.tracks.filter(t=>t.id!==dependent);
    }
  });
  it('recognizes multi-cohort survey links even when the old singular field points elsewhere',async()=>{
    const survey=db.demandSurveys.find(s=>s.id===surveyId)!;
    const savedSingular=survey.curriculumId;
    const savedMultiple=survey.curriculumIds;
    survey.curriculumId='unrelated-legacy-chart';
    survey.curriculumIds=[chartId];
    try{
      const del=await request(app).delete(`/api/curriculum/${chartId}`)
        .set('Authorization',token);
      expect(del.status).toBe(409);
      const edit=await request(app).put(`/api/curriculum/${chartId}`)
        .set('Authorization',token).send({version:'v2'});
      expect(edit.status).toBe(409);
      const archive=await request(app).put(`/api/curriculum/${chartId}`)
        .set('Authorization',token).send({status:'archived'});
      expect(archive.status).toBe(409);
      expect(db.curricula.find(c=>c.id===chartId)?.version).toBe('test');
    }finally{
      survey.curriculumId=savedSingular;
      survey.curriculumIds=savedMultiple;
    }
  });
});
