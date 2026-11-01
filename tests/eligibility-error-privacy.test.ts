import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { eligibilityRouter } from '../server/routes/eligibility';
import { generateToken } from '../server/middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/eligibility', eligibilityRouter);
const userId = 'synthetic-eligibility-error-privacy';
let auth = '';
let fixtureInstalled = false;

beforeAll(async () => {
  await db.init(true);
  const curriculum = db.curricula[0];
  if (!curriculum) throw new Error('Missing synthetic curriculum');
  db.users.push({
    id: userId, mobile: '09900005579', name: 'Synthetic Security Student',
    roles: ['student'], createdAt: new Date().toISOString(),
  });
  db.studentProfiles.push({
    userId,
    universityId: curriculum.universityId,
    campusId: curriculum.campusId,
    degreeLevelId: curriculum.degreeLevelId,
    majorId: curriculum.majorId,
    entryYearId: curriculum.entryYearId,
    isTrackSelected: false,
    desiredTrackIds: [],
    updatedAt: new Date().toISOString(),
  });
  auth = 'Bearer ' + generateToken({ id: userId });
  fixtureInstalled = true;
});

afterAll(() => {
  vi.restoreAllMocks();
  if (fixtureInstalled) {
    db.data.users = db.users.filter(user => user.id !== userId);
    db.data.studentProfiles = db.studentProfiles.filter(profile => profile.userId !== userId);
    db.save();
  }
});

describe('private student evaluation response hardening', () => {
  it('requires a logged-in identity and rejects hostile/non-array evaluation parameters', async () => {
    expect((await request(app).post('/api/eligibility/evaluate').send({ plannedCourseIds: [] })).status).toBe(401);
    for (const invalid of [
      { plannedCourseIds: { injected: true } },
      { plannedCourseIds: [null] },
      { plannedCourseIds: [123] },
      { plannedCourseIds: [''] },
      { plannedCourseIds: Array.from({ length: 101 }, (_, i) => 'course-' + i) },
    ]) {
      const res = await request(app).post('/api/eligibility/evaluate')
        .set('Authorization', auth).send(invalid);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false });
      expect(JSON.stringify(res.body)).not.toContain('stack');
    }
  });

  it('never leaks filesystem paths or internal exception details in HTTP 500', async () => {
    const privateMarker = 'SYNTHETIC_SECRET_MARKER:/private/runtime/darschyn-db.json';
    const spy = vi.spyOn(db, 'calculateStudentAcademicLimits').mockImplementationOnce(() => {
      throw new Error(privateMarker);
    });
    try {
      const res = await request(app).post('/api/eligibility/evaluate')
        .set('Authorization', auth).send({ plannedCourseIds: [] });
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({
        success: false,
        error: 'ارزیابی دروس با خطای داخلی مواجه شد.',
      });
      expect(JSON.stringify(res.body)).not.toContain(privateMarker);
      expect(JSON.stringify(res.body)).not.toContain('/private/runtime/');
    } finally {
      spy.mockRestore();
    }
  });
});
