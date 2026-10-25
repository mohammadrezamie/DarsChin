import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { studentRouter } from '../server/routes/student';
import { generateToken } from '../server/middleware/auth';
import type { CourseOffering, StudentAcademicProfile, User } from '../src/types';

const app=express();
app.use(express.json());
app.use('/api/student',studentRouter);
const prefix='test-plan-scope-20261026';
const userId=prefix+'-student';
const campusId=prefix+'-campus';
const foreignCampus=prefix+'-other-campus';
const firstId=prefix+'-off-a';
const secondId=prefix+'-off-b';
const foreignId=prefix+'-off-foreign';
const aId=prefix+'-course-a';
const bId=prefix+'-course-b';
let token='',termId='';
const testOffering=(id:string,courseId:string,campus:string):CourseOffering=>({
  id,termId,campusId:campus,courseId,groupCode:'01',
  instructor:'استاد تست',dayOfWeek:'شنبه',startTime:'09:00',
  endTime:'10:30',capacity:20,enrolledCount:0,
  active:true,source:'manual',
});
beforeAll(async()=>{
  await db.init(true);
  termId=db.academicTerms.find(t=>t.isCurrent)?.id || 'term-1405-1';
  const user:User={id:userId,name:'دانشجوی بررسی ذخیره',
    mobile:'09120000680',roles:['student'],createdAt:new Date().toISOString()};
  const profile:StudentAcademicProfile={
    userId,universityId:prefix+'-university',campusId,
    degreeLevelId:prefix+'-degree',majorId:prefix+'-major',
    entryYearId:prefix+'-year',currentTermId:termId,
    isTrackSelected:false,desiredTrackIds:[],updatedAt:new Date().toISOString(),
  };
  db.users.push(user);
  db.studentProfiles.push(profile);
  db.courseOfferings.push(testOffering(firstId,aId,campusId),
    testOffering(secondId,bId,campusId),
    testOffering(foreignId,aId,foreignCampus));
  token='Bearer '+generateToken(user);
});
afterAll(()=>{
  db.data.users=db.users.filter(u=>u.id!==userId);
  db.data.studentProfiles=db.studentProfiles.filter(p=>p.userId!==userId);
  db.data.studentPlans=db.studentPlans.filter(p=>p.userId!==userId);
  db.data.courseOfferings=db.courseOfferings.filter(o=>!o.id.startsWith(prefix));
  db.save();
});
describe('persisted priority integrity / read-only plan retrieval',()=>{
  it('does not write an empty student plan merely because GET was opened',async()=>{
    const before=db.studentPlans.filter(p=>p.userId===userId).length;
    const result=await request(app).get('/api/student/plan').set('Authorization',token);
    expect(result.status).toBe(200);
    expect(result.body.data.selectedOfferingIds).toEqual([]);
    expect(db.studentPlans.filter(p=>p.userId===userId)).toHaveLength(before);
  });
  it('stores correctly scoped priority-only updates without needing a new selected offering',async()=>{
    const result=await request(app).put('/api/student/plan')
      .set('Authorization',token).send({
        coursePriorities:[aId,bId],
        offeringPriorities:{[aId]:[firstId],[bId]:[secondId]},
      });
    expect(result.status).toBe(200);
    expect(result.body.data.coursePriorities).toEqual([aId,bId]);
    expect(db.studentPlans.filter(p=>p.userId===userId)).toHaveLength(1);
  });
  it('rejects fallback IDs from another campus or different course atomically',async()=>{
    const stored=db.studentPlans.find(p=>p.userId===userId)!;
    const snapshot=JSON.stringify(stored);
    for(const invalid of [
      {[aId]:[foreignId]},
      {[aId]:[secondId]},
      {[aId]:[firstId,firstId]},
    ]){
      const result=await request(app).put('/api/student/plan')
        .set('Authorization',token).send({coursePriorities:[aId],offeringPriorities:invalid});
      expect(result.status).toBe(400);
      expect(JSON.stringify(db.studentPlans.find(p=>p.userId===userId))).toBe(snapshot);
    }
  });
});
