import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { db } from '../server/db/database';
import { curriculumRouter } from '../server/routes/curriculum';
import { generateToken } from '../server/middleware/auth';
import type { AcademicRule, Course, Curriculum, CurriculumCourse, User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/curriculum', curriculumRouter);
const prefix = 'dep-api-'+randomUUID();
const chartId=prefix+'-chart', otherChartId=prefix+'-other', userId=prefix+'-root';
const ids=['A','B','C','X'].map(k=>prefix+'-'+k);
let bearer='';
let beforeRules:AcademicRule[]=[];

const payload=(source:string,target:string,type:'PREREQUISITE'|'COREQUISITE'='PREREQUISITE',curriculumId=chartId)=>({
  curriculumId,targetCourseId:target,relationshipType:type,expression:{type:'COURSE',courseId:source},
});
const put=(body:ReturnType<typeof payload>)=>request(app).post('/api/curriculum/rules').set('Authorization',bearer).send(body);

beforeAll(async()=>{
  await db.init(true);
  const baseChart=db.curricula[0],baseCourse=db.courses[0];
  if(!baseChart||!baseCourse)throw Error('Synthetic seed required');
  const chart:Curriculum={...baseChart,id:chartId,name:'چارت تست گراف',status:'draft'};
  db.curricula.push(chart,{...chart,id:otherChartId});
  ids.forEach((id,i)=>{
    db.courses.push({...baseCourse,id,name:'درس تست '+i,code:prefix+'-'+i} as Course);
    db.curriculumCourses.push({
      id:prefix+'-assignment-'+i,curriculumId:chartId,courseId:id,classification:'MAJOR_REQUIRED',
      suggestedSemester:i+1,active:true,
    } as CurriculumCourse);
  });
  const user:User={id:userId,name:'مالک ساختگی نقشه',mobile:'09999987989',
    roles:['super-admin'],permissions:['prerequisite.manage'],createdAt:new Date().toISOString()};
  db.users.push(user);
  bearer='Bearer '+generateToken(user);
  beforeRules=[...db.academicRules];
});
afterAll(()=>{
  db.data.curricula=db.curricula.filter(x=>x.id!==chartId&&x.id!==otherChartId);
  db.data.courses=db.courses.filter(x=>!ids.includes(x.id));
  db.data.curriculumCourses=db.curriculumCourses.filter(x=>x.curriculumId!==chartId);
  db.data.academicRules=beforeRules;
  db.data.users=db.users.filter(x=>x.id!==userId);
  db.save();
});

describe('admin visual graph must obey server-side curricular integrity',()=>{
  it('denies unauthenticated editing',async()=>{
    const result=await request(app).post('/api/curriculum/rules').send(payload(ids[0],ids[1]));
    expect(result.status).toBe(401);
  });

  it('creates a valid multi-semester prerequisite chain (not a false cycle)',async()=>{
    const a=await put(payload(ids[0],ids[1]));
    expect(a.status,a.text).toBe(200);
    const b=await put(payload(ids[1],ids[2]));
    expect(b.status,b.text).toBe(200);
    expect(a.body.data.id).not.toBe(b.body.data.id);
  });

  it('rejects actual cycles across three semesters without mutating rules',async()=>{
    const n=db.academicRules.length;
    const bad=await put(payload(ids[2],ids[0]));
    expect(bad.status).toBe(400);
    expect(db.academicRules).toHaveLength(n);
  });

  it('allows a mutual corequisite pair without mistaking it for a prerequisite cycle',async()=>{
    expect((await put(payload(ids[2],ids[3],'COREQUISITE'))).status).toBe(200);
    expect((await put(payload(ids[3],ids[2],'COREQUISITE'))).status).toBe(200);
  });

  it('rejects references to courses not assigned to the selected chart',async()=>{
    const n=db.academicRules.length;
    expect((await put(payload(ids[0],ids[2],'PREREQUISITE',otherChartId))).status).toBe(400);
    expect((await put(payload('missing',ids[2]))).status).toBe(400);
    expect((await put(payload(ids[0],'missing'))).status).toBe(400);
    expect(db.academicRules).toHaveLength(n);
  });
});
