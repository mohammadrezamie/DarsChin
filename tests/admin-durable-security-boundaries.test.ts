import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, type DatabaseSchema } from '../server/db/database';
import { adminManagementRouter } from '../server/routes/admin-management';
import { generateToken } from '../server/middleware/auth';
import type { User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/admin-management', adminManagementRouter);
const secretMarker = 'SYNTHETIC_PRIVATE_CONFIG:/operator/vps/.env';
const adminId = 'synthetic-durable-admin-001';
let original: DatabaseSchema;
let token = '';
beforeAll(async () => { await db.init(true); });
beforeEach(() => {
  original = db.data;
  const root: User = {
    id: 'usr-super', mobile: process.env.ROOT_OWNER_MOBILE!,
    roles: ['super-admin','admin','student'], name: 'Synthetic root', createdAt: new Date().toISOString(),
  };
  const delegated: User = {
    id: adminId, mobile: '09900008581', name: 'Synthetic manager',
    roles: ['admin', 'student'], permissions: ['admin.panel.access', 'demand.manage'],
    sessionVersion: 3, createdAt: new Date().toISOString(),
  };
  db.data = { ...original, users: [root, delegated], auditLogs: [] };
  token = 'Bearer ' + generateToken(root);
});
afterEach(() => { vi.restoreAllMocks(); db.data = original; });
const fail = () => vi.spyOn(db,'save').mockImplementationOnce(() => { throw Error(secretMarker); });
const check = (response: { status: number; body: unknown }) => {
  expect(response.status).toBe(503);
  expect(JSON.stringify(response.body)).not.toContain(secretMarker);
};
describe('atomic root-only delegated identity administration', () => {
  it('does not retain an unsaved privileged manager or audit', async () => {
    const spy = fail();
    const response = await request(app).post('/api/admin-management').set('Authorization', token)
      .send({ name: 'Synthetic newly created manager', mobile: '09900008582',
        password: 'synthetic-strong-password', roles: ['admin'],
        permissions: ['admin.panel.access'] });
    spy.mockRestore(); check(response);
    expect(db.users.some(u => u.mobile === '09900008582')).toBe(false);
    expect(db.auditLogs).toHaveLength(0);
  });
  it('restores role, scope, password/session version and audit after failed administrator update', async () => {
    const target = db.users.find(u=>u.id===adminId)!;
    const before = JSON.stringify(target);
    const old = generateToken(target);
    const spy = fail();
    const response = await request(app).put('/api/admin-management/'+adminId)
      .set('Authorization',token).send({roles:['student'],password:'synthetic-changed-password'});
    spy.mockRestore(); check(response);
    expect(JSON.stringify(target)).toBe(before);
    expect(db.auditLogs).toHaveLength(0);
    expect(generateToken(target)).toBeTruthy();
    expect(target.sessionVersion).toBe(3);
    expect(old).toBeTruthy();
  });
  it('cannot leave a manager deactivated in memory after persistence failure', async () => {
    const target = db.users.find(u=>u.id===adminId)!;
    const before = JSON.stringify(target);
    const spy = fail();
    const response = await request(app).delete('/api/admin-management/'+adminId)
      .set('Authorization', token);
    spy.mockRestore(); check(response);
    expect(JSON.stringify(target)).toBe(before);
    expect(db.auditLogs).toHaveLength(0);
  });
  it('cannot grant unsaved private departmental scopes', async () => {
    const c = db.campuses.find(c=>c.active);
    const d = db.degreeLevels.find(d=>d.active);
    const m = db.majors.find(m=>m.active && m.degreeLevelId===d?.id);
    if (!c || !d || !m) throw Error('Missing academic scope fixtures');
    const target=db.users.find(u=>u.id===adminId)!;
    const spy=fail();
    const response=await request(app).put('/api/admin-management/'+adminId+'/demand-scopes')
      .set('Authorization',token).send({scopes:[{campusId:c.id,degreeLevelId:d.id,majorId:m.id}]});
    spy.mockRestore();check(response);
    expect(target.demandScopes).toBeUndefined();
    expect(db.auditLogs).toHaveLength(0);
  });
});
