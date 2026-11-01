import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { adminRouter } from '../server/routes/admin';
import { adminManagementRouter } from '../server/routes/admin-management';
import { generateToken, isRootOwner } from '../server/middleware/auth';

const fakeId = 'security-forged-root-role';
const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use('/api/admin-management', adminManagementRouter);

beforeAll(async () => {
  await db.init(true);
  db.users.push({
    id: fakeId,
    name: 'Synthetic untrusted inherited root label',
    mobile: '09900000991',
    password: 'not-used',
    roles: ['super-admin', 'admin', 'student'],
    permissions: [],
    createdAt: new Date().toISOString(),
  });
});

afterAll(() => {
  db.data.users = db.users.filter(user => user.id !== fakeId);
  db.save();
});

describe('reserved root identity cannot be forged by persisted roles', () => {
  it('rejects an arbitrary user carrying an old super-admin role', async () => {
    const forged = db.users.find(user => user.id === fakeId);
    if (!forged) throw new Error('Synthetic fixture missing');
    expect(isRootOwner(forged)).toBe(false);
    const headers = { Authorization: 'Bearer ' + generateToken({ id: fakeId }) };
    expect((await request(app).get('/api/admin/users').set(headers)).status).toBe(403);
    expect((await request(app).get('/api/admin/backup').set(headers)).status).toBe(403);
    expect((await request(app).get('/api/admin-management').set(headers)).status).toBe(403);
    expect((await request(app).post('/api/admin-management').set(headers)
      .send({ name: 'Synthetic Admin', mobile: '09900000992', password: 'synthetic' })).status).toBe(403);
  });

  it('root ownership requires both the reserved id and configured mobile', () => {
    const configuredMobile = process.env.ROOT_OWNER_MOBILE;
    expect(isRootOwner({
      id: 'usr-super',
      mobile: '09900000993',
      roles: ['super-admin', 'admin', 'student'],
    } as any)).toBe(false);
    expect(isRootOwner(undefined)).toBe(false);
    if (configuredMobile) {
      expect(isRootOwner({
        id: fakeId,
        mobile: configuredMobile,
        roles: ['super-admin', 'admin', 'student'],
      } as any)).toBe(false);
    }
  });
});
