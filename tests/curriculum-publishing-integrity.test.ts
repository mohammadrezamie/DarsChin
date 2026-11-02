import { beforeAll,beforeEach,afterEach,describe,expect,it,vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db,type DatabaseSchema } from '../server/db/database';
import { curriculumRouter } from '../server/routes/curriculum';
import { generateToken } from '../server/middleware/auth';
import type { User } from '../src/types';

const app=express();app.use(express.json());app.use('/api/curriculum',curriculumRouter);
let original:DatabaseSchema,auth='';
const draftId='synthetic-chart-publishing-1405';
let sourceId='',linkId='';
beforeAll(async()=>{await db.init(true);});
beforeEach(()=>{
  original=db.data;
  db.data=structuredClone(original);
  const active=db.curricula.find(c=>c.status==='active');
  if(!active)throw Error('Missing seeded active chart');
  sourceId=active.id;
  const link=db.curriculumCourses.find(cc=>cc.curriculumId===active.id);
  if(!link)throw Error('Missing seeded curriculum course');
  const draft={...active,id:draftId,version:'synthetic-release-v77',status:'draft' as const};
  db.curricula.push(draft);
  linkId='synthetic-link-publish-test';
  const u:User={id:'synthetic-publisher',mobile:'09910006987',name:'مدیر آزمایشی',
    roles:['admin'],permissions:['curriculum.manage'],createdAt:new Date().toISOString()};
  db.users.push(u);
  auth='Bearer '+generateToken(u);
});
afterEach(()=>{vi.restoreAllMocks();db.data=original;});
const put=(data:object)=>request(app).put('/api/curriculum/'+draftId).set('Authorization',auth).send(data);
const attach=()=>{
  const link=db.curriculumCourses.find(cc=>cc.curriculumId===sourceId)!;
  db.curriculumCourses.push({...link,id:linkId,curriculumId:draftId});
};
describe('انتشار معتبر چارت رشته / مقطع / ورودی',()=>{
  it('ایجاد مستقیم چارت فعال بدون پیش‌نویس و بررسی درس‌ها را رد می‌کند',async()=>{
    const draft=db.curricula.find(c=>c.id===draftId)!;
    const response=await request(app).post('/api/curriculum').set('Authorization',auth).send({
      universityId:draft.universityId,campusId:draft.campusId,degreeLevelId:draft.degreeLevelId,
      majorId:draft.majorId,entryYearId:draft.entryYearId,version:'bypass-publication-1',
      name:'چارت بدون مرحله انتشار',status:'active',
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('پیش‌نویس');
    expect(db.curricula.some(c=>c.version==='bypass-publication-1')).toBe(false);
  });
  it('چارت خالی را منتشر نمی‌کند',async()=>{
    const r=await put({status:'active'});
    expect(r.status).toBe(400);
    expect(db.curricula.find(c=>c.id===draftId)?.status).toBe('draft');
  });
  it('حتی با یک درس، دو چارت فعال در یک حوزه ایجاد نمی‌کند',async()=>{
    attach();
    const r=await put({status:'active'});
    expect(r.status).toBe(409);
    expect(db.curricula.find(c=>c.id===draftId)?.status).toBe('draft');
  });
  it('پس از رفع تداخل حوزه، چارت دارای درس را منتشر می‌کند',async()=>{
    attach();
    db.curricula.find(c=>c.id===sourceId)!.status='archived';
    const r=await put({status:'active'});
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('active');
    expect(db.curricula.find(c=>c.id===draftId)?.status).toBe('active');
  });
  it('وضعیت نامعتبر یا شکست ذخیره را بدون فساد اطلاعات رد می‌کند',async()=>{
    expect((await put({status:'invalid'})).status).toBe(400);
    const before=structuredClone(db.curricula.find(c=>c.id===draftId));
    const spy=vi.spyOn(db,'save').mockImplementationOnce(()=>{throw Error('synthetic file error')});
    const response=await put({name:'عنوان جدید'});
    spy.mockRestore();
    expect(response.status).toBe(503);
    expect(db.curricula.find(c=>c.id===draftId)).toEqual(before);
    expect(JSON.stringify(response.body)).not.toContain('synthetic file error');
  });
});
