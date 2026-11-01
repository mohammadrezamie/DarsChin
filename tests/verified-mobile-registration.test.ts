import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { authRouter } from '../server/routes/auth';
import { otpRouter } from '../server/routes/otp';

const app = express();
app.use(express.json());
app.use('/api/auth/otp', otpRouter);
app.use('/api/auth', authRouter);
let mobileSerial = 10000000;
const mobile = () => `091${String(mobileSerial++).padStart(8, '0')}`;
const password = 'synthetic-testing-password-2026';
const code = '654321';

beforeAll(async () => { await db.init(true); });
afterEach(() => vi.unstubAllEnvs());

async function challenge(action: 'otp' | 'register' | 'login') {
  const response = await request(app).get('/api/auth/otp/captcha/generate').query({ action });
  expect(response.status).toBe(200);
  const id = response.body.data.id as string;
  const answer = db.captchaChallenges.find(c => c.id === id)?.value;
  expect(answer).toBeTruthy();
  return `local:${id}:${answer}`;
}

async function sendRegistrationCode(phone: string, purpose = 'registration') {
  const captchaToken = await challenge('otp');
  return request(app).post('/api/auth/otp/send').send({
    mobile: phone, purpose, captchaToken,
  });
}

async function registerWithCaptcha(phone: string, more: Record<string, unknown> = {}) {
  const captchaToken = await challenge('register');
  return request(app).post('/api/auth/register').send({
    mobile: phone, password, name: 'Synthetic student',
    captchaToken, ...more,
  });
}

describe('opt-in proof of phone ownership during registration', () => {
  beforeAll(() => {
    vi.stubEnv('TURNSTILE_ENABLED', 'false');
  });
  it('requires a registration-specific OTP before creating any student account', async () => {
    vi.stubEnv('DARSCHYN_REGISTRATION_OTP_REQUIRED', 'true');
    vi.stubEnv('SMS_PROVIDER', 'log');
    vi.stubEnv('MOCK_OTP_CODE', code);
    const phone = mobile();
    const attempted = await registerWithCaptcha(phone);
    expect(attempted.status).toBe(400);
    expect(db.users.some(user => user.mobile === phone)).toBe(false);

    const sent = await sendRegistrationCode(phone);
    expect(sent.status).toBe(200);
    const id = sent.body.data.challengeId as string;
    expect(db.otpChallenges.find(c => c.id === id)?.purpose).toBe('registration');

    const wrongCode = await registerWithCaptcha(phone, { otpChallengeId: id, otpCode: '111111' });
    expect(wrongCode.status).toBe(403);
    const valid = await registerWithCaptcha(phone, { otpChallengeId: id, otpCode: code });
    expect(valid.status).toBe(201);
    const student = db.users.find(user => user.mobile === phone);
    expect(student?.mobileVerifiedAt).toEqual(expect.any(String));
    expect(student?.roles).toEqual(['student']);
    // Even if the recovery key were leaked in a backup, the raw value is absent.
    expect(student?.recoveryKey).toMatch(/^\$2[aby]\$/);
    expect(student?.recoveryKey).not.toBe(password);
    expect(db.auditLogs.filter(log => log.entityId === student?.id)
      .every(log => !log.details.includes(phone))).toBe(true);
    expect(db.otpChallenges.find(challenge => challenge.id === id)?.consumedAt).toEqual(expect.any(Number));

    const replay = await registerWithCaptcha(phone, { otpChallengeId: id, otpCode: code });
    expect(replay.status).not.toBe(201);
    expect(db.users.filter(user => user.mobile === phone)).toHaveLength(1);
  });

  it('rejects registration OTP for the wrong phone, expired code or already-used code', async () => {
    vi.stubEnv('DARSCHYN_REGISTRATION_OTP_REQUIRED', 'true');
    vi.stubEnv('MOCK_OTP_CODE', code);
    const phone = mobile();
    const issue = await sendRegistrationCode(phone);
    expect(issue.status).toBe(200);
    const id = issue.body.data.challengeId as string;
    const anotherPhone = mobile();
    const other = await registerWithCaptcha(anotherPhone, { otpChallengeId: id, otpCode: code });
    expect(other.status).toBe(403);

    const current = db.otpChallenges.find(c => c.id === id)!;
    current.expiresAt = Date.now() - 1;
    const expired = await registerWithCaptcha(phone, { otpChallengeId: id, otpCode: code });
    expect(expired.status).toBe(403);
    expect(db.users.some(u => u.mobile === phone)).toBe(false);
  });

  it('cannot consume registration OTP on generic verify or substitute another OTP purpose', async () => {
    vi.stubEnv('DARSCHYN_REGISTRATION_OTP_REQUIRED', 'true');
    vi.stubEnv('MOCK_OTP_CODE', code);
    const phone = mobile();
    const sent = await sendRegistrationCode(phone);
    expect(sent.status).toBe(200);
    const registrationId = sent.body.data.challengeId as string;
    const premature = await request(app).post('/api/auth/otp/verify').send({
      mobile: phone, purpose: 'registration', code, challengeId: registrationId,
    });
    expect(premature.status).toBe(400);
    expect(db.otpChallenges.find(c => c.id === registrationId)?.consumedAt).toBeUndefined();

    const another = await sendRegistrationCode(mobile(), 'login');
    expect(another.status).toBe(404);
  });

  it('refuses to pretend an unconfigured log-mode SMS is deliverable in production', async () => {
    vi.stubEnv('DARSCHYN_REGISTRATION_OTP_REQUIRED', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SMS_PROVIDER', 'log');
    vi.stubEnv('NIAZPARDAZ_API_KEY', '');
    const phone = mobile();
    const blocked = await registerWithCaptcha(phone, { otpChallengeId: 'forged', otpCode: code });
    expect(blocked.status).toBe(503);
    expect(db.users.some(u => u.mobile === phone)).toBe(false);
  });

  it('does not send registration SMS when ownership verification is intentionally disabled', async () => {
    vi.stubEnv('DARSCHYN_REGISTRATION_OTP_REQUIRED', 'false');
    const phone = mobile();
    const before = db.otpChallenges.filter(c => c.mobile === phone).length;
    const response = await sendRegistrationCode(phone);
    expect(response.status).toBe(400);
    expect(db.otpChallenges.filter(c => c.mobile === phone)).toHaveLength(before);
  });

  it('keeps existing development and demo registration available when verification is disabled', async () => {
    vi.stubEnv('DARSCHYN_REGISTRATION_OTP_REQUIRED', 'false');
    const phone = mobile();
    const response = await registerWithCaptcha(phone);
    expect(response.status).toBe(201);
    expect(db.users.find(u => u.mobile === phone)?.mobileVerifiedAt).toBeUndefined();
  });
});
