import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { adminRouter } from '../server/routes/admin';
import { importsRouter } from '../server/routes/imports';
import { generateToken } from '../server/middleware/auth';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/api/admin', adminRouter);
app.use('/api/imports', importsRouter);

const delegateId = 'synthetic-backup-permission-delegate';
let rootAuth = '';
let delegateAuth = '';

beforeAll(async () => {
  await db.init(true);
  const owner = db.users.find(u => u.id === 'usr-super');
  if (!owner) throw new Error('Verified isolated root fixture missing');
  rootAuth = 'Bearer ' + generateToken(owner);

  const user = {
    id: delegateId, name: 'Synthetic backup delegate', mobile: '09900006781',
    roles: ['student', 'admin'] as Array<'student' | 'admin'>,
    permissions: ['admin.panel.access', 'backup.manage', 'offering.manage'],
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  delegateAuth = 'Bearer ' + generateToken(user);
});

afterAll(() => {
  db.data.users = db.users.filter(u => u.id !== delegateId);
  db.save();
});

describe('backups and import exceptions cannot leak private student data', () => {
  it('blocks a delegated admin even if legacy backup.manage is granted', async () => {
    const download = await request(app).get('/api/admin/backup')
      .set('Authorization', delegateAuth);
    expect(download.status).toBe(403);
    expect(download.body.data).toBeUndefined();
    const restore = await request(app).post('/api/admin/restore')
      .set('Authorization', delegateAuth).send({ courses: [] });
    expect(restore.status).toBe(403);
    expect(restore.body.data).toBeUndefined();
  });

  it('keeps verified root backup and restore validation available', async () => {
    const exportResult = await request(app).get('/api/admin/backup')
      .set('Authorization', rootAuth);
    expect(exportResult.status).toBe(200);
    expect(exportResult.headers['cache-control']).toContain('no-store');
    expect(exportResult.body.users).toBeDefined();
    const invalidRestore = await request(app).post('/api/admin/restore')
      .set('Authorization', rootAuth).send({});
    expect(invalidRestore.status).toBe(400);
  });

  it('redacts unexpected import failures rather than returning file paths or secrets', async () => {
    const course = db.courses.find(c => c.active);
    const term = db.academicTerms[0];
    const campus = db.campuses[0];
    if (!course || !term || !campus) throw new Error('Missing synthetic academic catalog');

    const existingBatches = db.importBatches.slice();
    const existingRecords = db.importRecords.slice();
    const secret = 'SYNTHETIC_PRIVATE_MARKER:/etc/darschin/private.env';
    const spy = vi.spyOn(db, 'save').mockImplementationOnce(() => {
      throw new Error(secret);
    });
    try {
      const result = await request(app).post('/api/imports/process')
        .set('Authorization', delegateAuth)
        .send({
          payload: { schemaVersion: '1.0', records: [{
            courseCode: course.code,
            courseName: course.name,
            group: '09',
            day: 'شنبه', startTime: '08:00', endTime: '10:00',
          }] },
          termId: term.id, campusId: campus.id,
        });
      expect(result.status).toBe(500);
      expect(JSON.stringify(result.body)).not.toContain(secret);
      expect(result.body.error).toBe('ذخیرهٔ فایل واردشده ناموفق بود؛ لطفاً بعداً دوباره تلاش کنید.');
    } finally {
      spy.mockRestore();
      db.data.importBatches = existingBatches;
      db.data.importRecords = existingRecords;
    }
  });
});
