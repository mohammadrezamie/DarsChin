import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { studentRouter } from '../server/routes/student';
import { generateToken } from '../server/middleware/auth';
import type { Course, User } from '../src/types';

const app=express();
app.use(express.json());
app.use('/api/student',studentRouter);
const prefix='transcript-integrity-20261026';
const userId=prefix+'-user';
const courses:Course[]=[
  {id:prefix+'-a',code:prefix+'-A',name:'درس با سابقهٔ مردودی',
    units:2,category:'پایه',active:true},
  {id:prefix+'-b',code:prefix+'-B',name:'درس با سابقهٔ قبولی',
    units:3,category:'اصلی',active:true},
  {id:prefix+'-c',code:prefix+'-C',name:'درس جایگزینی گروهی',
    units:1,category:'عمومی',active:true},
];
let token='';
beforeAll(async()=>{
  await db.init(true);
  const user:User={id:userId,name:'دانشجوی تست سوابق',
    mobile:'09120000989',roles:['student'],createdAt:new Date().toISOString()};
  db.users.push(user);
  db.courses.push(...courses);
  token='Bearer '+generateToken(user);
});
beforeEach(()=>{
  db.data.studentPassedCourses=db.studentPassedCourses.filter(p=>p.userId!==userId);
});
afterAll(()=>{
  db.data.users=db.users.filter(u=>u.id!==userId);
  db.data.courses=db.courses.filter(c=>!c.id.startsWith(prefix));
  db.data.studentPassedCourses=db.studentPassedCourses.filter(p=>p.userId!==userId);
  db.save();
});
const save=(courseId:string,grade:unknown)=>
  request(app).post('/api/student/passed-courses')
    .set('Authorization',token).send({courseId,grade});

describe('student transcript input and completed-unit safety',()=>{
  it('rejects malformed, out-of-range or unknown grades without storing them',async()=>{
    for(const grade of ['abc',-1,21,'21','12abc','   ']){
      // Blank whitespace is intentionally treated as optional, not a fake zero.
      const response=await save(courses[0].id,grade);
      if(grade==='   '){
        expect(response.status).toBe(200);
      }else expect(response.status).toBe(400);
      if(grade==='   ')db.data.studentPassedCourses=db.studentPassedCourses.filter(p=>p.userId!==userId);
    }
    const nonexistent=await save('nonexistent-catalog-course',16);
    expect(nonexistent.status).toBe(400);
    expect(db.studentPassedCourses.filter(p=>p.userId===userId)).toHaveLength(0);
  });
  it('does not count failed or duplicated attempts as completed credits',async()=>{
    const failed=await save(courses[0].id,9);
    expect(failed.status).toBe(200);
    expect(failed.body.data.status).toBe('FAILED');
    const passed=await save(courses[1].id,15);
    expect(passed.status).toBe(200);
    const duplicate=await save(courses[1].id,16);
    expect(duplicate.status).toBe(409);
    const summary=await request(app).get('/api/student/passed-courses')
      .set('Authorization',token);
    expect(summary.status).toBe(200);
    expect(summary.body.data.totalUnits).toBe(3);
    expect(summary.body.data.categorySummary['اصلی']).toBe(3);
    expect(summary.body.data.categorySummary['پایه']||0).toBe(0);
  });
  it('rejects invalid replaceAll batches without deleting any prior record',async()=>{
    expect((await save(courses[1].id,18)).status).toBe(200);
    const original=db.studentPassedCourses.filter(p=>p.userId===userId)
      .map(p=>({id:p.id,courseId:p.courseId,grade:p.grade}));
    const bad=await request(app).post('/api/student/passed-courses/batch')
      .set('Authorization',token).send({
        replaceAll:true,courseIds:[courses[2].id,'does-not-exist'],
      });
    expect(bad.status).toBe(400);
    expect(db.studentPassedCourses.filter(p=>p.userId===userId)
      .map(p=>({id:p.id,courseId:p.courseId,grade:p.grade}))).toEqual(original);
    const valid=await request(app).post('/api/student/passed-courses/batch')
      .set('Authorization',token).send({
        replaceAll:true,courseIds:[courses[0].id,courses[2].id],
      });
    expect(valid.status).toBe(200);
    expect(valid.body.addedCount).toBe(2);
    expect(db.studentPassedCourses.filter(p=>p.userId===userId).map(p=>p.courseId))
      .toEqual([courses[0].id,courses[2].id]);
    const summary=await request(app).get('/api/student/passed-courses')
      .set('Authorization',token);
    expect(summary.body.data.totalUnits).toBe(3);
  });
});
