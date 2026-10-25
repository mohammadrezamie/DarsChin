import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { demandRouter } from '../server/routes/demand';
import { generateToken } from '../server/middleware/auth';
import type { User, StudentAcademicProfile } from '../src/types';

const app=express();app.use(express.json());app.use('/api/demand',demandRouter);
const userIds=['test-demand-manager','test-demand-student','test-demand-outsider'];
let auth:{manager:string;student:string;outsider:string};
let curriculumId='',termId='',courseId='';
const createdSurveyIds:string[]=[];
const campusKey='test-demand-campus';

beforeAll(async()=>{
  await db.init(true);
  const curriculum=db.curricula.find(c=>db.curriculumCourses.some(cc=>cc.curriculumId===c.id && cc.active!==false &&
    db.courses.some(course=>course.id===cc.courseId&&course.active)));
  if(!curriculum||!db.academicTerms.length)throw Error('Synthetic curriculum/course fixtures required');
  curriculumId=curriculum.id;termId=db.academicTerms[0].id;
  courseId=db.curriculumCourses.find(cc=>cc.curriculumId===curriculum.id&&db.courses.some(c=>c.id===cc.courseId&&c.active))!.courseId;
  db.data.universities=db.universities.filter(x=>x.id!=='test-demand-univ');
  db.universities.push({id:'test-demand-univ',name:'آزمایشی',code:'DM',active:true});
  db.data.campuses=db.campuses.filter(x=>x.id!==campusKey);
  db.campuses.push({id:campusKey,universityId:'test-demand-univ',type:'INDEPENDENT_UNIT',name:'واحد آزمایشی',code:'DM',active:true});
  db.data.curricula=db.curricula.filter(x=>x.id!=='test-demand-curriculum');
  db.curricula.push({...curriculum,id:'test-demand-curriculum',universityId:'test-demand-univ',campusId:campusKey});
  db.data.curriculumCourses=db.curriculumCourses.filter(x=>x.curriculumId!=='test-demand-curriculum');
  db.curriculumCourses.push({
    id:'test-demand-cc',curriculumId:'test-demand-curriculum',courseId,
    classification:'MAJOR_REQUIRED',suggestedSemester:3,active:true,
  });
  const admin:User={id:userIds[0],name:'مدیر آزمایش',mobile:'09120000101',roles:['admin'],
    permissions:['demand.manage','demand.export'],
    demandScopes:[{campusId:campusKey,degreeLevelId:curriculum.degreeLevelId,majorId:curriculum.majorId}],
    createdAt:new Date().toISOString()};
  const student:User={id:userIds[1],name:'دانشجوی آزمایش',mobile:'09120000102',
    roles:['student'],createdAt:new Date().toISOString()};
  const outsider:User={id:userIds[2],name:'مدیر غیرمرتبط',mobile:'09120000103',
    roles:['admin'],permissions:['admin.panel.access'],createdAt:new Date().toISOString()};
  db.data.users=db.users.filter(u=>!userIds.includes(u.id));
  db.users.push(admin,student,outsider);
  const profile:StudentAcademicProfile={
    userId:student.id,universityId:'test-demand-univ',campusId:campusKey,
    degreeLevelId:curriculum.degreeLevelId,majorId:curriculum.majorId,
    entryYearId:curriculum.entryYearId,isTrackSelected:false,desiredTrackIds:[],
    updatedAt:new Date().toISOString(),
  };
  db.data.studentProfiles=db.studentProfiles.filter(x=>x.userId!==student.id);
  db.studentProfiles.push(profile);
  auth={manager:'Bearer '+generateToken(admin),student:'Bearer '+generateToken(student),
    outsider:'Bearer '+generateToken(outsider)};
});
afterAll(()=>{
  const ids=new Set(createdSurveyIds);
  db.data.demandSurveys=db.demandSurveys.filter(s=>!ids.has(s.id));
  db.data.demandResponses=db.demandResponses.filter(r=>!ids.has(r.surveyId));
  db.data.users=db.users.filter(u=>!userIds.includes(u.id));
  db.data.studentProfiles=db.studentProfiles.filter(p=>p.userId!==userIds[1]);
  db.data.universities=db.universities.filter(x=>x.id!=='test-demand-univ');
  db.data.campuses=db.campuses.filter(x=>x.id!==campusKey);
  db.data.curricula=db.curricula.filter(x=>x.id!=='test-demand-curriculum');
  db.data.curriculumCourses=db.curriculumCourses.filter(x=>x.id!=='test-demand-cc');
  db.data.auditLogs=db.auditLogs.filter(x=>!ids.has(x.entityId));
  db.save();
});

describe('department course-demand workflow',()=>{
  let id='';
  it('creates a draft only with scoped demand.manage permission and valid chart courses',async()=>{
    const curr=db.curricula.find(c=>c.id==='test-demand-curriculum')!;
    const payload={
      title:'نیازسنجی نمونه برق',description:'مخصوص تست',targetTermId:termId,
      universityId:'test-demand-univ',campusId:campusKey,degreeLevelId:curr.degreeLevelId,
      majorId:curr.majorId,curriculumId:curr.id,entryYearIds:[curr.entryYearId],
      trackIds:[],courseIds:[courseId],recommendedMinimumByCourse:{[courseId]:2},
    };
    const outsider=await request(app).post('/api/demand/surveys').set('Authorization',auth.outsider).send(payload);
    expect(outsider.status).toBe(403);
    const badCourse=await request(app).post('/api/demand/surveys').set('Authorization',auth.manager)
      .send({...payload,courseIds:['not-in-chart']});
    expect(badCourse.status).toBe(400);
    const created=await request(app).post('/api/demand/surveys').set('Authorization',auth.manager).send(payload);
    expect(created.status).toBe(201);id=created.body.data.id;createdSurveyIds.push(id);
    expect(created.body.data.status).toBe('DRAFT');
  });
  it('rejects a cohort identifier that belongs to a different entry-year chart', async () => {
    const chart = db.curricula.find(c => c.id === 'test-demand-curriculum')!;
    const anotherYear = db.entryYears.find(y => y.id !== chart.entryYearId);
    if (!anotherYear) throw new Error('Secondary entry-year test fixture required');
    const requestBody = {
      title: 'نیازسنجی ورودی اشتباه', description: 'تست تفکیک قطعی ورودی',
      targetTermId: termId, universityId: 'test-demand-univ', campusId: campusKey,
      degreeLevelId: chart.degreeLevelId, majorId: chart.majorId,
      curriculumId: chart.id, entryYearIds: [anotherYear.id], trackIds: [],
      courseIds: [courseId], recommendedMinimumByCourse: { [courseId]: 2 },
    };
    const wrongYear = await request(app).post('/api/demand/surveys')
      .set('Authorization', auth.manager).send(requestBody);
    expect(wrongYear.status).toBe(400);
    const mixedYears = await request(app).post('/api/demand/surveys')
      .set('Authorization', auth.manager)
      .send({ ...requestBody, entryYearIds: [chart.entryYearId, anotherYear.id] });
    expect(mixedYears.status).toBe(400);
    expect(db.demandSurveys.filter(s => s.title === requestBody.title)).toHaveLength(0);
  });
  it('keeps drafts private and only accepts responses after manager opens survey',async()=>{
    const studentList=await request(app).get('/api/demand/surveys').set('Authorization',auth.student);
    expect(studentList.body.data.some((s:{id:string})=>s.id===id)).toBe(false);
    const forbidden=await request(app).put(`/api/demand/surveys/${id}/response`).set('Authorization',auth.student)
      .send({studentNumber:'1403123456',anticipatedGraduation:'YES',courseIds:[courseId]});
    expect(forbidden.status).toBe(409);
    const opened=await request(app).put(`/api/demand/surveys/${id}/status`).set('Authorization',auth.manager).send({status:'OPEN'});
    expect(opened.status).toBe(200);
    const list=await request(app).get('/api/demand/surveys').set('Authorization',auth.student);
    expect(list.body.data.some((s:{id:string})=>s.id===id)).toBe(true);
  });
  it('does not expose an otherwise valid survey to students from a different entrance year', async () => {
    const profile = db.studentProfiles.find(p => p.userId === userIds[1])!;
    const originalYear = profile.entryYearId;
    const otherYear = db.entryYears.find(y => y.id !== originalYear);
    if (!otherYear) throw new Error('Secondary entry-year fixture required');
    try {
      profile.entryYearId = otherYear.id;
      const hidden = await request(app).get('/api/demand/surveys').set('Authorization', auth.student);
      expect(hidden.status).toBe(200);
      expect(hidden.body.data.some((s:{ id:string }) => s.id === id)).toBe(false);
      const crossCohort = await request(app).put(`/api/demand/surveys/${id}/response`)
        .set('Authorization', auth.student)
        .send({ studentNumber: '1402123456', anticipatedGraduation: 'UNKNOWN', courseIds:[courseId] });
      expect(crossCohort.status).toBe(404);
    } finally { profile.entryYearId = originalYear; }
  });
  it('replaces one response on repeat, rejects arbitrary course ID and keeps identity server-side',async()=>{
    const endpoint=`/api/demand/surveys/${id}/response`;
    const bad=await request(app).put(endpoint).set('Authorization',auth.student)
      .send({studentNumber:'1403123456',anticipatedGraduation:'NO',courseIds:['not-in-survey']});
    expect(bad.status).toBe(400);
    const first=await request(app).put(endpoint).set('Authorization',auth.student)
      .send({studentNumber:'1403123456',anticipatedGraduation:'YES',courseIds:[courseId]});
    expect(first.status).toBe(200);
    const second=await request(app).put(endpoint).set('Authorization',auth.student)
      .send({studentNumber:'1403123456',anticipatedGraduation:'NO',courseIds:[],userId:'forged-other'});
    expect(second.status).toBe(400);
    const validEdit=await request(app).put(endpoint).set('Authorization',auth.student)
      .send({studentNumber:'1403123456',anticipatedGraduation:'NO',courseIds:[courseId]});
    expect(validEdit.status).toBe(200);
    expect(validEdit.body.data.id).toBe(first.body.data.id);
    expect(db.demandResponses.filter(r=>r.surveyId===id&&r.userId===userIds[1])).toHaveLength(1);
    expect(db.studentProfiles.find(p=>p.userId===userIds[1])?.studentNumber).toBe('1403123456');
  });
  it('restricts reports and identity-export even for unrelated administrators',async()=>{
    const denied=await request(app).get(`/api/demand/surveys/${id}/report`).set('Authorization',auth.student);
    expect(denied.status).toBe(403);
    const deniedAdmin=await request(app).get(`/api/demand/surveys/${id}/export.csv?format=json`).set('Authorization',auth.outsider);
    expect(deniedAdmin.status).toBe(403);
    const report=await request(app).get(`/api/demand/surveys/${id}/report`).set('Authorization',auth.manager);
    expect(report.body.data.participantCount).toBe(1);
    expect(report.body.data.byCourse[0].count).toBe(1);
    const csv=await request(app).get(`/api/demand/surveys/${id}/export.csv?format=json`).set('Authorization',auth.manager);
    expect(csv.status).toBe(200);
    expect(csv.body.data.csv).toContain('1403123456');
    expect(db.auditLogs.some(x=>x.entityId===id&&x.action==='DEMAND_PERSONAL_REPORT_EXPORTED')).toBe(true);
  });
  it('rejects editing once the manager closes the survey, without losing history',async()=>{
    const closed=await request(app).put(`/api/demand/surveys/${id}/status`).set('Authorization',auth.manager).send({status:'CLOSED'});
    expect(closed.status).toBe(200);
    const edit=await request(app).put(`/api/demand/surveys/${id}/response`).set('Authorization',auth.student)
      .send({studentNumber:'1403123456',anticipatedGraduation:'YES',courseIds:[courseId]});
    expect(edit.status).toBe(409);
    expect(db.demandResponses.find(r=>r.surveyId===id)?.anticipatedGraduation).toBe('NO');
  });
});
