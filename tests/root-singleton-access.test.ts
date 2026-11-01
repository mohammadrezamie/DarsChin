import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { db } from '../server/db/database';
import { generateToken } from '../server/middleware/auth';
import { adminRouter } from '../server/routes/admin';
import { adminManagementRouter } from '../server/routes/admin-management';
import type { User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use('/api/admin-management', adminManagementRouter);

let rootToken = '';
let studentToken = '';
const userId = 'usr-single-root-test';

beforeAll(async () => {
  await db.init(true);
  const root = db.users.find(user => user.id === 'usr-super');
  if (!root) throw new Error('synthetic root fixture missing');
  rootToken = generateToken(root);
  const student: User = {
    id: userId, mobile: '09055555555', name: 'دانشجوی ساختگی',
    roles: ['student'], permissions: [],
    password: bcrypt.hashSync('Synthetic-Passphrase-Test', 4),
    createdAt: new Date().toISOString(),
  };
  if (!db.users.some(user=>user.id===userId)) db.users.push(student);
  db.save();
  studentToken = generateToken(student);
});

describe('root is a singleton, with no public or delegated escalation', () => {
  it('student cannot access root user listing or promote any account', async () => {
    const response = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${studentToken}`);
    expect(response.status).toBe(403);
    const role = await request(app).put(`/api/admin/users/${userId}/role`)
      .set('Authorization',`Bearer ${studentToken}`).send({role:'admin'});
    expect(role.status).toBe(403);
  });

  it('even root cannot mint another super-admin through role API', async () => {
    const response = await request(app).put(`/api/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({role:'super-admin'});
    expect(response.status).toBe(400);
    expect(db.users.find(u=>u.id===userId)?.roles).toEqual(['student']);
  });

  it('does not let root create a second root via admin-management', async () => {
    const before = db.users.length;
    const response = await request(app).post('/api/admin-management')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({name:'غیرواقعی',mobile:'09133333333',password:'Synthetic-Password-2026',
        roles:['admin','super-admin'],permissions:['admin.panel.access']});
    expect(response.status).toBe(403);
    expect(db.users).toHaveLength(before);
  });

  it('rejects illicit role escalation BEFORE mutating other account fields', async () => {
    const previous = db.users.find(u=>u.id===userId)!.name;
    const response = await request(app).put(`/api/admin-management/${userId}`)
      .set('Authorization', `Bearer ${rootToken}`)
      .send({name:'نام دستکاری‌شده',roles:['super-admin']});
    expect(response.status).toBe(403);
    expect(db.users.find(u=>u.id===userId)?.name).toBe(previous);
    expect(db.users.find(u=>u.id===userId)?.roles).toEqual(['student']);
  });

  it('never demotes the reserved root while ordinary admin promotion still works', async () => {
    const blocked = await request(app).put('/api/admin/users/usr-super/role')
      .set('Authorization', `Bearer ${rootToken}`)
      .send({role:'student'});
    expect(blocked.status).toBe(403);
    expect(db.users.find(u=>u.id==='usr-super')?.roles).toContain('super-admin');

    const allowed = await request(app).put(`/api/admin/users/${userId}/role`)
      .set('Authorization', `Bearer ${rootToken}`).send({role:'admin'});
    expect(allowed.status).toBe(200);
    expect(db.users.find(u=>u.id===userId)?.roles).toEqual(['admin','student']);
  });
});
