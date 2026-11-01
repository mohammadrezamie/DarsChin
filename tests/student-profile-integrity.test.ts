import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { studentRouter } from '../server/routes/student';
import { generateToken } from '../server/middleware/auth';
import type { StudentAcademicProfile, User } from '../src/types';

const app=express();
app.use(express.json());
app.use('/api/student',studentRouter);
const userId='test-profile-scope-preserve-20261026';
let token='', originalYearId='', alternateYearId='';
let profile:StudentAcademicProfile;

beforeAll(async()=>{
  await db.init(true);
  const campus=db.campuses.find(c=>c.active!==false &&
    db.universities.some(u=>u.id===c.universityId && u.active!==false));
  const major=db.majors.find(m=>m.active!==false &&
    db.degreeLevels.some(d=>d.id===m.degreeLevelId && d.active!==false));
  const year=db.entryYears.find(y=>y.active!==false);
  const term=db.academicTerms.find(t=>t.isCurrent) || db.academicTerms[0];
  if(!campus||!major||!year||!term)throw Error('Seed academic fixtures required');
  originalYearId=year.id;
  const alternate={id:userId+'-year',year:1387,active:true};
  db.entryYears.push(alternate);
  alternateYearId=alternate.id;
  const actor:User={id:userId,name:'دانشجوی آزمایشی حفاظت پروفایل',
    mobile:'09120000973',roles:['student'],createdAt:new Date().toISOString()};
  profile={userId,universityId:campus.universityId,campusId:campus.id,
    degreeLevelId:major.degreeLevelId,majorId:major.id,entryYearId:year.id,
    currentTermId:term.id,isTrackSelected:false,selectedTrackId:null,
    desiredTrackIds:[],studentNumber:'14031234-TEST',
    previousTermGpa:17.75,isFinalSemesterOverride:true,
    finalSemesterNotes:'تأیید رسمی مدیر آموزش (فقط دادهٔ آزمایشی)',
    updatedAt:new Date().toISOString()};
  db.users.push(actor);
  db.studentProfiles.push(profile);
  token='Bearer '+generateToken(actor);
});
afterAll(()=>{
  db.data.studentProfiles=db.studentProfiles.filter(p=>p.userId!==userId);
  db.data.studentPlans=db.studentPlans.filter(p=>p.userId!==userId);
  db.data.users=db.users.filter(u=>u.id!==userId);
  db.data.entryYears=db.entryYears.filter(y=>y.id!==alternateYearId);
  db.save();
});

describe('partial student profile updates preserve academic-authority data',()=>{
  it('does not discard an approved final-semester override or saved GPA on a partial update',async()=>{
    const response=await request(app).put('/api/student/profile')
      .set('Authorization',token).send({isTrackSelected:false});
    expect(response.status).toBe(200);
    expect(response.body.data.isFinalSemesterOverride).toBe(true);
    expect(response.body.data.finalSemesterNotes).toContain('تأیید رسمی');
    expect(response.body.data.previousTermGpa).toBe(17.75);
    expect(response.body.data.studentNumber).toBe('14031234-TEST');
  });
  it('ignores forged student-side approval fields and keeps validated identifiers',async()=>{
    const result=await request(app).put('/api/student/profile')
      .set('Authorization',token).send({
        isFinalSemesterOverride:false,
        finalSemesterNotes:'دانشجو مجوز مدیر را لغو کرد',
        studentNumber:'FAKE',
      });
    expect(result.status).toBe(200);
    expect(result.body.data.isFinalSemesterOverride).toBe(true);
    expect(result.body.data.studentNumber).toBe('14031234-TEST');
    expect(result.body.data.finalSemesterNotes).toContain('تأیید رسمی');
  });
  it('rejects invalid major, campus and track hierarchy without partial writes',async()=>{
    const current=JSON.stringify(db.studentProfiles.find(p=>p.userId===userId));
    for(const payload of [{campusId:'foreign-campus'}, {majorId:'foreign-major'},
      {isTrackSelected:true,selectedTrackId:'foreign-track'}]){
      const r=await request(app).put('/api/student/profile')
        .set('Authorization',token).send(payload);
      expect(r.status).toBe(400);
      expect(JSON.stringify(db.studentProfiles.find(p=>p.userId===userId))).toBe(current);
    }
  });
  it('prevents a scope switch while a current-semester selected plan exists',async()=>{
    const current=db.studentProfiles.find(p=>p.userId===userId)!;
    db.studentPlans.push({
      id:userId+'-plan',userId,termId:current.currentTermId!,
      selectedOfferingIds:['some-old-offering'],coursePriorities:{},
      offeringPriorities:{},updatedAt:new Date().toISOString(),
    });
    try{
      const denied=await request(app).put('/api/student/profile')
        .set('Authorization',token).send({entryYearId:alternateYearId});
      expect(denied.status).toBe(409);
      expect(db.studentProfiles.find(p=>p.userId===userId)?.entryYearId).toBe(originalYearId);
      expect(db.studentPlans.find(p=>p.userId===userId)?.selectedOfferingIds)
        .toEqual(['some-old-offering']);
    }finally{
      db.data.studentPlans=db.studentPlans.filter(p=>p.id!==userId+'-plan');
    }
  });
});
