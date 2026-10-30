import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, type DatabaseSchema } from '../server/db/database';
import { studentRouter } from '../server/routes/student';
import { generateToken } from '../server/middleware/auth';
import { updateProfileSchema } from '../server/schemas/student';
import type { StudentAcademicProfile, User } from '../src/types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const app = express();
app.use(express.json());
app.use('/api/student', studentRouter);

const existingId = 'test-profile-preserve-scoped-20261030';
const freshId = 'test-profile-first-login-20261030';
const auth = (id: string) => ({ Authorization: 'Bearer ' + generateToken({ id }) });
let original: DatabaseSchema;
let initial: StudentAcademicProfile;

beforeAll(async () => {
  await db.init(true);
  original = db.data;
  const chart = original.curricula.find(c => c.status === 'active');
  if (!chart) throw new Error('A synthetic active chart is required');
  const term = original.academicTerms.find(t => t.isCurrent)?.id || original.academicTerms[0]?.id;
  initial = {
    userId: existingId,
    universityId: chart.universityId,
    provinceId: 'province-synthetic',
    campusId: chart.campusId,
    degreeLevelId: chart.degreeLevelId,
    majorId: chart.majorId,
    entryYearId: chart.entryYearId,
    isTrackSelected: true,
    selectedTrackId: 'track-synthetic',
    desiredTrackIds: ['interest-track-synthetic'],
    currentTermId: term,
    previousTermGpa: 16.5,
    studentNumber: 'SYNTHETIC-STUDENT-ID',
    isFinalSemesterOverride: true,
    finalSemesterNotes: 'synthetic admin-only note',
    updatedAt: new Date().toISOString(),
  };
  const makeUser = (id: string, mobile: string): User => ({
    id, mobile, name: 'Synthetic student',
    roles: ['student'], permissions: [], createdAt: new Date().toISOString(),
  });
  db.data = {
    ...original,
    users: [...original.users, makeUser(existingId, '09901117777'), makeUser(freshId, '09901117778')],
    studentProfiles: [...original.studentProfiles, initial],
  };
});
afterAll(() => { db.data = original; db.save(); });

describe('the student academic identity survives partial edits', () => {
  it('updates only the requested GPA and preserves education, province, track, ID and admin-only fields', async () => {
    const response = await request(app).put('/api/student/profile').set(auth(existingId))
      .send({ previousTermGpa: 18.25 });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body.data).toMatchObject({
      userId: existingId,
      universityId: initial.universityId,
      provinceId: initial.provinceId,
      campusId: initial.campusId,
      degreeLevelId: initial.degreeLevelId,
      majorId: initial.majorId,
      entryYearId: initial.entryYearId,
      isTrackSelected: true,
      selectedTrackId: initial.selectedTrackId,
      desiredTrackIds: initial.desiredTrackIds,
      studentNumber: initial.studentNumber,
      isFinalSemesterOverride: true,
      finalSemesterNotes: initial.finalSemesterNotes,
      previousTermGpa: 18.25,
    });
    const fetched = await request(app).get('/api/student/profile').set(auth(existingId));
    expect(fetched.body.data.profile.previousTermGpa).toBe(18.25);
    expect(fetched.headers['cache-control']).toBe('private, no-store');
  });

  it('honors explicit null GPA/province and track deselection without resetting the other scope', async () => {
    const response = await request(app).put('/api/student/profile').set(auth(existingId))
      .send({ provinceId: null, previousTermGpa: null, isTrackSelected: false });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      provinceId: null, previousTermGpa: null,
      isTrackSelected: false, selectedTrackId: null,
      majorId: initial.majorId, entryYearId: initial.entryYearId,
      isFinalSemesterOverride: true,
    });
    expect(updateProfileSchema.safeParse({ provinceId: null }).success).toBe(true);
  });

  it('does not silently infer campus, degree, major, entry year or track for a brand-new student', async () => {
    const response = await request(app).get('/api/student/profile').set(auth(freshId));
    expect(response.status).toBe(200);
    const { profile, curriculum } = response.body.data;
    expect(profile.userId).toBe(freshId);
    expect(profile.campusId).toBe('');
    expect(profile.degreeLevelId).toBe('');
    expect(profile.majorId).toBe('');
    expect(profile.entryYearId).toBe('');
    expect(profile.desiredTrackIds).toEqual([]);
    expect(curriculum).toBeNull();
  });

  it('hydrates the academic modal with the previously saved GPA and province rather than clearing them', () => {
    const code = readFileSync(resolve(process.cwd(), 'src/components/AcademicProfileModal.tsx'), 'utf8');
    expect(code).toContain("setProvinceId(p.provinceId || '')");
    expect(code).toContain("setPreviousTermGpa(p.previousTermGpa == null ? '' : String(p.previousTermGpa))");
    expect(code).toContain("previousTermGpa.trim() === '' ? null : Number(previousTermGpa)");
    expect(code).toContain('provinces: Province[]');
    expect(code).not.toContain("universityId || 'univ-azad'");
  });
});
