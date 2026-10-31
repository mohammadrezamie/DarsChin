import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, type DatabaseSchema } from '../server/db/database';
import { studentRouter } from '../server/routes/student';
import { generateToken } from '../server/middleware/auth';
import { isSuccessfulCourseAttempt, courseAttemptLabel } from '../src/domain/course-attempt-status';
import { evaluateStudentEligibility } from '../src/domain/eligibility-engine';
import type { Course, StudentAcademicProfile, User } from '../src/types';

const app=express();
app.use(express.json());
app.use('/api/student',studentRouter);
const studentId='transcript-student-20261031',otherId='transcript-other-20261031';
const token=(id:string)=>({Authorization:'Bearer '+generateToken({id})});
let original:DatabaseSchema;
let courseA:Course,courseB:Course,courseC:Course,courseD:Course;

beforeAll(async()=>{
  await db.init(true);
  original=db.data;
  const courses=original.courses.filter(c=>c.active).slice(0,4);
  if(courses.length!==4)throw new Error('Four synthetic courses required');
  [courseA,courseB,courseC,courseD]=courses;
  const user=(id:string):User=>({
    id,mobile:id===studentId?'09998887771':'09998887772',name:'Fixture',
    roles:['student'],permissions:[],createdAt:new Date().toISOString(),
  });
  db.data={...original,users:[...original.users,user(studentId),user(otherId)],
    studentPassedCourses:[...original.studentPassedCourses]};
});
afterAll(()=>{db.data=original;db.save();});
const post=(courseId:string,termId:string,status:string,grade?:number)=>
  request(app).post('/api/student/passed-courses').set(token(studentId)).send({courseId,termId,status,grade});

describe('term-by-term transcript outcomes never invent a passed prerequisite',()=>{
  it('retains legacy ambiguous absences without guessing their cause',()=>{
    expect(courseAttemptLabel('ABSENT')).toContain('نوع غیبت');
    expect(isSuccessfulCourseAttempt({status:'ABSENT'})).toBe(false);
    expect(isSuccessfulCourseAttempt({status:'EXCUSED_EXAM_ABSENCE'})).toBe(false);
    expect(isSuccessfulCourseAttempt({status:'CLASS_ABSENCE_DROP'})).toBe(false);
    expect(isSuccessfulCourseAttempt({status:'FAILED',grade:7})).toBe(false);
    expect(isSuccessfulCourseAttempt({status:'PASSED',grade:16})).toBe(true);
    expect(isSuccessfulCourseAttempt({status:undefined,grade:18})).toBe(true);
  });
  it('stores failed, passed, excused exam absence and class-absence drop in distinct semesters',async()=>{
    const failure=await post(courseA.id,'semester-1','FAILED',7);
    const pass=await post(courseA.id,'semester-2','PASSED',16);
    const excused=await post(courseB.id,'semester-1','EXCUSED_EXAM_ABSENCE');
    const dropped=await post(courseC.id,'semester-1','CLASS_ABSENCE_DROP');
    expect([failure.status,pass.status,excused.status,dropped.status]).toEqual([200,200,200,200]);
    const res=await request(app).get('/api/student/passed-courses').set(token(studentId));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    const rows=res.body.data.passedCourses;
    expect(rows.filter((row:{courseId:string})=>row.courseId===courseA.id).map((r:{termId:string})=>r.termId))
      .toEqual(['semester-1','semester-2']);
    expect(rows.find((r:{courseId:string})=>r.courseId===courseB.id).status).toBe('EXCUSED_EXAM_ABSENCE');
    expect(rows.find((r:{courseId:string})=>r.courseId===courseC.id).status).toBe('CLASS_ABSENCE_DROP');
    expect(res.body.data.totalUnits).toBe(courseA.units);
  });
  it('rejects duplicate rows in one term and a grade for absences without corrupting history',async()=>{
    const before=db.studentPassedCourses.filter(x=>x.userId===studentId).length;
    const repeat=await post(courseA.id,'semester-1','FAILED',4);
    const invalid=await post(courseD.id,'semester-1','EXCUSED_EXAM_ABSENCE',0);
    expect(repeat.status).toBe(409);
    expect(invalid.status).toBe(400);
    expect(db.studentPassedCourses.filter(x=>x.userId===studentId)).toHaveLength(before);
  });
  it('allows ownership-scoped correction of a semester outcome but not another user history',async()=>{
    const id=db.studentPassedCourses.find(x=>x.userId===studentId&&x.courseId===courseB.id)!.id;
    const denied=await request(app).put('/api/student/passed-courses/'+id).set(token(otherId))
      .send({courseId:courseB.id,termId:'semester-1',status:'PASSED',grade:18});
    expect(denied.status).toBe(404);
    const fixed=await request(app).put('/api/student/passed-courses/'+id).set(token(studentId))
      .send({courseId:courseB.id,termId:'semester-1',status:'FAILED',grade:6});
    expect(fixed.status).toBe(200);
    expect(fixed.body.data.id).toBe(id);
    expect(fixed.body.data.status).toBe('FAILED');
    const history=db.studentPassedCourses.filter(x=>x.userId===studentId);
    expect(history.find(x=>x.id===id)?.grade).toBe(6);
    expect(history.some(x=>x.courseId===courseA.id&&x.status==='PASSED')).toBe(true);
  });
});
