import {beforeAll,beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import {db,type DatabaseSchema} from '../server/db/database';
import {curriculumRouter} from '../server/routes/curriculum';
import {generateToken} from '../server/middleware/auth';
import type {User,Track} from '../src/types';

const app=express();app.use(express.json());app.use('/api/curriculum',curriculumRouter);
let backup:DatabaseSchema,admin='',student='',a='',b='';
const chartId='study-plan-fixture',trackId='study-plan-track';
const url='/api/curriculum/'+chartId+'/study-plan-draft';
beforeAll(async()=>{await db.init(true);});
beforeEach(()=>{
 backup=db.data;db.data=structuredClone(backup);
 const chart=db.curricula[0];const courses=db.courses.filter(c=>c.active);
 a=courses[0].id;b=courses[1].id;
 db.curricula.push({...chart,id:chartId,status:'draft',version:'study-plan-fixture'});
 db.tracks.push({id:trackId,majorId:chart.majorId,name:'گرایش آزمایشی',code:'SP',active:true} as Track);
 db.curriculumCourses.push({id:'sp-common',curriculumId:chartId,courseId:a,classification:'MAJOR_REQUIRED',suggestedSemester:1,active:true},
 {id:'sp-track',curriculumId:chartId,courseId:b,trackId,classification:'TRACK_REQUIRED',suggestedSemester:2,active:true});
 db.data.studyPlanDrafts=[];
 const user=(id:string,roles:User['roles'],permissions:User['permissions']):User=>({id,mobile:id==='sp-admin'?'09990000301':'09990000302',name:'آزمایشی',roles,permissions,createdAt:new Date().toISOString()});
 const u=user('sp-admin',['admin'],['curriculum.manage']),s=user('sp-student',['student'],[]);
 db.users.push(u,s);admin='Bearer '+generateToken(u);student='Bearer '+generateToken(s);
});
afterEach(()=>{vi.restoreAllMocks();db.data=backup;});
const payload=(scope:string|null=null,courseId=a)=>({trackId:scope,plan:{curriculumId:chartId,periods:[{id:'p',label:'تابستان',kind:'summer'}],items:[{id:'i',kind:'course',courseId,periodId:'p'}]}});
const put=(body:object,token=admin)=>request(app).put(url).set('Authorization',token).send(body);
describe('برنامهٔ پیشنهادی مستقل و اختیاری',()=>{
 it('returns absent and stores a partial plan without changing assignments or rules',async()=>{
  const before=structuredClone(db.curriculumCourses),rules=structuredClone(db.academicRules);
  expect((await request(app).get(url).set('Authorization',admin)).body.data.validation.status).toBe('absent');
  const body=payload(trackId,b);expect((await put(body)).status).toBe(200);
  const got=await request(app).get(url).query({trackId}).set('Authorization',admin);
  expect(got.body.data.plan).toEqual(body.plan);
  expect(got.body.data.validation.unplannedCourseIds).toEqual([a]);
  expect(db.curriculumCourses).toEqual(before);expect(db.academicRules).toEqual(rules);
  expect((await request(app).get(url).set('Authorization',admin)).body.data.plan).toBeNull();
 });
 it('rejects other tracks, invalid course, unknown pool and mismatched chart',async()=>{
  expect((await put(payload(null,b))).status).toBe(400);
  expect((await put(payload('foreign',a))).status).toBe(404);
  expect((await put({...payload(),plan:{...payload().plan,curriculumId:'foreign'}})).status).toBe(400);
  expect((await put({...payload(),plan:{...payload().plan,items:[{id:'i',kind:'choice',poolId:'fake',periodId:'p',label:'اختیاری'}]}})).status).toBe(400);
  expect(db.data.studyPlanDrafts).toEqual([]);
 });
 it('protects the draft from student access and supports explicit removal',async()=>{
  expect((await put(payload(),student)).status).toBe(403);
  expect((await request(app).get(url).set('Authorization',student)).status).toBe(403);
  expect((await put(payload())).status).toBe(200);
  expect((await put({trackId:null,plan:null})).body.data.validation.status).toBe('absent');
  expect(db.data.studyPlanDrafts).toEqual([]);
 });
 it('rolls back failed writes without revealing disk errors',async()=>{
  const initial=payload();expect((await put(initial)).status).toBe(200);
  vi.spyOn(db,'save').mockImplementationOnce(()=>{throw Error('synthetic-secret-path');});
  const response=await put({trackId:null,plan:null});
  expect(response.status).toBe(503);expect(JSON.stringify(response.body)).not.toContain('synthetic-secret-path');
  expect(db.data.studyPlanDrafts?.[0].plan).toEqual(initial.plan);
 });
 it('prevents deleting a referenced assignment or chart until the draft is resolved',async()=>{
  expect((await put(payload())).status).toBe(200);
  expect((await request(app).delete('/api/curriculum/'+chartId+'/courses/'+a).set('Authorization',admin)).status).toBe(409);
  expect((await request(app).delete('/api/curriculum/'+chartId).set('Authorization',admin)).status).toBe(409);
 });
});
