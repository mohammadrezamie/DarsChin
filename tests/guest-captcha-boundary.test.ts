import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { db } from '../server/db/database';
import authRouter from '../server/routes/auth';
import { otpRouter } from '../server/routes/otp';

const app = express();
app.use(express.json());
app.use('/api/auth/otp', otpRouter);
app.use('/api/auth', authRouter);
beforeAll(async () => {
  vi.stubEnv('TURNSTILE_ENABLED', 'false');
  await db.init(true);
});

async function issue(action: string) {
  return request(app).get('/api/auth/otp/captcha/generate').query({ action });
}

describe('P0 first-party CAPTCHA route and cross-form protection', () => {
  it('rejects unsupported action and never leaks the challenge answer', async () => {
    expect((await issue('admin')).status).toBe(400);
    const response = await issue('register');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body.data).toEqual({
      id: expect.any(String),
      svg: expect.stringContaining('<svg'),
    });
    expect(JSON.stringify(response.body)).not.toContain('"answer"');
    expect(JSON.stringify(response.body)).not.toContain('"value"');
    expect(db.captchaChallenges.find(c => c.id === response.body.data.id)?.action).toBe('register');
  });

  it('cannot replay an OTP image as a guest login or a registration CAPTCHA', async () => {
    const otp = await issue('otp');
    const id = otp.body.data.id;
    const answer = db.captchaChallenges.find(c => c.id === id)!.value;
    for (const endpoint of ['/api/auth/login', '/api/auth/register']) {
      const result = await request(app).post(endpoint).send({
        mobile: '09123456789', password: 'secret123', name: 'Test User',
        captchaToken: `local:${id}:${answer}`,
      });
      expect(result.status).toBe(403);
    }
  });

  it('does not accept a login image challenge for register even with the correct code', async () => {
    const login = await issue('login');
    const id = login.body.data.id;
    const answer = db.captchaChallenges.find(c => c.id === id)!.value;
    const wrongAction = await request(app).post('/api/auth/register').send({
      mobile: '09123456789', password: 'secret123', name: 'Test User',
      captchaToken: `local:${id}:${answer}`,
    });
    expect(wrongAction.status).toBe(403);
    expect(db.captchaChallenges.find(c => c.id === id)?.attempts).toBe(0);
    const validAction = await request(app).post('/api/auth/login').send({
      mobile: '09123456789', password: 'not-the-password',
      captchaToken: `local:${id}:${answer}`,
    });
    expect(validAction.status).not.toBe(403); // The CAPTCHA passed, credentials still checked.
    const replay = await request(app).post('/api/auth/login').send({
      mobile: '09123456789', password: 'not-the-password',
      captchaToken: `local:${id}:${answer}`,
    });
    expect(replay.status).toBe(403);
  });
});
