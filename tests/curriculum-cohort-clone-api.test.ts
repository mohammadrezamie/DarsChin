import {beforeAll,beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import {db,type DatabaseSchema} from '../server/db/database';
import {curriculumRouter} from '../server/routes/curriculum';
import {generateToken} from '../server/middleware/auth';
import type {AcademicRule,Curriculum,CurriculumCourse,EntryYear,User} from '../src/types';

const app=express();app.use(express.json());app.use('/api/curriculum',curriculumRouter);
let backup:DatabaseSchema,adminToken='',studentToken='';
const sourceId='test-clone-source-chart',newYear='test-clone-year-1405',targetName='چارت مستقل ورودی آزمایشی';
let c1='',c2='';
beforeAll(async()=>{await db.init(true);});
beforeEach(()=>{
  backup=db.data;
  db.data=structuredClone(backup);
  const campus=db.campuses.find(c=>c.active)!;
  const major=db.majors.find(m=>m.active&&db.degreeLevels.some(d=>d.id===m.degreeLevelId&&d.active))!;
  const sourceYear=db.entryYears.find(e=>e.active)!;
  const courses=db.courses.filter(c=>c.active);
  if(!campus||!major||!sourceYear||courses.length<2)throw Error('Synthetic seed missing academic fixtures');
  c1=courses[0].id;c2=courses[1].id;
  if(!db.universities.some(u=>u.id===campus.universityId))
    db.universities.push({id:campus.universityId,name:'دانشگاه آزمایش مستقل',code:'TEST-CLONE',active:true});
  const chart:Curriculum={id:sourceId,universityId:campus.universityId,campusId:campus.id,
    degreeLevelId:major.degreeLevelId,majorId:major.id,entryYearId:sourceYear.id,
    version:'source-1',name:'چارت مرجع ایزوله',status:'active',createdAt:new Date().toISOString()};
  const year:EntryYear={id:newYear,year:1405,active:true};
  db.entryYears.push(year);db.curricula.push(chart);
  const cc=(courseId:string,semester:number):CurriculumCourse=>({
    id:'fixture-cc-'+courseId,curriculumId:sourceId,courseId,
    trackId:null,classification:'MAJOR_REQUIRED',suggestedSemester:semester,active:true,
  });
  db.curriculumCourses.push(cc(c1,1),cc(c2,2));
  const rule:AcademicRule={id:'fixture-clone-prereq',curriculumId:sourceId,targetCourseId:c2,
    relationshipType:'PREREQUISITE',entryYearId:sourceYear.id,majorId:major.id,
    expression:{type:'COURSE',courseId:c1}};
  db.academicRules.push(rule);
  const now=new Date().toISOString();
  const admin:User={id:'test-clone-admin',mobile:'09950004011',name:'مدیر آزمایشی',
    roles:['admin'],permissions:['curriculum.manage'],createdAt:now};
  const student:User={id:'test-clone-student',mobile:'09950004012',name:'دانشجوی آزمایشی',
    roles:['student'],createdAt:now};
  db.users.push(admin,student);
  adminToken='Bearer '+generateToken(admin);studentToken='Bearer '+generateToken(student);
});
afterEach(()=>{vi.restoreAllMocks();db.data=backup;});
const clone=(body:object,token=adminToken)=>request(app).post('/api/curriculum/'+sourceId+'/clone')
  .set('Authorization',token).send(body);
const valid=()=>({entryYearId:newYear,name:targetName,version:'cohort-1405-v1',copyRules:true});
describe('کپی عملیاتی چارت مستقل برای ورودی تازه',()=>{
  it('درس‌ها و زنجیرهٔ پیش‌نیاز را با شناسه‌های تازه و سال ورود مقصد کپی می‌کند',async()=>{
    const answer=await clone(valid());
    expect(answer.status).toBe(201);
    const result=answer.body.data;
    expect(result.curriculum.status).toBe('draft');
    expect(result.curriculum.entryYearId).toBe(newYear);
    expect(result.copiedCourses).toBe(2);
    expect(result.copiedRules).toBe(1);
    const copied=db.curriculumCourses.filter(c=>c.curriculumId===result.curriculum.id);
    expect(copied.map(c=>c.courseId)).toEqual([c1,c2]);
    expect(copied.map(c=>c.suggestedSemester)).toEqual([1,2]);
    expect(copied.every(c=>!c.id.startsWith('fixture-cc'))).toBe(true);
    const rules=db.academicRules.filter(r=>r.curriculumId===result.curriculum.id);
    expect(rules).toHaveLength(1);
    expect(rules[0].entryYearId).toBe(newYear);
    expect(rules[0].expression).toEqual({type:'COURSE',courseId:c1});
    expect(db.academicRules.find(r=>r.id==='fixture-clone-prereq')?.entryYearId).not.toBe(newYear);
    expect(db.demandSurveys.some(s=>s.curriculumId===result.curriculum.id)).toBe(false);
    expect(db.demandResponses.some(r=>r.surveyId===result.curriculum.id)).toBe(false);
  });
  it('کپی فقط دروس را برای چارت نیازمند تدوین مجدد پیش‌نیاز پشتیبانی می‌کند',async()=>{
    const answer=await clone({...valid(),version:'courses-only-1405',copyRules:false});
    expect(answer.status).toBe(201);
    expect(answer.body.data.copiedRules).toBe(0);
    expect(db.academicRules.some(r=>r.curriculumId===answer.body.data.curriculum.id)).toBe(false);
  });
  it('اجازه ورود مقصدِ همان ورودی، نسخه تکراری یا شناسه نامعتبر را نمی‌دهد',async()=>{
    const original=db.curricula.find(c=>c.id===sourceId)!;
    expect((await clone({...valid(),entryYearId:original.entryYearId})).status).toBe(400);
    expect((await clone({...valid(),entryYearId:'bad-year'})).status).toBe(400);
    expect((await clone({...valid(),version:'   '})).status).toBe(400);
    expect((await clone({...valid(),status:'active'})).status).toBe(400);
    const first=await clone(valid());expect(first.status).toBe(201);
    expect((await clone(valid())).status).toBe(409);
    expect(db.curricula.filter(c=>c.entryYearId===newYear&&c.version==='cohort-1405-v1')).toHaveLength(1);
  });
  it('دانشجو نمی‌تواند چارت را کپی کند',async()=>{
    expect((await clone(valid(),studentToken)).status).toBe(403);
  });
  it('قانون ناسازگار با مبدأ را کپی نمی‌کند',async()=>{
    db.academicRules.find(r=>r.id==='fixture-clone-prereq')!.entryYearId=newYear;
    expect((await clone(valid())).status).toBe(409);
    expect((await clone({...valid(),copyRules:false})).status).toBe(201);
  });
  it('در خطای ذخیره، چارت، درس‌ها، قوانین و لاگ جدید باقی نمی‌مانند',async()=>{
    const count={
      charts:db.curricula.length,courses:db.curriculumCourses.length,
      rules:db.academicRules.length,audit:db.auditLogs.length,
    };
    vi.spyOn(db,'save').mockImplementationOnce(()=>{throw Error('synthetic-disk-failure');});
    const answer=await clone(valid());
    expect(answer.status).toBe(503);
    expect(db.curricula).toHaveLength(count.charts);
    expect(db.curriculumCourses).toHaveLength(count.courses);
    expect(db.academicRules).toHaveLength(count.rules);
    expect(db.auditLogs).toHaveLength(count.audit);
    expect(JSON.stringify(answer.body)).not.toContain('synthetic-disk-failure');
  });
});
