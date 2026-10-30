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


describe('student track selector is accessible and bounded to the selected major',()=>{
  it('supports a track-free major and invalidates stale track choices when major or degree changes',()=>{
    const code=readFileSync(resolve(process.cwd(),'src/components/AcademicProfileModal.tsx'),'utf8');
    expect(code).toContain('filteredTracks.length > 0 &&');
    expect(code).toContain('validTrackIds.has(id)');
    expect(code).toContain('desiredTrackIds.filter(id => validTrackIds.has(id))');
    expect(code).toContain('setSelectedTrackId(\'\');');
    expect(code).toContain('setDesiredTrackIds([]);');
    expect(code).toContain('onChange={() => toggleDesiredTrack(track.id)}');
    expect(code).not.toContain('onChange={() => {}}');
    expect(code).toContain('برای این رشته گرایشی تعریف نشده');
  });
});


describe('new academic profile reference boundaries',()=>{
  it('rejects nonexistent campus, major, term or track without changing the stored record',async()=>{
    const previous=JSON.stringify(db.studentProfiles.find(p=>p.userId===existingId));
    const invalid=[
      {campusId:'missing-campus-xyz'},
      {majorId:'missing-major-xyz'},
      {degreeLevelId:'missing-degree-xyz'},
      {entryYearId:'missing-year-xyz'},
      {currentTermId:'missing-term-xyz'},
      {isTrackSelected:true,selectedTrackId:'foreign-or-disabled-track'},
      {isTrackSelected:false,desiredTrackIds:['foreign-or-disabled-track']},
    ];
    for(const body of invalid){
      const result=await request(app).put('/api/student/profile').set(auth(existingId)).send(body);
      expect(result.status,JSON.stringify(body)).toBe(400);
      expect(JSON.stringify(db.studentProfiles.find(p=>p.userId===existingId))).toBe(previous);
    }
  });

  it('still saves a GPA-only edit without resetting the old academic identity',async()=>{
    const scope=db.studentProfiles.find(p=>p.userId===existingId)!;
    const originalScope={campusId:scope.campusId,majorId:scope.majorId,entryYearId:scope.entryYearId};
    const response=await request(app).put('/api/student/profile').set(auth(existingId))
      .send({previousTermGpa:17.25});
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({...originalScope,previousTermGpa:17.25});
  });

  it('actually loads provinces from metadata into the editable selector',()=>{
    const source=readFileSync(resolve(process.cwd(),'src/components/AcademicProfileModal.tsx'),'utf8');
    expect(source).toContain('setProvinces(metaRes.data.provinces || [])');
    expect(source).toContain("setCampusId('');");
  });
});


describe('private student routes and active selector constraints',()=>{
  it('prevents shared caching even on sensitive GET and unauthorized responses',async()=>{
    const allowed=await request(app).get('/api/student/passed-courses').set(auth(existingId));
    expect(allowed.status).toBe(200);
    expect(allowed.headers['cache-control']).toBe('private, no-store');
    const denied=await request(app).get('/api/student/passed-courses');
    expect(denied.status).toBe(401);
    expect(denied.headers['cache-control']).toBe('private, no-store');
  });
  it('filters inactive campus, degree, major, track, year and term metadata in the student form',()=>{
    const source=readFileSync(resolve(process.cwd(),'src/components/AcademicProfileModal.tsx'),'utf8');
    expect(source).toContain('c.active !== false');
    expect(source).toContain('m.active !== false');
    expect(source).toContain('t.active !== false');
    expect(source).toContain('c.provinceId === provinceId');
    expect(source).toContain('degreeLevels.filter(d => d.active !== false)');
    expect(source).toContain('entryYears.filter(y => y.active !== false)');
    expect(source).toContain('terms.filter(t => t.active !== false)');
  });
});
