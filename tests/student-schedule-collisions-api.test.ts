import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, type DatabaseSchema } from '../server/db/database';
import { studentRouter } from '../server/routes/student';
import { eligibilityRouter } from '../server/routes/eligibility';
import { generateToken } from '../server/middleware/auth';
import type { User, StudentAcademicProfile, Course, CourseOffering, CurriculumCourse } from '../src/types';

const app=express();
app.use(express.json());
app.use('/api/student',studentRouter);
app.use('/api/eligibility',eligibilityRouter);
const userId='synthetic-strict-conflict-student';
const syntheticPrefix='synthetic-conflict-';
let previous: DatabaseSchema;
let auth='';
let termId='',campusId='',chartId='';
const ids=['alpha','beta','beta-alternative','gamma'];
const authReq=(method:'put'|'post',route:string) =>
  request(app)[method]('/api/student'+route).set('Authorization',auth);
const offering=(id:string,courseId:string,day:string,start:string,end:string,examDate?:string):CourseOffering=>({
  id:syntheticPrefix+id,termId,campusId,courseId:syntheticPrefix+courseId,
  groupCode:id,instructor:'مدرس آزمایشی',dayOfWeek:day,startTime:start,endTime:end,
  examDate,capacity:30,enrolledCount:0,source:'manual',active:true,
});
beforeAll(async()=>{await db.init(true);});
beforeEach(()=>{
  previous=db.data;
  const chart=previous.curricula.find(row=>row.status==='active');
  const term=previous.academicTerms.find(row=>row.isCurrent)??previous.academicTerms[0];
  if(!chart||!term) throw Error('Missing academic fixtures');
  termId=term.id;campusId=chart.campusId;chartId=chart.id;
  const user:User={id:userId,mobile:'09900008432',name:'Synthetic planner',
    roles:['student'],createdAt:new Date().toISOString()};
  const profile:StudentAcademicProfile={
    userId,universityId:chart.universityId,campusId,degreeLevelId:chart.degreeLevelId,
    majorId:chart.majorId,entryYearId:chart.entryYearId,isTrackSelected:false,
    desiredTrackIds:[],currentTermId:termId,updatedAt:new Date().toISOString(),
  };
  const courses:Course[]=['alpha','beta','gamma'].map(id=>({
    id:syntheticPrefix+id,code:'SYN-CON-'+id,name:'Synthetic '+id,
    units:2,category:'تخصصی',active:true,
  }));
  const links:CurriculumCourse[]=courses.map(course=>({
    id:'link-'+course.id,curriculumId:chartId,courseId:course.id,
    classification:'MAJOR_REQUIRED',suggestedSemester:1,active:true,
  }));
  const offerings=[
    offering('alpha','alpha','سه‌شنبه','09:00','10:00','۱۴۰۵/۱۰/۲۱ - ۰۹:۰۰'),
    offering('beta','beta','سهشنبه','09:30','10:30','1405/10/21 - 09:00'),
    offering('beta-alternative','beta','سه‌شنبه','10:00','11:00','1405/10/21 - 11:00'),
    offering('gamma','gamma','چهارشنبه','09:00','10:00','1405/10/21 - 09:00'),
  ];
  db.data={...previous,users:[user],
    studentProfiles:[profile],studentPlans:[],studentPassedCourses:[],
    curricula:[{...chart}],
    courses:[...previous.courses,...courses],
    curriculumCourses:[...previous.curriculumCourses,...links],
    courseOfferings:offerings,academicRules:[],
  };
  auth='Bearer '+generateToken(user);
});
afterEach(()=>{vi.restoreAllMocks();db.data=previous;});
describe('server-enforced clash safety for real course plans',()=>{
  it('rejects class overlaps on bulk PUT before writing any student plan',async()=>{
    const bad=await authReq('put','/plan').send({selectedOfferingIds:[
      syntheticPrefix+'alpha',syntheticPrefix+'beta']});
    expect(bad.status).toBe(409);
    expect(bad.body.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({kind:'CLASS'}),
      expect.objectContaining({kind:'EXAM'}),
    ]));
    expect(db.studentPlans).toHaveLength(0);
  });
  it('rejects a single conflicting group without replacing the previous selections',async()=>{
    const initial=await authReq('post','/plan/select').send({
      action:'add',offeringId:syntheticPrefix+'alpha',
    });
    expect(initial.status).toBe(200);
    const snapshot=JSON.stringify(db.studentPlans);
    const bad=await authReq('post','/plan/select').send({
      action:'add',offeringId:syntheticPrefix+'beta',
    });
    expect(bad.status).toBe(409);
    expect(JSON.stringify(db.studentPlans)).toBe(snapshot);
  });
  it('allows back-to-back classes and preserves group alternatives',async()=>{
    expect((await authReq('post','/plan/select').send({
      action:'add',offeringId:syntheticPrefix+'alpha',
    })).status).toBe(200);
    const added=await authReq('post','/plan/select').send({
      action:'add',offeringId:syntheticPrefix+'beta-alternative',
    });
    expect(added.status).toBe(200);
    expect(added.body.selectedOfferingIds).toEqual([
      syntheticPrefix+'alpha',syntheticPrefix+'beta-alternative',
    ]);
    expect(added.body.plan.offeringPriorities[syntheticPrefix+'beta']).toEqual([
      syntheticPrefix+'beta-alternative',
    ]);
  });
  it('blocks exact exam collisions even on different lecture weekdays',async()=>{
    expect((await authReq('post','/plan/select').send({
      action:'add',offeringId:syntheticPrefix+'alpha',
    })).status).toBe(200);
    const bad=await authReq('post','/plan/select').send({
      action:'add',offeringId:syntheticPrefix+'gamma',
    });
    expect(bad.status).toBe(409);
    expect(bad.body.conflicts.map((row:{kind:string})=>row.kind)).toEqual(['EXAM']);
  });
  it('does not persist an empty plan when asked to remove an unselected group',async()=>{
    const result=await authReq('post','/plan/select').send({
      action:'remove',offeringId:syntheticPrefix+'alpha',
    });
    expect(result.status).toBe(200);
    expect(db.studentPlans).toHaveLength(0);
  });
});
