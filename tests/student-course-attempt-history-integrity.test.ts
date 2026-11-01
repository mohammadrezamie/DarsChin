import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { studentRouter } from '../server/routes/student';
import { generateToken } from '../server/middleware/auth';
import { addPassedCourseSchema } from '../server/schemas/student';
import type { User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/student', studentRouter);

const primaryId = 'history-validation-student-20261029';
const secondId = primaryId + '-other';
let auth = '';
let otherAuth = '';
let courseA = '';
let courseB = '';
let courseC = '';

beforeAll(async () => {
  await db.init(true);
  const courses = db.courses.filter(c => c.active);
  if (courses.length < 3) throw new Error('Requires three seeded courses');
  [courseA, courseB, courseC] = courses.slice(0, 3).map(c => c.id);
  const makeUser = (id: string): User => ({
    id, mobile: '09999988111', name: 'تست تاریخچهٔ انتخاب واحد', roles: ['student'],
    permissions: [], createdAt: new Date().toISOString(),
  });
  const primary = makeUser(primaryId), other = makeUser(secondId);
  db.users.push(primary, other);
  auth = 'Bearer ' + generateToken(primary);
  otherAuth = 'Bearer ' + generateToken(other);
  db.save();
});

afterAll(() => {
  for (const userId of [primaryId, secondId]) {
    db.data.users = db.users.filter(user => user.id !== userId);
    db.data.studentPassedCourses = db.studentPassedCourses.filter(record => record.userId !== userId);
  }
  db.save();
});

describe('academic attempt grade and status validation', () => {
  it('rejects empty, malformed, unbounded or nonfinite grades', () => {
    for (const grade of ['', 'abc', 'NaN', -1, 20.5, '0x11', null, {}, 'Infinity']) {
      const value = addPassedCourseSchema.safeParse({ courseId: courseA, grade });
      expect(value.success, 'grade ' + String(grade)).toBe(false);
    }
    expect(addPassedCourseSchema.parse({courseId:courseA,grade:'9.5',status:'FAILED'}))
      .toMatchObject({grade:9.5,status:'FAILED'});
  });

  it('rejects incompatible explicit statuses and scores', () => {
    expect(addPassedCourseSchema.safeParse({courseId:courseA,status:'PASSED',grade:7}).success).toBe(false);
    expect(addPassedCourseSchema.safeParse({courseId:courseA,status:'FAILED',grade:17}).success).toBe(false);
    expect(addPassedCourseSchema.safeParse({courseId:courseA,status:'ABSENT',grade:0}).success).toBe(false);
    expect(addPassedCourseSchema.safeParse({courseId:courseA,status:'ABSENT'}).success).toBe(true);
  });

  it('does not accept a nonexistent course or write invalid attempts', async () => {
    const before = db.studentPassedCourses.length;
    const invalid = await request(app).post('/api/student/passed-courses').set('Authorization',auth)
      .send({courseId:'missing-irrelevant-course',status:'PASSED'});
    expect(invalid.status).toBe(400);
    const invalidGrade = await request(app).post('/api/student/passed-courses').set('Authorization',auth)
      .send({courseId:courseA,status:'PASSED',grade:'not-a-number'});
    expect(invalidGrade.status).toBe(400);
    expect(db.studentPassedCourses.length).toBe(before);
  });

  it('records failure and an independent downstream pass without inventing a prerequisite pass', async () => {
    const failed = await request(app).post('/api/student/passed-courses').set('Authorization',auth)
      .send({courseId:courseA,status:'FAILED',grade:6,termId:'term-failed'});
    const passed = await request(app).post('/api/student/passed-courses').set('Authorization',auth)
      .send({courseId:courseB,status:'PASSED',grade:17,termId:'term-success'});
    expect(failed.status).toBe(200);
    expect(passed.status).toBe(200);
    const result = await request(app).get('/api/student/passed-courses').set('Authorization',auth);
    const records = result.body.data.passedCourses;
    expect(records.find((x:{courseId:string}) => x.courseId === courseA)?.status).toBe('FAILED');
    expect(records.find((x:{courseId:string}) => x.courseId === courseB)?.status).toBe('PASSED');
    expect(result.body.data.totalUnits).toBe(db.courses.find(c=>c.id===courseB)?.units);
  });

  it('does not erase failed attempts or retained successful grades on bulk checklist replacement', async () => {
    const before = db.studentPassedCourses.filter(x=>x.userId===primaryId);
    const failure = before.find(x=>x.courseId===courseA && x.status==='FAILED');
    const passed = before.find(x=>x.courseId===courseB && x.status==='PASSED');
    if (!failure || !passed) throw new Error('Fixture missing');
    const replacement = await request(app).post('/api/student/passed-courses/batch')
      .set('Authorization',auth).send({courseIds:[courseB,courseC],replaceAll:true});
    expect(replacement.status).toBe(200);
    const after = db.studentPassedCourses.filter(x=>x.userId===primaryId);
    expect(after.find(x=>x.id===failure.id)?.grade).toBe(6);
    expect(after.find(x=>x.id===passed.id)?.grade).toBe(17);
    expect(after.find(x=>x.id===passed.id)?.termId).toBe('term-success');
    expect(after.some(x=>x.courseId===courseC && x.status==='PASSED')).toBe(true);
  });

  it('does not modify the saved history on malformed batch content', async () => {
    const before = JSON.stringify(db.studentPassedCourses.filter(x=>x.userId===primaryId));
    const bad = await request(app).post('/api/student/passed-courses/batch')
      .set('Authorization',auth).send({courseIds:[courseA,'definitely-unknown'],replaceAll:true});
    expect(bad.status).toBe(400);
    expect(JSON.stringify(db.studentPassedCourses.filter(x=>x.userId===primaryId))).toBe(before);
  });

  it('preserves separation from other accounts including deletion and batch updates', async () => {
    const other = await request(app).post('/api/student/passed-courses').set('Authorization',otherAuth)
      .send({courseId:courseA,status:'ABSENT'});
    expect(other.status).toBe(200);
    const result = await request(app).get('/api/student/passed-courses').set('Authorization',auth);
    expect(result.body.data.passedCourses.some((x:{id:string}) => x.id===other.body.data.id)).toBe(false);
    const replacement = await request(app).post('/api/student/passed-courses/batch')
      .set('Authorization',auth).send({courseIds:[],replaceAll:true});
    expect(replacement.status).toBe(200);
    expect(db.studentPassedCourses.some(x=>x.userId===secondId && x.status==='ABSENT')).toBe(true);
    expect(db.studentPassedCourses.some(x=>x.userId===primaryId && x.status==='FAILED')).toBe(true);
  });

  it('requires authentication for every history mutation', async () => {
    expect((await request(app).post('/api/student/passed-courses').send({courseId:courseA})).status).toBe(401);
    expect((await request(app).post('/api/student/passed-courses/batch').send({courseIds:[]})).status).toBe(401);
  });
});
