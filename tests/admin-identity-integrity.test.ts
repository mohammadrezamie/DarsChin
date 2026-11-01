import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { generateToken } from '../server/middleware/auth';
import { adminManagementRouter } from '../server/routes/admin-management';

const app = express();
app.use(express.json());
app.use('/api/admin-management', adminManagementRouter);

const primaryId = 'security-canonical-mobile-primary';
const secondaryId = 'security-canonical-mobile-secondary';
const primaryMobile = '09900007771';
const secondaryMobile = '09900007772';
let rootToken = '';
const bearer = () => ({ Authorization: 'Bearer ' + rootToken });

beforeAll(async () => {
  await db.init(true);
  const owner = db.users.find(u => u.id === 'usr-super');
  if (!owner) throw new Error('Synthetic root not initialized');
  rootToken = generateToken(owner);
  const now = new Date().toISOString();
  db.users.push({
    id: primaryId, mobile: primaryMobile, name: 'Synthetic Primary',
    roles: ['admin', 'student'], permissions: ['admin.panel.access'],
    createdAt: now,
  });
  db.users.push({
    id: secondaryId, mobile: secondaryMobile, name: 'Synthetic Secondary',
    roles: ['admin', 'student'], permissions: [],
    createdAt: now,
  });
});

afterAll(() => {
  db.data.users = db.users.filter(u => u.id !== primaryId && u.id !== secondaryId);
  db.save();
});

describe('root-managed account identity integrity', () => {
  it('does not allow a canonicalized mobile to collide with another existing account', async () => {
    const primary = db.users.find(u => u.id === primaryId)!;
    const before = JSON.stringify(primary);
    const response = await request(app).put('/api/admin-management/' + primaryId)
      .set(bearer()).send({
        name: 'Should Not Be Saved', mobile: '+98' + secondaryMobile.slice(1),
        permissions: ['backup.manage'],
      });
    expect(response.status).toBe(409);
    expect(JSON.stringify(primary)).toBe(before);
  });

  it('rejects unexpected permissions, duplicate grants, bad roles and weak passwords', async () => {
    const base = db.users.find(u => u.id === primaryId)!;
    const snapshot = JSON.stringify(base);
    const invalid = [
      { permissions: 'admin.panel.access' },
      { permissions: ['admin.panel.access', 'admin.panel.access'] },
      { permissions: ['__proto__'] },
      { permissions: ['bad permission'] },
      { roles: ['admin', 'admin'] },
      { password: 'short' },
      { mobile: { value: primaryMobile } },
    ];
    for (const payload of invalid) {
      const response = await request(app).put('/api/admin-management/' + primaryId)
        .set(bearer()).send(payload);
      expect(response.status).toBe(400);
      expect(JSON.stringify(base)).toBe(snapshot);
    }
    const forbiddenRoot = await request(app).put('/api/admin-management/' + primaryId)
      .set(bearer()).send({ roles: ['super-admin'] });
    expect(forbiddenRoot.status).toBe(403);
    expect(JSON.stringify(base)).toBe(snapshot);

    const newAdmin = await request(app).post('/api/admin-management').set(bearer())
      .send({
        name: 'Synthetic New Admin', mobile: '+98' + secondaryMobile.slice(1),
        password: 'secure-new-test-password', permissions: ['admin.panel.access'],
      });
    expect(newAdmin.status).toBe(409);
    const malformedCreate = await request(app).post('/api/admin-management').set(bearer())
      .send({
        name: 'Synthetic New Admin', mobile: '09900007773',
        password: 'secure-new-test-password', permissions: { 'backup.manage': true },
      });
    expect(malformedCreate.status).toBe(400);
    expect(db.users.some(u => u.mobile === '09900007773')).toBe(false);
  });

  it('normalizes a valid new mobile and invalidates the prior session', async () => {
    const primary = db.users.find(u => u.id === primaryId)!;
    const previous = generateToken(primary);
    const updatedMobile = '09900007774';
    const response = await request(app).put('/api/admin-management/' + primaryId)
      .set(bearer()).send({
        mobile: '+98' + updatedMobile.slice(1),
        name: 'Synthetic Updated Admin',
        permissions: ['admin.panel.access', 'backup.manage'],
      });
    expect(response.status).toBe(200);
    expect(primary.mobile).toBe(updatedMobile);
    expect(primary.permissions).toEqual(['admin.panel.access', 'backup.manage']);
    expect(primary.sessionVersion).toBe(1);
    // Old signed tokens become invalid after any authority-changing edit.
    const oldSession = await request(app).get('/api/admin-management').set({
      Authorization: 'Bearer ' + previous,
    });
    expect(oldSession.status).toBe(401);
  });
});
