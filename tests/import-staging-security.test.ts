import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { importsRouter } from '../server/routes/imports';
import { generateToken } from '../server/middleware/auth';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/api/imports', importsRouter);

const madeBatchIds: string[] = [];
let authHeader = '';
let campusId = '';
let termId = '';
let code = '';
let courseName = '';

beforeAll(async () => {
  await db.init(true);
  const root = db.users.find(user => user.roles?.includes('super-admin'));
  if (!root) throw new Error('Synthetic root fixture missing');
  authHeader = 'Bearer ' + generateToken(root);
  const course = db.courses.find(item => item.active);
  if (!course || !db.campuses[0] || !db.academicTerms[0]) {
    throw new Error('Synthetic academic fixtures missing');
  }
  code = course.code;
  courseName = course.name;
  campusId = db.campuses[0].id;
  termId = db.academicTerms[0].id;
});

afterAll(() => {
  if (!madeBatchIds.length) return;
  db.data.importBatches = db.data.importBatches.filter(batch => !madeBatchIds.includes(batch.id));
  db.data.importRecords = db.data.importRecords.filter(record => !madeBatchIds.includes(record.batchId));
  db.save();
});

describe('authenticated import preview can never publish offerings', () => {
  it('requires a real signed-in user', async () => {
    const response = await request(app).post('/api/imports/process').send({
      payload: { records: [{ courseCode: 'X' }] },
      campusId, termId,
    });
    expect(response.status).toBe(401);
  });

  it('accepts the object the UI submits, stores a review batch, not global offerings', async () => {
    const before = db.courseOfferings.map(o => o.id);
    const payload = { schemaVersion: '1.0', records: [{
      courseCode: code, courseName, group: '91',
      instructor: 'مدرس آزمایشی', day: 'شنبه',
      startTime: '08:00', endTime: '10:00',
      capacity: 30, availableCapacity: 9,
    }] };
    const response = await request(app).post('/api/imports/process')
      .set('Authorization', authHeader).send({ payload, termId, campusId });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.requiresReview).toBe(true);
    expect(response.body.data.createdOfferingsCount).toBe(0);
    expect(response.body.data.batch.rawJson).toBeUndefined();
    madeBatchIds.push(response.body.data.batch.id);
    expect(db.courseOfferings.map(o => o.id)).toEqual(before);
    expect(db.importRecords.some(record => record.batchId === response.body.data.batch.id)).toBe(true);
  });

  it('reviews course matches with an audit trail, never publishing an offering', async () => {
    const upload = await request(app).post('/api/imports/process')
      .set('Authorization', authHeader).send({
        payload: { records: [{ courseCode: code, courseName, group: '51',
          instructor: 'مدرس ساختگی', day: 'شنبه', startTime: '09:00',
          endTime: '11:00', capacity: 25 }] },
        termId, campusId,
      });
    expect(upload.status).toBe(200);
    const batchId = upload.body.data.batch.id;
    const recordId = upload.body.data.records[0].id;
    madeBatchIds.push(batchId);
    const initialOfferings = db.courseOfferings.map(o => o.id);
    const beforeAudit = db.auditLogs.length;
    const endpoint = `/api/imports/batches/${batchId}/records/${recordId}/review`;
    const missingReason = await request(app).put(endpoint)
      .set('Authorization', authHeader).send({
        action: 'CONFIRM_MATCH', courseId: db.courses[0].id, reason: 'x',
      });
    expect(missingReason.status).toBe(400);
    const confirmed = await request(app).put(endpoint)
      .set('Authorization', authHeader).send({
        action: 'CONFIRM_MATCH', courseId: db.courses[0].id,
        reason: 'شناسه و نام درس در کاتالوگ با نمونه بررسی شد.',
      });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.reviewDecision).toBe('COURSE_MATCH_CONFIRMED');
    expect(confirmed.body.publicationStatus).toBe('NOT_PUBLISHED');
    expect(db.courseOfferings.map(o => o.id)).toEqual(initialOfferings);
    expect(db.auditLogs.length).toBe(beforeAudit + 1);
    expect(db.auditLogs.at(-1)?.entityId).toBe(recordId);
    const denied = await request(app).put(endpoint)
      .set('Authorization', authHeader).send({
        action: 'CONFIRM_MATCH', courseId: 'unknown-course',
        reason: 'شناسه درس در کاتالوگ وجود ندارد و قابل انتخاب نیست.',
      });
    expect(denied.status).toBe(400);
    const rejected = await request(app).put(endpoint)
      .set('Authorization', authHeader).send({
        action: 'REJECT_MATCH', reason: 'نام و کد این رکورد با اسناد معتبر تطابق ندارند.',
      });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.reviewDecision).toBe('REJECTED');
    expect(rejected.body.data.matchedCourseId).toBeNull();
    expect(db.courseOfferings.map(o => o.id)).toEqual(initialOfferings);
  });

  it('refuses to treat arbitrary campus IDs as a valid imported term context', async () => {
    const response = await request(app).post('/api/imports/process')
      .set('Authorization', authHeader)
      .send({ payload: { records: [{ courseCode: code, courseName }] },
        termId, campusId: 'unknown-campus' });
    expect(response.status).toBe(400);
  });
});
