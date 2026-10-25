import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { generateToken } from '../server/middleware/auth';
import { offeringsRouter } from '../server/routes/offerings';

const app = express();
app.use(express.json());
app.use('/api/offerings', offeringsRouter);
const adminId = 'test-flexible-offering-admin';
const createdIds: string[] = [];
let token = '';
let termId = '';
let campusId = '';
let courseId = '';

beforeAll(async () => {
  await db.init(true);
  const fakeAdmin = {
    id: adminId,
    mobile: '09000000847',
    name: 'مدیر ساختگی تست ساعت',
    roles: ['super-admin'] as ['super-admin'],
    permissions: ['offering.manage'],
    createdAt: new Date().toISOString(),
  };
  db.data.users = db.users.filter(user => user.id !== adminId);
  db.users.push(fakeAdmin);
  token = 'Bearer ' + generateToken(fakeAdmin);
  termId = db.academicTerms[0].id;
  campusId = db.campuses[0].id;
  courseId = db.courses.find(c => c.active)?.id || '';
  if (!termId || !campusId || !courseId) throw new Error('Synthetic academic fixtures missing');
});
afterAll(() => {
  db.data.users = db.users.filter(u => u.id !== adminId);
  db.data.courseOfferings = db.courseOfferings.filter(row => !createdIds.includes(row.id));
  db.save();
});
const base = () => ({
  termId, campusId, courseId,
  groupCode: '97', instructor: 'استاد آزمایشی',
  capacity: 35,
});

describe('manager-created offerings accept unannounced times without invented slots', () => {
  it('never allows public writes without real authorization', async () => {
    const response = await request(app).post('/api/offerings').send(base());
    expect(response.status).toBe(401);
  });

  it('preserves a class with no day/time and allows exact minute updates or clearing later', async () => {
    const response = await request(app).post('/api/offerings')
      .set('Authorization', token).send(base());
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const item = response.body.data;
    createdIds.push(item.id);
    expect(item.startTime).toBe('');
    expect(item.endTime).toBe('');
    expect(item.dayOfWeek).toBe('');
    expect(item.enrolledCountKnown).toBe(false);
    const known = await request(app).put('/api/offerings/' + item.id)
      .set('Authorization', token)
      .send({ dayOfWeek: 'جمعه', startTime: '۰۷:۳۵', endTime: '۲۰:۰۰' });
    expect(known.status).toBe(200);
    expect(known.body.data.startTime).toBe('07:35');
    expect(known.body.data.endTime).toBe('20:00');
    const cleared = await request(app).put('/api/offerings/' + item.id)
      .set('Authorization', token).send({ dayOfWeek: '', startTime: '', endTime: '' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.startTime).toBe('');
    const listing = await request(app).get('/api/offerings').query({ termId, campusId });
    expect(listing.status).toBe(200);
    expect(listing.body.data.some((row: { id: string }) => row.id === item.id)).toBe(true);
  });

  it('rejects half-entered and inverted times, invalid capacities and nonexistent curriculum data atomically', async () => {
    const create = await request(app).post('/api/offerings')
      .set('Authorization', token)
      .send({ ...base(), groupCode: '98', startTime: '07:15', endTime: '08:25' });
    expect(create.status).toBe(200);
    const saved = create.body.data;
    createdIds.push(saved.id);
    for (const payload of [
      { startTime: '08:00', endTime: '' },
      { startTime: '11:00', endTime: '10:00' },
      { startTime: '24:15', endTime: '25:00' },
      { capacity: -4 },
      { capacity: 2, enrolledCount: 5 },
      { courseId: 'non-existent-course' },
    ]) {
      const rejected = await request(app).put('/api/offerings/' + saved.id)
        .set('Authorization', token).send(payload);
      expect(rejected.status).toBe(400);
      expect(db.courseOfferings.find(row => row.id === saved.id)).toMatchObject({
        startTime: '07:15', endTime: '08:25', capacity: 30,
      });
    }
  });
});
