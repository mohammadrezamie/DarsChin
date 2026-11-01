import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { db } from '../server/db/database';
import { adminManagementRouter } from '../server/routes/admin-management';
import { adminRouter } from '../server/routes/admin';
import { generateToken } from '../server/middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/admin-management', adminManagementRouter);
app.use('/api/admin', adminRouter);
const syntheticId = 'synthetic-delegated-root-only';
const staleStudentId = 'synthetic-stale-grants-student';
const createdIds: string[] = [];
let rootToken = '';
let delegatedToken = '';

beforeAll(async () => {
  await db.init(true);
  const root = db.users.find(u => u.roles.includes('super-admin'));
  if (!root) throw new Error('Missing synthetic seed root');
  rootToken = generateToken({ id: root.id });
  db.users.push({
    id: syntheticId, name: 'Synthetic Delegated Admin', mobile: '09900000090',
    password: 'not-used', roles: ['student','admin'],
    permissions: ['admin.panel.access','admin.create','admin.manage','admin.remove'],
    createdAt: new Date().toISOString(),
  });
  delegatedToken = generateToken({ id: syntheticId });
  db.users.push({
    id: staleStudentId, name: 'Synthetic Stale Student', mobile: '09900000092',
    password: 'not-used', roles: ['student'],
    permissions: ['admin.panel.access', 'backup.manage', 'system.settings.manage', 'sms.manage'],
    createdAt: new Date().toISOString(),
  });
});

afterAll(() => {
  db.data.users = db.users.filter(u => u.id !== syntheticId && u.id !== staleStudentId && !createdIds.includes(u.id));
  db.save();
});

const bearer = (token: string) => ({ Authorization: 'Bearer ' + token });
describe('root-only delegation and permanent student workspace', () => {
  it('rejects list, create, edit and deactivate for delegated admins with old powerful grants', async () => {
    const headers = bearer(delegatedToken);
    expect((await request(app).get('/api/admin-management').set(headers)).status).toBe(403);
    expect((await request(app).post('/api/admin-management').set(headers)
      .send({name:'Synthetic Intruder',mobile:'09900000091',password:'synthetic',roles:['admin']})).status).toBe(403);
    expect((await request(app).put('/api/admin-management/' + syntheticId).set(headers)
      .send({roles:['student']})).status).toBe(403);
    expect((await request(app).delete('/api/admin-management/' + syntheticId).set(headers)).status).toBe(403);
  });

  it('rejects admin endpoints for students retaining inherited permissions', async () => {
    const token = generateToken({ id: staleStudentId });
    expect((await request(app).get('/api/admin/stats').set(bearer(token))).status).toBe(403);
    expect((await request(app).get('/api/admin/backup').set(bearer(token))).status).toBe(403);
    expect((await request(app).get('/api/admin-management').set(bearer(token))).status).toBe(403);
  });

  it('root creates, updates and demotes while preserving the student role', async () => {
    const mobile = '09' + randomUUID().replace(/[^0-9]/g,'').padEnd(9,'2').slice(0,9);
    const create = await request(app).post('/api/admin-management').set(bearer(rootToken))
      .send({name:'Synthetic Two-Workspace Admin',mobile,password:'synthetic-only',roles:['admin'],permissions:['admin.panel.access']});
    expect(create.status).toBe(200);
    const target = db.users.find(u => u.mobile === mobile);
    expect(target).toBeDefined();
    if (!target) throw new Error('New admin missing');
    createdIds.push(target.id);
    expect(target.roles).toEqual(['student','admin']);
    expect((await request(app).put('/api/admin-management/' + target.id).set(bearer(rootToken))
      .send({roles:['admin']})).status).toBe(200);
    expect(target.roles).toEqual(['student','admin']);
    const oldToken = generateToken({ id: target.id });
    target.permissions = ['admin.panel.access', 'backup.manage'];
    target.demandScopes = [{ campusId: 'c-test', degreeLevelId: 'd-test', majorId: 'm-test' }];
    expect((await request(app).put('/api/admin-management/' + target.id).set(bearer(rootToken))
      .send({roles:['student']})).status).toBe(200);
    expect(target.roles).toEqual(['student']);
    expect(target.permissions).toEqual([]);
    expect(target.demandScopes).toEqual([]);
    expect((await request(app).get('/api/admin/stats').set(bearer(oldToken))).status).toBe(401);
    expect((await request(app).get('/api/admin/stats')
      .set(bearer(generateToken({ id: target.id })))).status).toBe(403);
  });

  it('root role-change API drops stale grants and invalidates old sessions', async () => {
    const previousToken = generateToken({ id: syntheticId });
    const response = await request(app).put('/api/admin/users/' + syntheticId + '/role')
      .set(bearer(rootToken)).send({ role: 'student' });
    expect(response.status).toBe(200);
    const account = db.users.find(u => u.id === syntheticId);
    expect(account?.roles).toEqual(['student']);
    expect(account?.permissions).toEqual([]);
    expect(account?.demandScopes).toEqual([]);
    expect((await request(app).get('/api/admin/stats').set(bearer(previousToken))).status).toBe(401);
  });
});
