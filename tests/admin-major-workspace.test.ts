import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { academicRouter } from '../server/routes/academic';
import { generateToken } from '../server/middleware/auth';
import { groupAcademicMajors } from '../src/domain/admin-major-tree';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';
import type { Major, User } from '../src/types';

describe('major-first administration (synthetic fixtures only)',()=>{
  it('groups same academic field across degrees without merging database identities',()=>{
    const rows:Major[]=[
      {id:'major-undergrad',name:'مهندسی برق',degreeLevelId:'degree-be',code:'ELEC',active:true},
      {id:'major-grad',name:'مهندسي  برق',degreeLevelId:'degree-msc',code:'EE-MS',active:true},
      {id:'major-other',name:'مهندسی عمران',degreeLevelId:'degree-be',code:'CIV',active:true},
      {id:'major-archived',name:'مهندسی برق',degreeLevelId:'degree-phd',code:'PHD',active:false},
    ];
    const grouped=groupAcademicMajors(rows);
    expect(grouped).toHaveLength(2);
    const electrical=grouped.find(x=>x.label==='مهندسی برق');
    expect(electrical?.members.map(x=>x.id)).toEqual(['major-undergrad','major-grad']);
    expect(electrical?.members.every(x=>x.degreeLevelId!=='' )).toBe(true);
  });

  it('creates an isolated multi-step draft in browser demo without backend access',async()=>{
    resetBrowserDemo();
    const meta=(await browserDemoRequest<any>('/api/academic/all-meta')).data;
    expect(meta.degreeLevels.length).toBeGreaterThan(0);
    const degree=meta.degreeLevels[0];
    const campus=meta.campuses[0];
    const year=meta.entryYears[0];
    const major=await browserDemoRequest<any>('/api/academic/majors',{
      method:'POST',body:JSON.stringify({name:'رشتهٔ نمایشی جدید',degreeLevelId:degree.id}),
    });
    expect(major.success).toBe(true);
    const track=await browserDemoRequest<any>('/api/academic/tracks',{
      method:'POST',body:JSON.stringify({name:'گرایش نمایشی',majorId:major.data.id}),
    });
    expect(track.success).toBe(true);
    const base={universityId:campus.universityId,campusId:campus.id,
      degreeLevelId:degree.id,majorId:major.data.id,entryYearId:year.id,
      version:'1.0',name:'چارت نمایشی ورودی جدید',status:'draft'};
    const created=await browserDemoRequest<any>('/api/curriculum',{
      method:'POST',body:JSON.stringify(base),
    });
    expect(created.success).toBe(true);
    expect(created.data.status).toBe('draft');
    const duplicate=await browserDemoRequest('/api/curriculum',{
      method:'POST',body:JSON.stringify(base),
    });
    expect(duplicate.success).toBe(false);
    const wrongParent=await browserDemoRequest('/api/curriculum',{
      method:'POST',body:JSON.stringify({...base,majorId:'foreign-major',version:'2.0'}),
    });
    expect(wrongParent.success).toBe(false);
  });
});

const app=express();
app.use(express.json());
app.use('/api/academic',academicRouter);
let adminToken='',studentToken='';
const generatedIds:{degrees:string[];majors:string[];tracks:string[];campuses:string[]}={
  degrees:[],majors:[],tracks:[],campuses:[],
};
const userIds=['major-admin-demo-test','major-guest-demo-test'];

beforeAll(async()=>{
  await db.init(true);
  const admin:User={id:userIds[0],name:'مدیر آزمایشی',mobile:'09120000641',
    roles:['admin'],permissions:['system.settings.manage'],
    createdAt:new Date().toISOString()};
  const guest:User={id:userIds[1],name:'کاربر آزمایشی',mobile:'09120000642',
    roles:['student'],createdAt:new Date().toISOString()};
  db.users.push(admin,guest);
  adminToken='Bearer '+generateToken(admin);
  studentToken='Bearer '+generateToken(guest);
});
afterAll(()=>{
  db.data.tracks=db.tracks.filter(t=>!generatedIds.tracks.includes(t.id));
  db.data.majors=db.majors.filter(m=>!generatedIds.majors.includes(m.id));
  db.data.degreeLevels=db.degreeLevels.filter(d=>!generatedIds.degrees.includes(d.id));
  db.data.campuses=db.campuses.filter(c=>!generatedIds.campuses.includes(c.id));
  db.data.users=db.users.filter(u=>!userIds.includes(u.id));
  db.save();
});

describe('named academic creation API preserves references and permissions',()=>{
  it('creates degree/major/track from names without any technical ID typed by the administrator',async()=>{
    const noAuth=await request(app).post('/api/academic/degrees')
      .set('Authorization',studentToken).send({name:'مقطع نمایشی بدون مجوز'});
    expect(noAuth.status).toBe(403);
    const degree=await request(app).post('/api/academic/degrees')
      .set('Authorization',adminToken).send({name:'مقطع تست سادهٔ مدیر'});
    expect(degree.status).toBe(200);
    generatedIds.degrees.push(degree.body.data.id);
    expect(degree.body.data.code).toMatch(/^INTERNAL-/);
    const duplicateDegree=await request(app).post('/api/academic/degrees')
      .set('Authorization',adminToken).send({name:'مقطع تست سادهٔ مدیر'});
    expect(duplicateDegree.status).toBe(409);

    const major=await request(app).post('/api/academic/majors')
      .set('Authorization',adminToken).send({
        degreeLevelId:degree.body.data.id,name:'رشتهٔ جدید بدون شناسه',
      });
    expect(major.status).toBe(200);
    generatedIds.majors.push(major.body.data.id);
    expect(major.body.data.code).toMatch(/^INTERNAL-/);
    expect(major.body.data.degreeLevelId).toBe(degree.body.data.id);
    const invalid=await request(app).post('/api/academic/majors')
      .set('Authorization',adminToken).send({
        degreeLevelId:'missing-degree',name:'رشتهٔ نادرست',
      });
    expect(invalid.status).toBe(400);
    const duplicateMajor=await request(app).post('/api/academic/majors')
      .set('Authorization',adminToken).send({
        degreeLevelId:degree.body.data.id,name:'رشتهٔ جدید بدون شناسه',
      });
    expect(duplicateMajor.status).toBe(409);

    const track=await request(app).post('/api/academic/tracks')
      .set('Authorization',adminToken).send({
        majorId:major.body.data.id,name:'گرایش نمونه',
      });
    expect(track.status).toBe(200);
    generatedIds.tracks.push(track.body.data.id);
    expect(track.body.data.code).toMatch(/^INTERNAL-/);
    const repeated=await request(app).post('/api/academic/tracks')
      .set('Authorization',adminToken).send({
        majorId:major.body.data.id,name:'گرایش نمونه',
      });
    expect(repeated.status).toBe(409);
  });
  it('rejects campus cross-university and duplicate entry-year records',async()=>{
    const campus=db.campuses.find(c=>c.active && db.universities.some(u=>u.id===c.universityId&&u.active));
    expect(campus).toBeDefined();
    const invalid=await request(app).post('/api/academic/campuses')
      .set('Authorization',adminToken).send({
        universityId:'missing-university',name:'واحد بی‌دانشگاه',
      });
    expect(invalid.status).toBe(400);
    const name='واحد آزمایشی بدون شناسه';
    const created=await request(app).post('/api/academic/campuses')
      .set('Authorization',adminToken).send({
        universityId:campus!.universityId,name,type:'INDEPENDENT_UNIT',
      });
    expect(created.status).toBe(200);
    generatedIds.campuses.push(created.body.data.id);
    expect(created.body.data.code).toMatch(/^INTERNAL-/);
    const duplicate=await request(app).post('/api/academic/campuses')
      .set('Authorization',adminToken).send({
        universityId:campus!.universityId,name,type:'INDEPENDENT_UNIT',
      });
    expect(duplicate.status).toBe(409);
    const year=db.entryYears[0].year;
    const duplicateYear=await request(app).post('/api/academic/entry-years')
      .set('Authorization',adminToken).send({year});
    expect(duplicateYear.status).toBe(409);
  });
});
