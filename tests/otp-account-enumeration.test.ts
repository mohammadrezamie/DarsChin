import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { otpRouter } from '../server/routes/otp';

const app = express();
app.use(express.json());
app.use('/api/auth/otp', otpRouter);

const activeMobile = '09900008631';
const inactiveMobile = '09900008632';
const unknownMobile = '09900008633';
const ids = ['security-otp-active', 'security-otp-inactive'];
const seenChallengeIds: string[] = [];
const seenCaptchaIds: string[] = [];
let smsHistoryBefore = 0;

beforeAll(async () => {
  await db.init(true);
  vi.stubEnv('TURNSTILE_ENABLED', 'false');
  vi.stubEnv('SMS_PROVIDER', 'log');
  smsHistoryBefore = db.data.smsHistory?.length ?? 0;
  db.users.push({
    id: ids[0], mobile: activeMobile, name: 'Synthetic active',
    roles: ['student'], permissions: [], createdAt: new Date().toISOString(),
  }, {
    id: ids[1], mobile: inactiveMobile, name: 'Synthetic deactivated',
    roles: ['student'], permissions: [], createdAt: new Date().toISOString(),
    deactivatedAt: new Date().toISOString(),
  });
});

afterAll(() => {
  db.data.users = db.users.filter(u => !ids.includes(u.id));
  db.data.otpChallenges = db.otpChallenges.filter(c => !seenChallengeIds.includes(c.id));
  db.data.captchaChallenges = db.captchaChallenges.filter(c => !seenCaptchaIds.includes(c.id));
  if (db.data.smsHistory) db.data.smsHistory = db.data.smsHistory.slice(0, smsHistoryBefore);
  db.save();
  vi.unstubAllEnvs();
});

async function send(mobile: string, purpose: 'login' | 'password_recovery') {
  const captcha = await request(app).get('/api/auth/otp/captcha/generate');
  expect(captcha.status).toBe(200);
  const id = captcha.body.data.id as string;
  seenCaptchaIds.push(id);
  const challenge = db.captchaChallenges.find(c => c.id === id);
  expect(challenge).toBeDefined();
  const result = await request(app).post('/api/auth/otp/send').send({
    mobile, purpose, captchaId: id, captchaValue: challenge?.value,
  });
  if (result.body?.data?.challengeId) seenChallengeIds.push(result.body.data.challengeId);
  return result;
}

describe('login/recovery OTP must not disclose whether an account exists', () => {
  it('uses the same successful response shape for active, missing and deactivated accounts', async () => {
    const active = await send(activeMobile, 'login');
    const missing = await send(unknownMobile, 'login');
    const inactive = await send(inactiveMobile, 'login');

    expect(active.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(inactive.status).toBe(200);
    expect(missing.body.message).toBe(active.body.message);
    expect(inactive.body.message).toBe(active.body.message);
    for (const result of [active, missing, inactive]) {
      expect(result.body).toMatchObject({
        success: true,
        data: { challengeId: expect.any(String) },
      });
      expect(result.body).not.toHaveProperty('error');
    }

    const rows = db.otpChallenges.filter(c => seenChallengeIds.includes(c.id));
    expect(rows).toHaveLength(3);
    // Only the real active account receives a (mocked/log-mode) SMS.
    expect((db.data.smsHistory?.length ?? 0) - smsHistoryBefore).toBe(1);
    const invalid = await request(app).post('/api/auth/otp/verify').send({
      mobile: unknownMobile, purpose: 'login', code: '000000',
      challengeId: missing.body.data.challengeId,
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.data?.token).toBeUndefined();
  });

  it('throttles repeated missing-account requests just like legitimate accounts', async () => {
    const retry = await send(unknownMobile, 'login');
    expect(retry.status).toBe(429);
    expect(retry.body.data?.token).toBeUndefined();
  });

  it('does not send recovery SMS to unknown identities or disclose deactivation', async () => {
    const before = db.data.smsHistory?.length ?? 0;
    const result = await send('09900008634', 'password_recovery');
    expect(result.status).toBe(200);
    expect(result.body.message).not.toContain('یافت نشد');
    expect(db.data.smsHistory?.length ?? 0).toBe(before);
  });
});
