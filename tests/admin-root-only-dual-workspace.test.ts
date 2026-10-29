import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { db } from '../server/db/database';
import { adminManagementRouter } from '../server/routes/admin-management';
import { generateToken } from '../server/middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/admin-management', adminManagementRouter);
const syntheticId = 'synthetic-delegated-root-only';
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
});

afterAll(() => {
  db.data.users = db.users.filter(u => u.id !== syntheticId && !createdIds.includes(u.id));
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
    expect((await request(app).put('/api/admin-management/' + target.id).set(bearer(rootToken))
      .send({roles:['student']})).status).toBe(200);
    expect(target.roles).toEqual(['student']);
  });
});
