import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, type DatabaseSchema } from '../server/db/database';
import { eligibilityRouter } from '../server/routes/eligibility';
import { generateToken } from '../server/middleware/auth';
import type { StudentAcademicProfile, User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/eligibility', eligibilityRouter);

const userId = 'synthetic-exact-chart-student';
let previous: DatabaseSchema;
let auth = '';

beforeAll(async () => { await db.init(true); });

beforeEach(() => {
  previous = db.data;
  const source = previous.curricula.find(c => c.status === 'active');
  const term = previous.academicTerms[0];
  if (!source || !term) throw new Error('Missing synthetic active curriculum fixture');
  const user: User = {
    id: userId, name: 'Synthetic student', mobile: '09900009811',
    roles: ['student'], createdAt: new Date().toISOString(),
  };
  const profile: StudentAcademicProfile = {
    userId, universityId: source.universityId, campusId: source.campusId,
    degreeLevelId: source.degreeLevelId, majorId: source.majorId,
    entryYearId: source.entryYearId, isTrackSelected: false, desiredTrackIds: [],
    currentTermId: term.id, updatedAt: new Date().toISOString(),
  };
  db.data = {
    ...previous,
    users: [user],
    studentProfiles: [profile],
    curricula: [{ ...source }],
    academicTerms: [{ ...term }],
    studentPassedCourses: [],
    courseOfferings: [...previous.courseOfferings],
  };
  auth = 'Bearer ' + generateToken(user);
});

afterEach(() => { db.data = previous; });

const evaluate = () => request(app).post('/api/eligibility/evaluate')
  .set('Authorization', auth).send({});

describe('student-specific curriculum and campus isolation', () => {
  it('evaluates only the exact active chart and keeps the result private', async () => {
    const result = await evaluate();
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body.data.context.curriculum.id).toBe(db.curricula[0].id);
  });

  it('never substitutes a different entry-year chart when the student has no match', async () => {
    db.studentProfiles[0].entryYearId = 'missing-entry-year';
    const result = await evaluate();
    expect(result.status).toBe(400);
    expect(result.body.data?.recommendations).toBeUndefined();
  });

  it('never substitutes another campus or degree even if university, major and year match', async () => {
    db.studentProfiles[0].campusId = 'synthetic-other-campus';
    expect((await evaluate()).status).toBe(400);
    db.studentProfiles[0].campusId = db.curricula[0].campusId;
    db.studentProfiles[0].degreeLevelId = 'synthetic-other-degree';
    expect((await evaluate()).status).toBe(400);
  });

  it('excludes draft charts and flags two active charts instead of picking an arbitrary version', async () => {
    db.curricula[0].status = 'draft';
    expect((await evaluate()).status).toBe(400);
    db.curricula[0].status = 'active';
    db.curricula.push({ ...db.curricula[0], id: 'synthetic-duplicate-active-chart', version: 'duplicate' });
    expect((await evaluate()).status).toBe(409);
  });

  it('never lets offerings from a different campus enter the student eligibility report', async () => {
    const sample = db.courseOfferings[0];
    if (!sample) throw new Error('Missing demo offering');
    db.courseOfferings.push({
      ...sample,
      id: 'synthetic-foreign-campus-offering',
      campusId: 'synthetic-other-campus',
      termId: db.studentProfiles[0].currentTermId!,
      active: true,
    });
    const result = await evaluate();
    expect(result.status).toBe(200);
    expect(result.body.data.report.results.some((o: { offeringId: string }) =>
      o.offeringId === 'synthetic-foreign-campus-offering')).toBe(false);
  });

  it('rejects a stale term ID rather than silently falling back to a sample term', async () => {
    db.studentProfiles[0].currentTermId = 'synthetic-missing-term';
    expect((await evaluate()).status).toBe(400);
  });
});
