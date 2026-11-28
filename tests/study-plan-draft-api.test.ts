import {beforeAll,beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import {db,type DatabaseSchema} from '../server/db/database';
import {curriculumRouter} from '../server/routes/curriculum';
import {academicRouter} from '../server/routes/academic';
import {generateToken} from '../server/middleware/auth';
import type {User,Track} from '../src/types';

const app=express();app.use(express.json());app.use('/api/curriculum',curriculumRouter);app.use('/api/academic',academicRouter);
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
 const u=user('sp-admin',['admin'],['curriculum.manage','system.settings.manage','course.update','course.delete']),s=user('sp-student',['student'],[]);
 db.users.push(u,s);admin='Bearer '+generateToken(u);student='Bearer '+generateToken(s);
});
afterEach(()=>{vi.restoreAllMocks();db.data=backup;});
const payload=(scope:string|null=null,courseId=a)=>({trackId:scope,expectedRevision:null,plan:{curriculumId:chartId,periods:[{id:'p',label:'تابستان',kind:'summer'}],items:[{id:'i',kind:'course',courseId,periodId:'p'}]}});
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
  const created=await put(payload());expect(created.status).toBe(200);
  expect((await put({trackId:null,plan:null,expectedRevision:created.body.data.revision})).body.data.validation.status).toBe('absent');
  expect(db.data.studyPlanDrafts).toEqual([]);
 });
 it('rolls back failed writes without revealing disk errors',async()=>{
  const initial=payload();const created=await put(initial);expect(created.status).toBe(200);
  vi.spyOn(db,'save').mockImplementationOnce(()=>{throw Error('synthetic-secret-path');});
  const response=await put({trackId:null,plan:null,expectedRevision:created.body.data.revision});
  expect(response.status).toBe(503);expect(JSON.stringify(response.body)).not.toContain('synthetic-secret-path');
  expect(db.data.studyPlanDrafts?.[0].plan).toEqual(initial.plan);
 });
 it('prevents deleting a referenced assignment or chart until the draft is resolved',async()=>{
  expect((await put(payload())).status).toBe(200);
  expect((await request(app).delete('/api/curriculum/'+chartId+'/courses/'+a).set('Authorization',admin)).status).toBe(409);
  expect((await request(app).delete('/api/curriculum/'+chartId).set('Authorization',admin)).status).toBe(409);
 });
 it('rejects stale writes and deletion from a second editor, and requires a revision',async()=>{
  const created=await put(payload());expect(created.status).toBe(200);
  const revision=created.body.data.revision;
  expect(typeof revision).toBe('string');
  const changed={...payload(),expectedRevision:revision,plan:{...payload().plan,periods:[{id:'p',label:'نسخه تازه',kind:'regular'}]}};
  const update=await put(changed);expect(update.status).toBe(200);
  expect(update.body.data.revision).not.toBe(revision);
  expect((await put(changed)).status).toBe(409);
  expect((await put({trackId:null,plan:null,expectedRevision:revision})).status).toBe(409);
  expect((await put({trackId:null,plan:null})).status).toBe(400);
  expect((await request(app).get(url).set('Authorization',admin)).body.data.plan).toEqual(changed.plan);
  expect((await put({trackId:null,plan:null,expectedRevision:update.body.data.revision})).status).toBe(200);
 });
 it('rejects ambiguous repeated track query parameters',async()=>{
  expect((await request(app).get(url+'?trackId=a&trackId=b').set('Authorization',admin)).status).toBe(400);
 });

 it('protects a stored common-course plan for a track without any exclusive assignment',async()=>{
  db.data.curriculumCourses=db.curriculumCourses.filter(row=>row.id!=='sp-track');
  expect((await put(payload(trackId,a))).status).toBe(200);
  const response=await request(app).delete('/api/academic/tracks/'+trackId).set('Authorization',admin);
  expect(response.status).toBe(409);
  expect(db.tracks.some(t=>t.id===trackId)).toBe(true);
  expect((await request(app).get(url).query({trackId}).set('Authorization',admin)).status).toBe(200);
 });
 it('rejects deactivating a planned course and moving a chart to another cohort',async()=>{
  expect((await put(payload())).status).toBe(200);
  const before=structuredClone(db.curricula.find(c=>c.id===chartId));
  const alternate=db.entryYears.find(y=>y.active&&y.id!==before?.entryYearId);
  if(!alternate)throw Error('Missing synthetic alternate cohort');
  expect((await request(app).put('/api/academic/courses/'+a).set('Authorization',admin).send({active:false})).status).toBe(409);
  expect(db.courses.find(c=>c.id===a)?.active).toBe(true);
  expect((await request(app).put('/api/curriculum/'+chartId).set('Authorization',admin).send({entryYearId:alternate.id})).status).toBe(409);
  expect(db.curricula.find(c=>c.id===chartId)).toEqual(before);
  expect((await request(app).get(url).set('Authorization',admin)).status).toBe(200);
 });
 it('rejects repeated track parameters before deleting any assignment',async()=>{
  const before=structuredClone(db.curriculumCourses);
  expect((await request(app).delete('/api/curriculum/'+chartId+'/courses/'+a+'?trackId=x&trackId=y').set('Authorization',admin)).status).toBe(400);
  expect(db.curriculumCourses).toEqual(before);
 });
 it('rolls back failed chart, assignment creation and assignment deletion mutations',async()=>{
  const before=structuredClone({curricula:db.curricula,curriculumCourses:db.curriculumCourses,academicRules:db.academicRules});
  const fail=()=>vi.spyOn(db,'save').mockImplementationOnce(()=>{throw Error('synthetic-private-disk-path');});
  const chart='/api/curriculum/'+chartId;
  const operations=[
    ()=>request(app).post(chart+'/courses').set('Authorization',admin).send({courseId:b,classification:'MAJOR_REQUIRED',suggestedSemester:2}),
    ()=>request(app).delete(chart+'/courses/'+a).set('Authorization',admin),
    ()=>request(app).delete(chart).set('Authorization',admin),
  ];
  for(const run of operations){
    const spy=fail();try{const result=await run();expect(result.status).toBe(503);expect(JSON.stringify(result.body)).not.toContain('synthetic-private-disk-path');}finally{spy.mockRestore();}
    expect({curricula:db.curricula,curriculumCourses:db.curriculumCourses,academicRules:db.academicRules}).toEqual(before);
  }
 });

 it('rejects removal of a shared course required by a shared rule even if a track copy remains',async()=>{
  db.curriculumCourses.push({id:'sp-copy-a',curriculumId:chartId,courseId:a,trackId,classification:'TRACK_REQUIRED',suggestedSemester:2,active:true},
   {id:'sp-common-b',curriculumId:chartId,courseId:b,classification:'MAJOR_REQUIRED',suggestedSemester:2,active:true});
  db.academicRules.push({id:'sp-shared-rule',curriculumId:chartId,targetCourseId:b,relationshipType:'PREREQUISITE',expression:{type:'COURSE',courseId:a}});
  const before=structuredClone({links:db.curriculumCourses,rules:db.academicRules});
  const response=await request(app).delete('/api/curriculum/'+chartId+'/courses/'+a+'?trackId=').set('Authorization',admin);
  expect(response.status).toBe(409);
  expect({links:db.curriculumCourses,rules:db.academicRules}).toEqual(before);
 });
 it('removes only the explicitly selected shared assignment when its track copy still satisfies a scoped rule',async()=>{
  db.curriculumCourses.push({id:'sp-copy-a',curriculumId:chartId,courseId:a,trackId,classification:'TRACK_REQUIRED',suggestedSemester:2,active:true});
  db.academicRules.push({id:'sp-track-rule',curriculumId:chartId,trackId,targetCourseId:b,relationshipType:'PREREQUISITE',expression:{type:'COURSE',courseId:a}});
  const rules=structuredClone(db.academicRules);
  const response=await request(app).delete('/api/curriculum/'+chartId+'/courses/'+a+'?trackId=').set('Authorization',admin);
  expect(response.status).toBe(200);
  expect(db.curriculumCourses.some(row=>row.id==='sp-common')).toBe(false);
  expect(db.curriculumCourses.some(row=>row.id==='sp-copy-a')).toBe(true);
  expect(db.academicRules).toEqual(rules);
  expect((await request(app).delete('/api/curriculum/'+chartId+'/courses/'+a+'?trackId='+trackId).set('Authorization',admin)).status).toBe(409);
 });
 it('does not cascade-delete the last assignment of a course with a prerequisite',async()=>{
  db.academicRules.push({id:'sp-last-rule',curriculumId:chartId,trackId,targetCourseId:b,relationshipType:'COREQUISITE',expression:{type:'COURSE',courseId:a}});
  const before=structuredClone(db.academicRules);
  expect((await request(app).delete('/api/curriculum/'+chartId+'/courses/'+a).set('Authorization',admin)).status).toBe(409);
  expect(db.academicRules).toEqual(before);
  expect(db.curriculumCourses.some(row=>row.id==='sp-common')).toBe(true);
 });

});
