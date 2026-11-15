import {beforeAll,beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import {db,type DatabaseSchema} from '../server/db/database';
import {demandRouter} from '../server/routes/demand';
import {generateToken} from '../server/middleware/auth';
import type {User,StudentAcademicProfile,Curriculum,CurriculumCourse,DemandFormQuestion} from '../src/types';

const app=express();app.use(express.json());app.use('/api/demand',demandRouter);
let original:DatabaseSchema;
let manager='',withExport='',outsider='',student='';
let chart!:Curriculum,termId='',courseId='';
const questions:DemandFormQuestion[]=[
  {id:'preferredTime',kind:'single_choice',title:'ساعت پیشنهادی',required:true,options:['صبح','عصر']},
  {id:'days',kind:'multiple_choice',title:'روزهای مناسب',required:false,options:['شنبه','دوشنبه']},
  {id:'description',kind:'long_text',title:'توضیحات اضافی',required:false},
];
const now='2026-11-01T12:00:00.000Z';
beforeAll(async()=>{await db.init(true);});
beforeEach(()=>{
  original=db.data;
  db.data=structuredClone(original);
  const campus=db.campuses.find(x=>x.active);
  const major=db.majors.find(x=>x.active&&db.degreeLevels.some(d=>d.id===x.degreeLevelId&&d.active));
  const year=db.entryYears.find(x=>x.active);
  const course=db.courses.find(x=>x.active);
  const term=db.academicTerms.find(x=>x.active)||db.academicTerms[0];
  if(!campus||!major||!year||!course||!term)throw Error('Synthetic academic fixtures required');
  courseId=course.id;termId=term.id;
  if(!db.universities.some(x=>x.id===campus.universityId))
    db.universities.push({id:campus.universityId,name:'دانشگاه آزمایشی',code:'FORMTEST',active:true});
  chart={id:'synthetic-form-chart',name:'چارت مصنوعی فرم‌ساز',version:'v1',
    universityId:campus.universityId,campusId:campus.id,degreeLevelId:major.degreeLevelId,
    majorId:major.id,entryYearId:year.id,status:'active',createdAt:now};
  db.curricula.push(chart);
  const assignment:CurriculumCourse={id:'synthetic-form-assignment',
    curriculumId:chart.id,courseId,classification:'MAJOR_REQUIRED',
    suggestedSemester:2,trackId:null,active:true};
  db.curriculumCourses.push(assignment);
  const scope={campusId:campus.id,degreeLevelId:major.degreeLevelId,majorId:major.id};
  const users:User[]=[
    {id:'form-manager',name:'مدیر آزمایش',mobile:'09980007401',roles:['admin'],
      permissions:['demand.manage'],demandScopes:[scope],createdAt:now},
    {id:'form-privacy-manager',name:'مدیر دارای دسترسی خصوصی',mobile:'09980007402',roles:['admin'],
      permissions:['demand.manage','demand.export'],demandScopes:[scope],createdAt:now},
    {id:'form-other-manager',name:'مدیر غیرمرتبط',mobile:'09980007403',roles:['admin'],
      permissions:['demand.manage','demand.export'],
      demandScopes:[{...scope,campusId:'wrong-campus'}],createdAt:now},
    {id:'form-student',name:'دانشجوی ساختگی',mobile:'09980007404',roles:['student'],createdAt:now},
  ];
  db.users.push(...users);
  const profile:StudentAcademicProfile={userId:'form-student',universityId:chart.universityId,
    campusId:chart.campusId,degreeLevelId:chart.degreeLevelId,majorId:chart.majorId,
    entryYearId:chart.entryYearId,isTrackSelected:false,desiredTrackIds:[],updatedAt:now};
  db.studentProfiles.push(profile);
  manager='Bearer '+generateToken(users[0]);
  withExport='Bearer '+generateToken(users[1]);
  outsider='Bearer '+generateToken(users[2]);
  student='Bearer '+generateToken(users[3]);
});
afterEach(()=>{vi.restoreAllMocks();db.data=original;});
const payload=()=>({
  title:'نیازسنجی رسمی نمونه برای ورودی',description:'سؤال‌های تکمیلی درس',
  targetTermId:termId,universityId:chart.universityId,campusId:chart.campusId,
  degreeLevelId:chart.degreeLevelId,majorId:chart.majorId,curriculumId:chart.id,
  entryYearIds:[chart.entryYearId],trackIds:[],courseIds:[courseId],
  recommendedMinimumByCourse:{[courseId]:3},questions,
});
const create=(body=payload())=>request(app).post('/api/demand/surveys')
  .set('Authorization',manager).send(body);
const draft=(id:string,body:object)=>request(app).put('/api/demand/surveys/'+id+'/draft')
  .set('Authorization',manager).send(body);
const answer=(id:string,answers:object,token=student)=>request(app)
  .put('/api/demand/surveys/'+id+'/response').set('Authorization',token)
  .send({studentNumber:'1405123456',anticipatedGraduation:'NO',courseIds:[courseId],answers});
describe('نیازسنجی واقعی با فرم‌ساز سفارشی و حریم خصوصی',()=>{
  it('سؤال‌ها را در پیش‌نویس ذخیره و فقط برای مدیر دارای محدودهٔ مجاز قابل ویرایش می‌کند',async()=>{
    const created=await create();expect(created.status).toBe(201);
    const id=created.body.data.id;
    expect(created.body.data.questions).toEqual(questions);
    const changed={title:'فرم ویرایش‌شده برای نیازسنجی',description:'شرح جدید',questions:[
      {...questions[0],required:false},questions[1],
    ],startsAt:null,endsAt:null};
    expect((await request(app).put('/api/demand/surveys/'+id+'/draft')
      .set('Authorization',outsider).send(changed)).status).toBe(403);
    expect((await request(app).put('/api/demand/surveys/'+id+'/draft')
      .set('Authorization',student).send(changed)).status).toBe(403);
    const updated=await draft(id,changed);
    expect(updated.status).toBe(200);
    expect(updated.body.data.questions).toHaveLength(2);
    expect(updated.body.data.title).toBe(changed.title);
    expect(updated.body.data.curriculumId).toBe(chart.id);
    expect(updated.body.data.entryYearIds).toEqual([chart.entryYearId]);
    const forbidden=await draft(id,{...changed,curriculumId:'other-chart'});
    expect(forbidden.status).toBe(400);
  });
  it('سؤال ناسازگار، شناسه تکراری و خطای دیسک را بدون ثبت ناقص رد می‌کند',async()=>{
    const invalid=await create({...payload(),questions:[questions[0],questions[0]]});
    expect(invalid.status).toBe(400);
    const created=await create();const id=created.body.data.id;
    const before=structuredClone(db.demandSurveys.find(s=>s.id===id));
    expect((await draft(id,{title:'نسخه نامعتبر',description:'',
      questions:[{...questions[0],options:['صبح','صبح']}]})).status).toBe(400);
    vi.spyOn(db,'save').mockImplementationOnce(()=>{throw Error('synthetic-failure');});
    const failed=await draft(id,{title:'فرم تغییر یافته آزمایشی',description:'',
      questions,startsAt:null,endsAt:null});
    expect(failed.status).toBe(503);
    expect(db.demandSurveys.find(s=>s.id===id)).toEqual(before);
    expect(JSON.stringify(failed.body)).not.toContain('synthetic-failure');
  });
  it('دانشجو فقط گزینه‌های تعریف‌شده و پاسخ‌های اجباری را ثبت می‌کند و ویرایش بعدی جایگزین می‌شود',async()=>{
    const created=await create();const id=created.body.data.id;
    expect((await request(app).put('/api/demand/surveys/'+id+'/status')
      .set('Authorization',manager).send({status:'OPEN'})).status).toBe(200);
    expect((await draft(id,{title:'ویرایش بدون مجوز',description:'',questions})).status).toBe(409);
    expect((await answer(id,{})).status).toBe(400);
    expect((await answer(id,{preferredTime:'شب'})).status).toBe(400);
    expect((await answer(id,{preferredTime:'صبح',unexpected:'invalid'})).status).toBe(400);
    expect((await answer(id,{preferredTime:'صبح',days:['شنبه','شنبه']})).status).toBe(400);
    const first=await answer(id,{preferredTime:'صبح',days:['شنبه'],
      description:'متن خصوصی آزمایشی'});
    expect(first.status).toBe(200);
    const second=await answer(id,{preferredTime:'عصر',days:['دوشنبه']});
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.answers).toEqual({preferredTime:'عصر',days:['دوشنبه']});
    const own=await request(app).get('/api/demand/surveys/'+id+'/response')
      .set('Authorization',student);
    expect(own.body.data.answers.preferredTime).toBe('عصر');
    expect(db.demandResponses.filter(x=>x.surveyId===id)).toHaveLength(1);
    const report=await request(app).get('/api/demand/surveys/'+id+'/report')
      .set('Authorization',manager);
    expect(report.status).toBe(200);
    expect(report.body.data.byQuestion.find((q:{id:string})=>q.id==='preferredTime')
      .options).toEqual([{label:'صبح',count:0},{label:'عصر',count:1}]);
    expect(JSON.stringify(report.body)).not.toContain('متن خصوصی آزمایشی');
  });
  it('متن‌های خصوصی فقط برای مدیر دارای demand.export و با audit صادر می‌شوند',async()=>{
    const created=await create();const id=created.body.data.id;
    await request(app).put('/api/demand/surveys/'+id+'/status')
      .set('Authorization',manager).send({status:'OPEN'});
    await answer(id,{preferredTime:'صبح',description:'توضیح شخصی ساختگی'});
    expect((await request(app).get('/api/demand/surveys/'+id+'/answers.csv?format=json')
      .set('Authorization',manager)).status).toBe(403);
    expect((await request(app).get('/api/demand/surveys/'+id+'/answers.csv?format=json')
      .set('Authorization',outsider)).status).toBe(403);
    const privateCsv=await request(app).get('/api/demand/surveys/'+id+'/answers.csv?format=json')
      .set('Authorization',withExport);
    expect(privateCsv.status).toBe(200);
    expect(privateCsv.body.data.csv).toContain('توضیح شخصی ساختگی');
    expect(privateCsv.body.data.csv).toContain('1405123456');
    expect(db.auditLogs.some(log=>log.entityId===id&&log.action==='DEMAND_PRIVATE_ANSWERS_EXPORTED')).toBe(true);
    const publicStats=await request(app).get('/api/demand/surveys/'+id+'/summary.csv?format=json')
      .set('Authorization',manager);
    expect(publicStats.status).toBe(200);
    expect(JSON.stringify(publicStats.body)).not.toContain('توضیح شخصی ساختگی');
  });
  it('بازشدن پیش از بازهٔ آینده، امکان پاسخ و مشاهدهٔ فرم را فعال نمی‌کند',async()=>{
    const start=new Date(Date.now()+60*60*1000).toISOString();
    const end=new Date(Date.now()+2*60*60*1000).toISOString();
    const created=await create({...payload(),startsAt:start,endsAt:end});
    expect(created.status).toBe(201);const id=created.body.data.id;
    await request(app).put('/api/demand/surveys/'+id+'/status')
      .set('Authorization',manager).send({status:'OPEN'});
    const list=await request(app).get('/api/demand/surveys').set('Authorization',student);
    expect(list.body.data.some((s:{id:string})=>s.id===id)).toBe(false);
    expect((await answer(id,{preferredTime:'صبح'})).status).toBe(409);
  });
  it('فرم قدیمی بدون سؤال سفارشی همچنان پاسخ می‌پذیرد',async()=>{
    const form={...payload()};delete (form as {questions?:unknown}).questions;
    const created=await create(form as ReturnType<typeof payload>);
    expect(created.status).toBe(201);const id=created.body.data.id;
    await request(app).put('/api/demand/surveys/'+id+'/status')
      .set('Authorization',manager).send({status:'OPEN'});
    const response=await request(app).put('/api/demand/surveys/'+id+'/response')
      .set('Authorization',student)
      .send({studentNumber:'1405123456',anticipatedGraduation:'UNKNOWN',courseIds:[courseId]});
    expect(response.status).toBe(200);
    expect(response.body.data.answers).toEqual({});
  });
});
