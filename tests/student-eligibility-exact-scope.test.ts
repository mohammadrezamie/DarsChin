import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, type DatabaseSchema } from '../server/db/database';
import { eligibilityRouter } from '../server/routes/eligibility';
import { generateToken } from '../server/middleware/auth';
import type { CourseOffering, StudentAcademicProfile, User } from '../src/types';

const app=express();
app.use(express.json());
app.use('/api/eligibility',eligibilityRouter);
const id='test-eligibility-current-scope-20261030';
const auth=()=>({Authorization:'Bearer '+generateToken({id})});
let original:DatabaseSchema, profile:StudentAcademicProfile, own:CourseOffering, foreign:CourseOffering;

beforeAll(async()=>{
  await db.init(true);
  original=db.data;
  const chart=original.curricula.find(c=>c.status==='active');
  if(!chart)throw new Error('Synthetic active chart is required');
  const courseId=original.curriculumCourses.find(cc=>cc.curriculumId===chart.id)?.courseId;
  if(!courseId)throw new Error('Synthetic chart course missing');
  const term=original.academicTerms.find(t=>t.isCurrent)?.id || original.academicTerms[0]?.id;
  if(!term)throw new Error('Synthetic term missing');
  profile={
    userId:id,universityId:chart.universityId,campusId:chart.campusId,
    degreeLevelId:chart.degreeLevelId,majorId:chart.majorId,
    entryYearId:chart.entryYearId,isTrackSelected:false,
    desiredTrackIds:[],currentTermId:term,
    updatedAt:new Date().toISOString(),
  };
  const makeOffering=(offeringId:string,campusId:string):CourseOffering=>({
    id:offeringId,termId:term,campusId,courseId,rawCourseCode:'TEST-SCOPE',
    groupCode:'01',instructor:'Synthetic',dayOfWeek:'شنبه',
    startTime:'08:00',endTime:'09:00',capacity:25,enrolledCount:0,
    active:true,source:'manual',
  });
  own=makeOffering('own-scope-offering',profile.campusId);
  foreign=makeOffering('foreign-scope-offering','a-different-campus');
  const student:User={
    id,mobile:'09901118888',name:'Synthetic scoped test',
    roles:['student'],permissions:[],createdAt:new Date().toISOString(),
  };
  db.data={
    ...original,users:[...original.users,student],
    studentProfiles:[...original.studentProfiles,profile],
    courseOfferings:[...original.courseOfferings,own,foreign],
  };
});
afterAll(()=>{db.data=original; db.save();});

describe('student eligibility/report never borrows an unrelated chart or campus',()=>{
  it('accepts only same-campus, active, same-term offerings and does not include foreign campus in the report',async()=>{
    const res=await request(app).post('/api/eligibility/evaluate').set(auth())
      .send({plannedCourseIds:[own.id]});
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body.data.context.curriculum).toMatchObject({
      universityId:profile.universityId,campusId:profile.campusId,
      degreeLevelId:profile.degreeLevelId,majorId:profile.majorId,entryYearId:profile.entryYearId,
    });
    const ids=res.body.data.report.results.map((e:{offeringId:string})=>e.offeringId);
    expect(ids).toContain(own.id);
    expect(ids).not.toContain(foreign.id);
  });

  it('refuses to evaluate a group from another campus or an unknown selection',async()=>{
    for(const id of [foreign.id,'never-existed-offering']){
      const res=await request(app).post('/api/eligibility/evaluate').set(auth())
        .send({plannedCourseIds:[id]});
      expect(res.status,id).toBe(400);
    }
  });

  it('does not select first chart when university, campus, degree or entry year changes',async()=>{
    const originalValues={
      universityId:profile.universityId,campusId:profile.campusId,
      degreeLevelId:profile.degreeLevelId,entryYearId:profile.entryYearId,
    };
    try{
      for(const field of Object.keys(originalValues) as (keyof typeof originalValues)[]){
        (profile as any)[field]='not-in-this-chart';
        const res=await request(app).post('/api/eligibility/evaluate').set(auth())
          .send({plannedCourseIds:[]});
        expect(res.status,field).toBe(400);
        expect(res.body.error).toContain('چارت');
        (profile as any)[field]=originalValues[field];
      }
    }finally{Object.assign(profile,originalValues);}
  });

  it('rejects malformed, repeated or excessive identifiers before evaluation',async()=>{
    for(const ids of [['duplicate','duplicate'],[''],['a'.repeat(1)].concat(Array(501).fill('bad')),null,'bad']){
      const res=await request(app).post('/api/eligibility/evaluate').set(auth())
        .send({plannedCourseIds:ids});
      expect(res.status).toBe(400);
    }
  });
});
