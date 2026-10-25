import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { generateToken } from '../server/middleware/auth';
import { syncRouter } from '../server/routes/sync';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/api/sync', syncRouter);

let authHeader = '';
let termId = '';
let campusId = '';
let courseCode = '';
let courseName = '';
const createdJobIds: string[] = [];
const testAdminId = 'test-sync-staging-root';

beforeAll(async () => {
  await db.init(true);
  // Test authorization with a dedicated root fixture, independent of env bootstrap.
  const admin = {
    id: testAdminId, name: 'مدیر مصنوعی همگام‌سازی',
    mobile: '09000000772', roles: ['super-admin'] as ['super-admin'],
    permissions: ['admin.panel.access', 'offering.manage'],
    createdAt: new Date().toISOString(),
  };
  db.data.users = db.users.filter(user => user.id !== testAdminId);
  db.users.push(admin);
  const course = db.courses.find(item => item.active && item.code && item.name);
  if (!course || !db.campuses[0] || !db.academicTerms[0]) {
    throw new Error('Synthetic academic fixtures unavailable');
  }
  authHeader = 'Bearer ' + generateToken(admin);
  courseCode = course.code;
  courseName = course.name;
  termId = db.academicTerms[0].id;
  campusId = db.campuses[0].id;
});

afterAll(() => {
  db.data.users = db.users.filter(user => user.id !== testAdminId);
  const keys = new Set(createdJobIds);
  const batchKeys = new Set(createdJobIds.map(id => `batch-sync-${id}`));
  db.syncJobs = db.syncJobs.filter(job => !keys.has(job.id));
  db.syncSnapshots = db.syncSnapshots.filter(snapshot => !keys.has(snapshot.jobId));
  db.data.importBatches = db.data.importBatches.filter(batch => !batchKeys.has(batch.id));
  db.data.importRecords = db.data.importRecords.filter(record => !batchKeys.has(record.batchId));
  db.save();
});

const validRecord = () => ({
  course: { courseCode, courseName },
  courseClass: {
    courseClassRef: 'SYNTHETIC-CLASS-ABCD1234',
    offeringCode: 'SAMPLE-01',
    group: '93',
    instructor: 'مدرس آزمایشی',
    schedule: 'شنبه 08:00 - 10:00',
    capacity: '30',
  },
});

async function startJob() {
  const created = await request(app).post('/api/sync/jobs')
    .set('Authorization', authHeader).send({ termId, campusId });
  expect(created.status).toBe(201);
  const jobId = created.body.data.id as string;
  createdJobIds.push(jobId);
  return jobId;
}
async function finalChunk(jobId: string, data = [validRecord()]) {
  return request(app).post(`/api/sync/jobs/${jobId}/snapshots`)
    .set('Authorization', authHeader)
    .send({ chunkIndex: 0, isFinal: true, data });
}

describe('student extension sync has a no-autopublish boundary', () => {
  it('stages a complete normalized snapshot for admin review only', async () => {
    const jobId = await startJob();
    const beforeIds = db.courseOfferings.map(item => item.id);
    const completed = await finalChunk(jobId);
    expect(completed.status).toBe(200);
    expect(completed.body.success).toBe(true);
    expect(completed.body.data.jobStatus).toBe('AWAITING_REVIEW');
    expect(completed.body.data.requiresReview).toBe(true);
    expect(completed.body.data.reconciledOfferings).toBe(0);
    expect(completed.body.data.reviewCandidates).toBe(1);
    expect(db.courseOfferings.map(item => item.id)).toEqual(beforeIds);
    const batch = db.importBatches.find(item => item.id === `batch-sync-${jobId}`);
    expect(batch?.matchedRecords).toBe(1);
    const queued = db.importRecords.filter(item => item.batchId === batch?.id);
    expect(queued).toHaveLength(1);
    expect(queued[0].status).toBe('MATCHED');
    expect(queued[0].matchedCourseId).toBeTruthy();
    expect(queued[0].reviewDecision).toBeUndefined();
    expect(db.syncSnapshots.filter(item => item.jobId === jobId)).toHaveLength(0);
    expect(batch?.rawJson).toBeUndefined();

    const again = await finalChunk(jobId);
    expect(again.status).toBe(200);
    expect(again.body.data.duplicate).toBe(true);
    expect(db.importBatches.filter(item => item.id === batch?.id)).toHaveLength(1);
    expect(db.importRecords.filter(item => item.batchId === batch?.id)).toHaveLength(1);
    expect(db.courseOfferings.map(item => item.id)).toEqual(beforeIds);

    const changedRetry = await finalChunk(jobId, [{
      ...validRecord(),
      courseClass: { ...validRecord().courseClass, capacity: '29' },
    }]);
    expect(changedRetry.status).toBe(409);
    expect(db.importBatches.filter(item => item.id === batch?.id)).toHaveLength(1);
    expect(db.courseOfferings.map(item => item.id)).toEqual(beforeIds);

    const wrongRetry = await request(app).post(`/api/sync/jobs/${jobId}/snapshots`)
      .set('Authorization', authHeader).send({ chunkIndex: 1, isFinal: true, data: [validRecord()] });
    expect(wrongRetry.status).toBe(409);
    const state = await request(app).get('/api/sync/state').set('Authorization', authHeader);
    expect(state.body.data.lastSyncStatus).toBe('AWAITING_REVIEW');
  });

  it('rejects malformed source records without publishing anything', async () => {
    const jobId = await startJob();
    const beforeIds = db.courseOfferings.map(item => item.id);
    const completed = await finalChunk(jobId, [{
      ...validRecord(),
      courseClass: { ...validRecord().courseClass, schedule: 'NOT-A-REAL-CLASS-TIME' },
    }]);
    expect(completed.status).toBe(422);
    expect(completed.body.data.jobStatus).toBe('FAILED');
    expect(db.courseOfferings.map(item => item.id)).toEqual(beforeIds);
    expect(db.importBatches.some(item => item.id === `batch-sync-${jobId}`)).toBe(false);
    expect(db.syncSnapshots.filter(item => item.jobId === jobId)).toHaveLength(0);
  });

  it('requires authentication to start a sync session', async () => {
    const result = await request(app).post('/api/sync/jobs').send({ termId, campusId });
    expect(result.status).toBe(401);
  });
});
