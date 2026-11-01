import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { db } from '../server/db/database';
import { authRouter } from '../server/routes/auth';
import { otpRouter } from '../server/routes/otp';
import type { User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/auth/otp', otpRouter);
app.use('/api/auth', authRouter);

const knownMobile = '09900008491';
const inactiveMobile = '09900008492';
const unknownMobile = '09900008493';
const password = 'synthetic-strong-password-2026';
const syntheticIds = ['synthetic-login-known', 'synthetic-login-inactive'];
let previousUsers: User[] = [];

beforeAll(async () => {
  await db.init(true);
  previousUsers = db.users.slice();
  db.data.users = [
    ...previousUsers,
    { id: syntheticIds[0], mobile: knownMobile, name: 'Synthetic known account',
      roles: ['student'], password: bcrypt.hashSync(password, 10),
      createdAt: new Date().toISOString() },
    { id: syntheticIds[1], mobile: inactiveMobile, name: 'Synthetic inactive account',
      roles: ['student'], password: bcrypt.hashSync(password, 10),
      deactivatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  ];
});

afterEach(() => { vi.unstubAllEnvs(); });

async function login(mobile: string, pwd: string) {
  vi.stubEnv('TURNSTILE_ENABLED', 'false');
  const captcha = await request(app).get('/api/auth/otp/captcha/generate').query({ action: 'login' });
  expect(captcha.status).toBe(200);
  const challengeId = captcha.body.data.id as string;
  const answer = db.captchaChallenges.find(c => c.id === challengeId)?.value;
  expect(answer).toBeTruthy();
  return request(app).post('/api/auth/login')
    .send({ mobile, password: pwd, captchaToken: `local:${challengeId}:${answer}` });
}

describe('public password login and verified production registration', () => {
  it('returns indistinguishable invalid credential responses for missing, inactive and wrong-password identities', async () => {
    const missing = await login(unknownMobile, password);
    const inactive = await login(inactiveMobile, password);
    const wrong = await login(knownMobile, 'wrong-password-2026');
    for (const response of [missing, inactive, wrong]) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ success: false, error: 'شماره موبایل یا رمز عبور اشتباه است.' });
      expect(response.body.data?.token).toBeUndefined();
      expect(response.body.remainingAttempts).toBeUndefined();
    }
    const valid = await login(knownMobile, password);
    expect(valid.status).toBe(200);
    expect(valid.body.data.token).toEqual(expect.any(String));
  });

  it('does not let a production installation register an unverified mobile when OTP is disabled', async () => {
    vi.stubEnv('TURNSTILE_ENABLED', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DARSCHYN_REGISTRATION_OTP_REQUIRED', 'false');
    const before = db.users.length;
    const phone = '09900008494';
    const captcha = await request(app).get('/api/auth/otp/captcha/generate').query({ action: 'register' });
    const row = db.captchaChallenges.find(c => c.id === captcha.body.data.id);
    const response = await request(app).post('/api/auth/register').send({
      mobile: phone, name: 'Synthetic registration', password,
      captchaToken: `local:${row?.id}:${row?.value}`,
    });
    expect(response.status).toBe(503);
    expect(response.body.data?.token).toBeUndefined();
    expect(db.users).toHaveLength(before);
    expect(db.studentProfiles.some(p => db.users.some(u => u.id === p.userId && u.mobile === phone))).toBe(false);
  });
});
