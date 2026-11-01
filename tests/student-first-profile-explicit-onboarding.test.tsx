import React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import express from 'express';
import request from 'supertest';
import { db, type DatabaseSchema } from '../server/db/database';
import { studentRouter } from '../server/routes/student';
import { generateToken } from '../server/middleware/auth';
import { StudentJourneyStepper } from '../src/components/StudentJourneyStepper';
import type { User } from '../src/types';

const app=express();
app.use(express.json());
app.use('/api/student',studentRouter);
const firstId='synthetic-uninitialized-account';
const secondId='synthetic-other-uninitialized-account';
const secret='SYNTHETIC_PRIVATE_DB_PATH:/secrets/students.json';
let saved: DatabaseSchema;
let auth='',otherAuth='';
const user=(id:string,mobile:string):User=>({
  id,mobile,name:'دانشجوی آزمایشی جدید',roles:['student'],createdAt:new Date().toISOString(),
});
const get=(url:string,token=auth)=>request(app).get('/api/student'+url).set('Authorization',token);
const put=(body:object,token=auth)=>request(app).put('/api/student/profile').set('Authorization',token).send(body);
beforeAll(async()=>{await db.init(true);});
beforeEach(()=>{
  saved=db.data;
  const me=user(firstId,'09900009071');
  const other=user(secondId,'09900009072');
  db.data={...saved,
    users:[...saved.users,me,other],
    studentProfiles:saved.studentProfiles.filter(p=>p.userId!==firstId&&p.userId!==secondId),
    studentPlans:saved.studentPlans.filter(p=>p.userId!==firstId&&p.userId!==secondId),
  };
  auth='Bearer '+generateToken(me);
  otherAuth='Bearer '+generateToken(other);
});
afterEach(()=>{vi.restoreAllMocks();db.data=saved;});

const validProfile=()=>{
  const c=db.curricula.find(row=>row.status==='active');
  if(!c)throw Error('Missing active curriculum fixture');
  const term=db.academicTerms.find(row=>row.isCurrent && row.active)??db.academicTerms.find(row=>row.active);
  if(!term)throw Error('Missing academic term fixture');
  return {universityId:c.universityId,campusId:c.campusId,
    degreeLevelId:c.degreeLevelId,majorId:c.majorId,entryYearId:c.entryYearId,
    currentTermId:term.id,isTrackSelected:false,desiredTrackIds:[]};
};

describe('گام اول ورود دانشجوی تازه؛ بدون ساخت پروندهٔ حدسی',()=>{
  it('GET پروندهٔ فاقد ثبت را خالی نشان می‌دهد و هیچ رکورد یا نوشتنی ایجاد نمی‌کند',async()=>{
    const spy=vi.spyOn(db,'save');
    const response=await get('/profile');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success:true,data:{profile:null,curriculum:null,needsSetup:true},
    });
    expect(response.headers['cache-control']).toContain('no-store');
    expect(db.studentProfiles.some(p=>p.userId===firstId)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect((await get('/profile',otherAuth)).body.data.profile).toBeNull();
  });

  it('در نبود پروندهٔ واقعی، تغییر برنامهٔ درسی بدون مرحلهٔ انتخاب دانشگاه مجاز نیست',async()=>{
    expect((await get('/plan')).status).toBe(409);
    expect(db.studentPlans.some(p=>p.userId===firstId)).toBe(false);
  });

  it('درخواست ساخت پرونده بدون انتخاب معتبر یا با واحد نامرتبط رد می‌شود',async()=>{
    const spy=vi.spyOn(db,'save');
    expect((await put({})).status).toBe(400);
    const correct=validProfile();
    expect((await put({...correct,campusId:'campus-outside-real-university'})).status).toBe(400);
    expect((await put({...correct,degreeLevelId:'wrong-degree'})).status).toBe(400);
    expect((await put({...correct,entryYearId:'unknown-entry-year'})).status).toBe(400);
    expect((await put({...correct,desiredTrackIds:['foreign-track']})).status).toBe(400);
    expect((await put({...correct,isTrackSelected:true,selectedTrackId:'foreign-track'})).status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
    expect(db.studentProfiles.some(p=>p.userId===firstId)).toBe(false);
  });

  it('پروندهٔ انتخاب‌شده توسط دانشجو را با گرایش اختیاری ذخیره می‌کند',async()=>{
    const context=validProfile();
    const savedProfile=await put(context);
    expect(savedProfile.status).toBe(200);
    expect(savedProfile.body.data).toMatchObject({...context,userId:firstId});
    expect(db.studentProfiles.filter(row=>row.userId===firstId)).toHaveLength(1);
    const read=await get('/profile');
    expect(read.status).toBe(200);
    expect(read.body.data.profile).toMatchObject({...context,userId:firstId});
    expect((await get('/profile',otherAuth)).body.data.profile).toBeNull();
  });

  it('به‌روزرسانی جزئیِ معدل باید رشته و ورودی و سوابق را حفظ کند',async()=>{
    const initial=await put(validProfile());
    expect(initial.status).toBe(200);
    const partial=await put({previousTermGpa:17.25});
    expect(partial.status).toBe(200);
    expect(partial.body.data).toMatchObject({
      userId:firstId,universityId:initial.body.data.universityId,
      campusId:initial.body.data.campusId,majorId:initial.body.data.majorId,
      entryYearId:initial.body.data.entryYearId,previousTermGpa:17.25,
    });
    expect(db.studentProfiles.filter(row=>row.userId===firstId)).toHaveLength(1);
  });

  it('در شکست ثبت دیتابیس، پروندهٔ حدسی یا وضعیت نیمه‌کاره باقی نمی‌ماند',async()=>{
    const before=JSON.stringify(db.studentProfiles);
    const fail=vi.spyOn(db,'save').mockImplementationOnce(()=>{throw Error(secret);});
    const result=await put(validProfile());
    fail.mockRestore();
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toContain(secret);
    expect(JSON.stringify(db.studentProfiles)).toBe(before);
    expect((await put(validProfile())).status).toBe(200);
  });

  it('راهنمای فارسیِ هفت‌مرحله‌ای برای پروندهٔ غایب دکمهٔ تکمیل واقعی نشان می‌دهد',()=>{
    const html=renderToStaticMarkup(<StudentJourneyStepper step={0} busy={false}
      hasProfile={false} hasCurriculum={false} academicLimits={null} profile={null}
      wishlistCount={0} onOpenProfile={()=>{}} onStep={()=>{}} />);
    expect(html).toContain('تکمیل پروندهٔ تحصیلی');
    expect(html).toContain('پرونده‌ام را بررسی و تأیید کردم');
    expect(html).toContain('disabled');
  });
});
