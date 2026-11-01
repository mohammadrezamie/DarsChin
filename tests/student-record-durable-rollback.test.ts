import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, type DatabaseSchema } from '../server/db/database';
import { generateToken } from '../server/middleware/auth';
import { studentRouter } from '../server/routes/student';
import type { StudentAcademicProfile, User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/student', studentRouter);

const id = 'synthetic-student-durable-profile';
const otherId = 'synthetic-other-durable-profile';
const secret = 'SYNTHETIC_SECRET:/internal/production/db.json';
let original: DatabaseSchema;
let token: string;
let courseIds: string[];

beforeAll(async () => {
  await db.init(true);
  courseIds = db.courses.filter(c => c.active).slice(0, 3).map(c => c.id);
  if (courseIds.length < 3) throw new Error('Missing three sample courses');
});

beforeEach(() => {
  original = db.data;
  const chart = original.curricula.find(c => c.status === 'active');
  if (!chart) throw new Error('Missing sample chart');
  const user: User = {
    id, mobile: '09900009721', name: 'Synthetic durable student',
    roles: ['student'], createdAt: new Date().toISOString(),
  };
  const other: User = { ...user, id: otherId, mobile: '09900009722' };
  const profile: StudentAcademicProfile = {
    userId: id, universityId: chart.universityId, campusId: chart.campusId,
    degreeLevelId: chart.degreeLevelId, majorId: chart.majorId,
    entryYearId: chart.entryYearId, isTrackSelected: false, desiredTrackIds: [],
    currentTermId: original.academicTerms[0]?.id, updatedAt: new Date().toISOString(),
  };
  db.data = {
    ...original, users: [user, other], studentProfiles: [profile],
    studentPassedCourses: [
      { id: 'synthetic-passed', userId: id, courseId: courseIds[0], status: 'PASSED', grade: 16, passedAt: '2026-01-01' },
      { id: 'synthetic-failed', userId: id, courseId: courseIds[1], status: 'FAILED', grade: 4, passedAt: '2026-01-02' },
      { id: 'synthetic-other', userId: otherId, courseId: courseIds[2], status: 'PASSED', grade: 18, passedAt: '2026-01-03' },
    ],
  };
  token = 'Bearer ' + generateToken(user);
});

afterEach(() => {
  vi.restoreAllMocks();
  db.data = original;
});

function failNextSave() {
  return vi.spyOn(db, 'save').mockImplementationOnce(() => { throw new Error(secret); });
}
function assertNoLeak(response: { status: number; body: unknown }) {
  expect(response.status).toBe(500);
  expect(JSON.stringify(response.body)).not.toContain(secret);
}

describe('student academic records must not mutate on failed durable persistence', () => {
  it('rolls back a profile edit while retaining academic identity fields', async () => {
    const snapshot = JSON.stringify(db.studentProfiles);
    const spy = failNextSave();
    const result = await request(app).put('/api/student/profile').set('Authorization', token)
      .send({ universityId: 'changed-university', campusId: 'changed-campus', majorId: 'changed-major',
        degreeLevelId: 'changed-level', entryYearId: 'changed-year', isTrackSelected: false });
    spy.mockRestore();
    assertNoLeak(result);
    expect(JSON.stringify(db.studentProfiles)).toBe(snapshot);
  });

  it('does not create an unsaved default profile on the first profile read', async () => {
    db.data.studentProfiles = [];
    const spy = failNextSave();
    const result = await request(app).get('/api/student/profile').set('Authorization', token);
    spy.mockRestore();
    assertNoLeak(result);
    expect(db.studentProfiles).toHaveLength(0);
  });

  it('rolls back a newly recorded course attempt without affecting earlier failures or other students', async () => {
    const snapshot = JSON.stringify(db.studentPassedCourses);
    const spy = failNextSave();
    const result = await request(app).post('/api/student/passed-courses')
      .set('Authorization', token).send({ courseId: courseIds[1], grade: 13, status: 'PASSED' });
    spy.mockRestore();
    assertNoLeak(result);
    expect(JSON.stringify(db.studentPassedCourses)).toBe(snapshot);
  });

  it('rolls back a bulk replacement including removed passes and new rows', async () => {
    const snapshot = JSON.stringify(db.studentPassedCourses);
    const spy = failNextSave();
    const result = await request(app).post('/api/student/passed-courses/batch')
      .set('Authorization', token).send({ courseIds: [courseIds[2]], replaceAll: true });
    spy.mockRestore();
    assertNoLeak(result);
    expect(JSON.stringify(db.studentPassedCourses)).toBe(snapshot);
  });

  it('restores the exact deleted row and order on failed storage', async () => {
    const snapshot = JSON.stringify(db.studentPassedCourses);
    const spy = failNextSave();
    const result = await request(app).delete('/api/student/passed-courses/synthetic-passed')
      .set('Authorization', token);
    spy.mockRestore();
    assertNoLeak(result);
    expect(JSON.stringify(db.studentPassedCourses)).toBe(snapshot);
  });
});
