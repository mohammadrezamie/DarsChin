import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { instanceAccessGate, assertInstanceAccessConfiguration } from '../server/middleware/instance-access';
import { generateToken } from '../server/middleware/auth';
import type { User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api', instanceAccessGate);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/auth/otp/captcha/generate', (_req, res) => res.json({ captcha: true }));
app.post('/api/auth/register', (_req, res) => res.status(201).json({ registered: true }));
app.post('/api/auth/login', (_req, res) => res.json({ downstream: true }));
app.post('/api/auth/otp/send', (_req, res) => res.json({ downstream: true }));
app.get('/api/student/profile', (_req, res) => res.json({ success: true }));
app.get('/api/admin/users', (_req, res) => res.json({ success: true }));
app.get('/demo/student', (_req, res) => res.send('browser-only demo'));

const ownerMobile = process.env.ROOT_OWNER_MOBILE ?? '09999999999';
const owner: User = {
  id: 'usr-super', mobile: ownerMobile, name: 'Synthetic local owner',
  roles: ['super-admin','admin','student'], password: 'test-placeholder',
  createdAt: new Date(0).toISOString(),
};
const student: User = {
  id: 'fixture-outsider', mobile: '09900000001', name: 'Synthetic outsider',
  roles: ['student'], createdAt: new Date(0).toISOString(),
};

beforeAll(async () => { await db.init(true); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('public source, self-hosted private instance', () => {
  it('does not alter existing installations unless the operator selects owner_only', async () => {
    vi.stubEnv('DARSCHYN_ACCESS_MODE', 'multiuser');
    expect((await request(app).post('/api/auth/register').send({})).status).toBe(201);
    expect((await request(app).get('/api/student/profile')).status).toBe(200);
  });

  it('fails on invalid modes or missing configured owner rather than silently opening access', () => {
    vi.stubEnv('DARSCHYN_ACCESS_MODE', 'garbage');
    expect(() => assertInstanceAccessConfiguration()).toThrow(/DARSCHYN_ACCESS_MODE/);
    vi.stubEnv('DARSCHYN_ACCESS_MODE', 'owner_only');
    vi.stubEnv('ROOT_OWNER_MOBILE', '');
    expect(() => assertInstanceAccessConfiguration()).toThrow(/ROOT_OWNER_MOBILE/);
  });

  it('keeps public health and human-challenge bootstrap, but blocks registration and other guests', async () => {
    vi.stubEnv('DARSCHYN_ACCESS_MODE', 'owner_only');
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).get('/api/auth/otp/captcha/generate')).status).toBe(200);
    expect((await request(app).post('/api/auth/register').send({ mobile: ownerMobile })).status).toBe(403);
    expect((await request(app).post('/api/auth/login').send({ mobile: student.mobile })).status).toBe(403);
    expect((await request(app).post('/api/auth/otp/send').send({ mobile: student.mobile })).status).toBe(403);
    expect((await request(app).get('/api/student/profile')).status).toBe(401);
    // Express route matching is case-insensitive by default. Security must
    // not be circumventable by changing the case of the /api prefix.
    expect((await request(app).get('/API/student/profile')).status).toBe(401);
    expect((await request(app).post('/API/auth/register').send({ mobile: ownerMobile })).status).toBe(403);
    expect((await request(app).post('/api/auth/login').send({ mobile: ownerMobile })).status).toBe(200);
  });

  it('accepts only persisted reserved owner tokens, never forged or stale role labels', async () => {
    vi.stubEnv('DARSCHYN_ACCESS_MODE', 'owner_only');
    const original = db.data;
    try {
      db.data = { ...original, users: [owner, { ...student, roles: ['super-admin','admin'] }] };
      const ownerToken = generateToken(owner);
      const studentToken = generateToken(student);
      expect((await request(app).get('/api/student/profile')
        .set('Authorization', 'Bearer ' + ownerToken)).status).toBe(200);
      expect((await request(app).get('/api/admin/users')
        .set('Authorization', 'Bearer ' + ownerToken)).status).toBe(200);
      expect((await request(app).get('/api/student/profile')
        .set('Authorization', 'Bearer ' + studentToken)).status).toBe(403);
    } finally {
      db.data = original;
    }
  });

  it('does not claim to protect a browser-only static demo', async () => {
    vi.stubEnv('DARSCHYN_ACCESS_MODE', 'owner_only');
    expect((await request(app).get('/demo/student')).status).toBe(200);
  });
});
