import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { studentRouter } from '../server/routes/student';
import { generateToken } from '../server/middleware/auth';
import type { StudentAcademicProfile, User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/student', studentRouter);
const testId = 'guided-student-journey-test-20261029';
const otherId = testId + '-other';
let token = '';
let otherToken = '';
let chartCourseIds: string[] = [];

beforeAll(async () => {
  await db.init(true);
  const chart = db.curricula.find(c => c.status === 'active');
  if (!chart) throw new Error('Missing seeded active chart');
  const sample: StudentAcademicProfile = {
    userId: testId, universityId: chart.universityId, campusId: chart.campusId,
    degreeLevelId: chart.degreeLevelId, majorId: chart.majorId,
    entryYearId: chart.entryYearId, isTrackSelected: false,
    selectedTrackId: null, desiredTrackIds: [],
    currentTermId: db.academicTerms.find(t => t.isCurrent)?.id || db.academicTerms[0]?.id || '',
    updatedAt: new Date().toISOString(),
  };
  db.studentProfiles.push(sample, { ...sample, userId: otherId });
  const user = (id: string): User => ({
    id, mobile: '09991111000', name: 'آزمون راهنمای دانشجو',
    roles: ['student'], permissions: [], createdAt: new Date().toISOString(),
  });
  db.users.push(user(testId), user(otherId));
  token = 'Bearer ' + generateToken(user(testId));
  otherToken = 'Bearer ' + generateToken(user(otherId));
  chartCourseIds = [...new Set(db.curriculumCourses.filter(cc =>
    cc.curriculumId === chart.id && cc.active !== false && !cc.trackId &&
    db.courses.some(c => c.id === cc.courseId && c.active)
  ).map(cc => cc.courseId))];
  if (chartCourseIds.length < 2) throw new Error('Need two seeded general chart courses');
  db.save();
});

afterAll(() => {
  for (const id of [testId, otherId]) {
    db.data.users = db.users.filter(u => u.id !== id);
    db.data.studentProfiles = db.studentProfiles.filter(p => p.userId !== id);
    db.data.studentPlans = db.studentPlans.filter(p => p.userId !== id);
    db.data.studentPassedCourses = db.studentPassedCourses.filter(p => p.userId !== id);
  }
  db.save();
});

describe('guided enrollment: wishlist separate from authoritative enrollment', () => {
  it('requires authentication for browsing or changing the basket', async () => {
    expect((await request(app).get('/api/student/wishlist/catalog')).status).toBe(401);
    expect((await request(app).put('/api/student/wishlist').send({courseIds: []})).status).toBe(401);
  });

  it('saves a large preference basket without selecting any group or counting official units', async () => {
    const catalog = await request(app).get('/api/student/wishlist/catalog').set('Authorization', token);
    expect(catalog.status).toBe(200);
    const courseIds = catalog.body.data.slice(0, Math.min(22, catalog.body.data.length))
      .map((c: {id: string}) => c.id);
    expect(courseIds.length).toBeGreaterThan(1);
    const saved = await request(app).put('/api/student/wishlist').set('Authorization', token)
      .send({courseIds});
    expect(saved.status).toBe(200);
    expect(saved.body.data.wishlistCourseIds).toEqual(courseIds);
    const plan = await request(app).get('/api/student/plan').set('Authorization', token);
    expect(plan.body.data.wishlistCourseIds).toEqual(courseIds);
    expect(plan.body.data.selectedOfferingIds).toEqual([]);
  });

  it('rejects duplicate, out-of-chart, and invalid wishlist entries without replacing old data', async () => {
    const before = (await request(app).get('/api/student/plan').set('Authorization', token)).body.data.wishlistCourseIds;
    const badIds = [
      [before[0], before[0]],
      ['course-foreign-not-from-this-chart'],
      Array.from({length:201},(_,i)=>String(i)),
    ];
    for (const courseIds of badIds) {
      const res = await request(app).put('/api/student/wishlist').set('Authorization', token).send({courseIds});
      expect(res.status).toBe(400);
    }
    const after = (await request(app).get('/api/student/plan').set('Authorization', token)).body.data.wishlistCourseIds;
    expect(after).toEqual(before);
  });

  it('isolates one user and one term from another user', async () => {
    const other = await request(app).get('/api/student/plan').set('Authorization', otherToken);
    expect(other.status).toBe(200);
    expect(other.body.data.wishlistCourseIds ?? []).toEqual([]);
  });

  it('persists journey position for the authenticated user, without changing other users', async () => {
    expect((await request(app).put('/api/student/journey').set('Authorization', token).send({step: 4})).status).toBe(200);
    const mine = await request(app).get('/api/student/plan').set('Authorization', token);
    const theirs = await request(app).get('/api/student/plan').set('Authorization', otherToken);
    expect(mine.body.data.journeyStep).toBe(4);
    expect(theirs.body.data.journeyStep ?? 0).toBe(0);
    expect((await request(app).put('/api/student/journey').set('Authorization', token).send({step: 7})).status).toBe(400);
  });
});

describe('previously failed prerequisite and independently passed downstream course', () => {
  it('preserves a failed prerequisite and a passed downstream course as different academic facts', async () => {
    const failedId = chartCourseIds[0];
    const passedId = chartCourseIds[1];
    const failed = await request(app).post('/api/student/passed-courses')
      .set('Authorization', token).send({courseId: failedId, grade: 7});
    const passed = await request(app).post('/api/student/passed-courses')
      .set('Authorization', token).send({courseId: passedId, grade: 16});
    expect(failed.status).toBe(200);
    expect(passed.status).toBe(200);
    const history = await request(app).get('/api/student/passed-courses').set('Authorization', token);
    expect(history.body.data.passedCourses.find((x:{courseId:string}) => x.courseId === failedId)?.status).toBe('FAILED');
    expect(history.body.data.passedCourses.find((x:{courseId:string}) => x.courseId === passedId)?.status).toBe('PASSED');
    const passedUnits = db.courses.find(c => c.id === passedId)?.units || 0;
    expect(history.body.data.totalUnits).toBe(passedUnits);
    const retake = await request(app).post('/api/student/passed-courses')
      .set('Authorization', token).send({courseId: failedId, grade: 13});
    expect(retake.status).toBe(200);
    const updated = await request(app).get('/api/student/passed-courses').set('Authorization', token);
    expect(updated.body.data.passedCourses.filter((x:{courseId:string}) => x.courseId === failedId)).toHaveLength(2);
    expect(updated.body.data.totalUnits).toBe(passedUnits + (db.courses.find(c => c.id === failedId)?.units || 0));
  });
});
