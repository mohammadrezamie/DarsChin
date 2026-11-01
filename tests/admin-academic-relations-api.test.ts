import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { academicRouter } from '../server/routes/academic';
import { generateToken } from '../server/middleware/auth';
import type { User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/academic', academicRouter);

const marker = 'admin-relations-integrity-20261029';
const testAdminId = marker + '-admin';
const created = { campus: '', major: '', track: '' };
let auth = '';

beforeAll(async () => {
  await db.init(true);
  const user: User = {
    id: testAdminId, name: 'مدیر آزمایشی ارتباط‌ها', mobile: '09999988045',
    roles: ['admin'], permissions: ['system.settings.manage'],
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  auth = 'Bearer ' + generateToken(user);
  db.save();
});

afterAll(() => {
  db.data.users = db.users.filter(user => user.id !== testAdminId);
  db.data.campuses = db.campuses.filter(value => value.id !== created.campus);
  db.data.majors = db.majors.filter(value => value.id !== created.major);
  db.data.tracks = db.tracks.filter(value => value.id !== created.track);
  db.save();
});

describe('admin academic relation integrity', () => {
  it('requires administrator permission for writes', async () => {
    const res = await request(app).post('/api/academic/campuses').send({ name: 'فاقد دسترسی', code: 'UNAUTH' });
    expect(res.status).toBe(401);
  });

  it('rejects nonexistent parent university or province without writing a campus', async () => {
    const university = db.universities.find(item => item.active);
    if (!university) throw new Error('Missing seeded university');
    const before = db.campuses.length;
    const unknownUniversity = await request(app).post('/api/academic/campuses').set('Authorization', auth)
      .send({ universityId: 'nonexistent-university', name: marker, code: 'REF-INVALID' });
    expect(unknownUniversity.status).toBe(400);
    const unknownProvince = await request(app).post('/api/academic/campuses').set('Authorization', auth)
      .send({ universityId: university.id, provinceId: 'nonexistent-province', name: marker, code: 'REF-INVALID' });
    expect(unknownProvince.status).toBe(400);
    expect(db.campuses).toHaveLength(before);
  });

  it('creates a valid campus with a named parent selection and optional province', async () => {
    const university = db.universities.find(item => item.active);
    if (!university) throw new Error('Missing seeded university');
    const result = await request(app).post('/api/academic/campuses').set('Authorization', auth)
      .send({ universityId: university.id, name: marker, code: 'TEST-CAMP', type: 'INTERNATIONAL' });
    expect(result.status).toBe(200);
    expect(result.body.data.universityId).toBe(university.id);
    expect(result.body.data.provinceId).toBeNull();
    created.campus = result.body.data.id;
  });

  it('does not mutate an existing campus when updating to an invalid parent', async () => {
    const before = db.campuses.find(item => item.id === created.campus);
    expect(before).toBeDefined();
    const universityBefore = before?.universityId;
    const invalid = await request(app).put('/api/academic/campuses/' + created.campus)
      .set('Authorization', auth).send({ universityId: 'missing-university' });
    expect(invalid.status).toBe(400);
    expect(db.campuses.find(item => item.id === created.campus)?.universityId).toBe(universityBefore);
    const clearProvince = await request(app).put('/api/academic/campuses/' + created.campus)
      .set('Authorization', auth).send({ provinceId: null });
    expect(clearProvince.status).toBe(200);
  });

  it('requires an existing degree for new majors, and a major for new tracks', async () => {
    const degree = db.degreeLevels.find(item => item.active);
    if (!degree) throw new Error('Missing seeded degree');
    const invalidMajor = await request(app).post('/api/academic/majors').set('Authorization', auth)
      .send({ degreeLevelId: 'missing-degree', name: marker, code: 'INVALID' });
    expect(invalidMajor.status).toBe(400);
    const validMajor = await request(app).post('/api/academic/majors').set('Authorization', auth)
      .send({ degreeLevelId: degree.id, name: marker, code: 'VALID-MAJOR' });
    expect(validMajor.status).toBe(200);
    created.major = validMajor.body.data.id;
    const invalidTrack = await request(app).post('/api/academic/tracks').set('Authorization', auth)
      .send({ majorId: 'missing-major', name: marker, code: 'INVALID' });
    expect(invalidTrack.status).toBe(400);
    const validTrack = await request(app).post('/api/academic/tracks').set('Authorization', auth)
      .send({ majorId: created.major, name: marker + '-track', code: 'VALID-TRACK' });
    expect(validTrack.status).toBe(200);
    created.track = validTrack.body.data.id;
  });
});
