import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, type DatabaseSchema } from '../server/db/database';
import { generateToken } from '../server/middleware/auth';
import { MAX_PENDING_SYNC_JOBS_PER_USER, MAX_SYNC_JOB_BYTES, MAX_SYNC_JOB_CHUNKS, syncRouter } from '../server/routes/sync';
import type { User, StudentAcademicProfile, Course } from '../src/types';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/api/sync', syncRouter);
const userId = 'synthetic-atomic-sync-student';
const courseId = 'synthetic-atomic-sync-course';
const code = 'SYNTH-SYNC-ATOMIC-91';
const secret = 'SYNTHETIC_PRIVATE_PATH:/operational/repository.env';
let original: DatabaseSchema;
let token: string;
let termId: string;
let campusId: string;

beforeAll(async () => { await db.init(true); });
beforeEach(() => {
  original = db.data;
  const campus = original.campuses[0];
  const term = original.academicTerms.find(row => row.isCurrent) ?? original.academicTerms[0];
  const chart = original.curricula.find(row => row.status === 'active');
  if (!campus || !term || !chart) throw Error('Missing synthetic seeded academic context');
  termId = term.id;
  campusId = campus.id;
  const user: User = {
    id: userId, mobile: '09900008312', name: 'Synthetic sync student',
    roles: ['student'], createdAt: new Date().toISOString(),
  };
  const profile: StudentAcademicProfile = {
    userId, universityId: campus.universityId, campusId,
    degreeLevelId: chart.degreeLevelId, majorId: chart.majorId, entryYearId: chart.entryYearId,
    isTrackSelected: false, desiredTrackIds: [], currentTermId: termId,
    updatedAt: new Date().toISOString(),
  };
  const course: Course = {
    id: courseId, code, name: 'Synthetic sync independent course',
    units: 2, category: 'تخصصی', active: true,
  };
  db.data = {
    ...original, users: [...original.users, user],
    studentProfiles: [...original.studentProfiles, profile],
    courses: [...original.courses, course],
    syncJobs: [], syncSnapshots: [],
    importBatches: [...original.importBatches],
    importRecords: [...original.importRecords],
  };
  token = 'Bearer ' + generateToken(user);
});
afterEach(() => { vi.restoreAllMocks(); db.data = original; });

const record = () => ({
  course: { courseCode: code, courseName: 'Synthetic sync independent course' },
  courseClass: {
    courseClassRef: 'SYNTHETIC-ATOMIC-SOURCE-91',
    offeringCode: 'SYN-91',
    group: '91',
    instructor: 'Synthetic teacher',
    schedule: 'شنبه 08:00 - 10:00',
    capacity: '30',
  },
});
const start = () => request(app).post('/api/sync/jobs').set('Authorization', token).send({ termId, campusId });
const chunk = (jobId: string, chunkIndex: number, isFinal: boolean, data = [record()]) =>
  request(app).post('/api/sync/jobs/' + jobId + '/snapshots').set('Authorization', token)
    .send({ chunkIndex, isFinal, data });
const failSave = () => vi.spyOn(db, 'save').mockImplementationOnce(() => { throw Error(secret); });
const redacted = (response: { body: unknown; status: number }) => {
  expect(response.status).toBe(503);
  expect(JSON.stringify(response.body)).not.toContain(secret);
};

describe('durable, private and idempotent extension sync staging', () => {
  it('does not expose a sync job that was never persisted', async () => {
    const before = JSON.stringify(db.syncJobs);
    const spy = failSave();
    const response = await start();
    spy.mockRestore();
    redacted(response);
    expect(JSON.stringify(db.syncJobs)).toBe(before);
    expect(db.syncSnapshots).toHaveLength(0);
  });

  it('rolls back an unsaved nonfinal chunk and permits a valid retry', async () => {
    const jobId = (await start()).body.data.id as string;
    const before = JSON.stringify(db.syncJobs);
    const spy = failSave();
    const response = await chunk(jobId, 0, false);
    spy.mockRestore();
    redacted(response);
    expect(JSON.stringify(db.syncJobs)).toBe(before);
    expect(db.syncSnapshots).toHaveLength(0);
    const retry = await chunk(jobId, 0, false);
    expect(retry.status).toBe(200);
    expect(db.syncSnapshots.filter(s => s.jobId === jobId)).toHaveLength(1);
    expect(db.syncJobs.find(j => j.id === jobId).processedSnapshots).toBe(1);
  });

  it('does not leave a finished job, private chunk or partial review batch on final save failure', async () => {
    const jobId = (await start()).body.data.id as string;
    const beforeJobs = JSON.stringify(db.syncJobs);
    const batchCount = db.importBatches.length, recordCount = db.importRecords.length;
    const offeringIds = db.courseOfferings.map(o => o.id);
    const spy = failSave();
    const response = await chunk(jobId, 0, true);
    spy.mockRestore();
    redacted(response);
    expect(JSON.stringify(db.syncJobs)).toBe(beforeJobs);
    expect(db.syncSnapshots).toHaveLength(0);
    expect(db.importBatches).toHaveLength(batchCount);
    expect(db.importRecords).toHaveLength(recordCount);
    expect(db.courseOfferings.map(o => o.id)).toEqual(offeringIds);
    const retry = await chunk(jobId, 0, true);
    expect(retry.status).toBe(200);
    expect(retry.body.data.jobStatus).toBe('AWAITING_REVIEW');
    expect(db.importBatches.filter(row => row.id === 'batch-sync-' + jobId)).toHaveLength(1);
    expect(db.importRecords.filter(row => row.batchId === 'batch-sync-' + jobId)).toHaveLength(1);
    expect(db.syncSnapshots).toHaveLength(0);
    expect(db.courseOfferings.map(o => o.id)).toEqual(offeringIds);
    const repeated = await chunk(jobId, 0, true);
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.duplicate).toBe(true);
  });

  it('rolls back existing final-chunk retry when its reconciliation save fails', async () => {
    const jobId = (await start()).body.data.id as string;
    const first = await chunk(jobId, 0, false);
    expect(first.status).toBe(200);
    const beforeJobs = JSON.stringify(db.syncJobs);
    const beforeSnapshots = JSON.stringify(db.syncSnapshots);
    const batchCount = db.importBatches.length, recordCount = db.importRecords.length;
    const spy = failSave();
    const response = await chunk(jobId, 0, true);
    spy.mockRestore();
    redacted(response);
    expect(JSON.stringify(db.syncJobs)).toBe(beforeJobs);
    expect(JSON.stringify(db.syncSnapshots)).toBe(beforeSnapshots);
    expect(db.importBatches).toHaveLength(batchCount);
    expect(db.importRecords).toHaveLength(recordCount);
    const successful = await chunk(jobId, 0, true);
    expect(successful.status).toBe(200);
    expect(successful.body.data.jobStatus).toBe('AWAITING_REVIEW');
    expect(db.syncSnapshots).toHaveLength(0);
    expect(db.importBatches.filter(b => b.id === 'batch-sync-' + jobId)).toHaveLength(1);
  });

  it('commits rejected records only as a failed job, never as published offerings', async () => {
    const jobId = (await start()).body.data.id as string;
    const beforePublished = db.courseOfferings.map(o => o.id);
    const invalid = [{
      ...record(),
      courseClass: { ...record().courseClass, schedule: 'INVALID-TIME' },
    }];
    const spy = failSave();
    const denied = await chunk(jobId, 0, true, invalid);
    spy.mockRestore();
    redacted(denied);
    expect(db.syncJobs.find(j => j.id === jobId)?.status).toBe('RUNNING');
    expect(db.syncSnapshots).toHaveLength(0);
    const saved = await chunk(jobId, 0, true, invalid);
    expect(saved.status).toBe(422);
    expect(db.syncJobs.find(j => j.id === jobId)?.status).toBe('FAILED');
    expect(db.courseOfferings.map(o => o.id)).toEqual(beforePublished);
  });
  it('bounds chunk indices and total unreviewed private payloads', async () => {
    const jobId = (await start()).body.data.id as string;
    const tooManyChunks = await chunk(jobId, MAX_SYNC_JOB_CHUNKS, false);
    expect(tooManyChunks.status).toBe(413);
    expect(db.syncSnapshots).toHaveLength(0);

    const each = Math.ceil(MAX_SYNC_JOB_BYTES / 9);
    for (let i=0; i<9; i++) db.syncSnapshots.push({
      id:'synthetic-existing-big-'+i,jobId,chunkIndex:i,
      data:[{payload:'a'.repeat(each)}],createdAt:new Date().toISOString(),
    });
    const original = JSON.stringify(db.syncJobs);
    const overflow = await chunk(jobId, 9, false);
    expect(overflow.status).toBe(413);
    expect(JSON.stringify(db.syncJobs)).toBe(original);
    expect(db.syncSnapshots.filter(s => s.jobId === jobId)).toHaveLength(9);
  });

  it('does not allow an account to create unbounded abandoned sync jobs', async () => {
    for (let i=0;i<MAX_PENDING_SYNC_JOBS_PER_USER;i++) {
      db.syncJobs.push({
        id:'synthetic-abandoned-job-'+i,userId,termId,campusId,
        status:'RUNNING',startedAt:new Date().toISOString(),
        totalSnapshots:0,processedSnapshots:0,
      });
    }
    const before=db.syncJobs.length;
    const response=await start();
    expect(response.status).toBe(429);
    expect(db.syncJobs).toHaveLength(before);
  });

});
