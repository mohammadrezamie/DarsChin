import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { db, type DatabaseSchema } from '../server/db/database';
import { otpRouter } from '../server/routes/otp';
import type { User, OtpChallenge } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/auth/otp', otpRouter);

const phone = '09900009381';
const validCode = '123456';
let original: DatabaseSchema;

function otp(purpose: 'login' | 'password_recovery'): OtpChallenge {
  return {
    id: 'synthetic-atomic-otp',
    mobile: phone, purpose,
    hashedOtp: bcrypt.hashSync(validCode, 4),
    createdAt: Date.now() - 1000,
    expiresAt: Date.now() + 120000,
    attempts: 0,
  };
}

beforeEach(() => {
  original = db.data;
  vi.stubEnv('TURNSTILE_ENABLED', 'false');
  vi.stubEnv('SMS_PROVIDER', 'log');
  const user: User = {
    id: 'synthetic-otp-atomic-user',
    mobile: phone, name: 'Synthetic verification user', roles: ['student'],
    createdAt: new Date().toISOString(),
  };
  db.data = {
    ...original,
    users: [user], otpChallenges: [], captchaChallenges: [],
    auditLogs: [], smsHistory: [],
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  db.data = original;
});

const verify = (purpose: 'login' | 'password_recovery', code = validCode) =>
  request(app).post('/api/auth/otp/verify')
    .send({ mobile: phone, purpose, code, challengeId: 'synthetic-atomic-otp' });

describe('OTP authentication persistence and privacy', () => {
  it('rolls back a verified login challenge and audit on storage failure, then permits a safe retry', async () => {
    const challenge = otp('login');
    db.otpChallenges.push(challenge);
    const failure = vi.spyOn(db, 'save').mockImplementationOnce(() => {
      throw new Error('SYNTHETIC_PRIVATE_PATH:/secret/otp.env');
    });
    let denied;
    try { denied = await verify('login'); } finally { failure.mockRestore(); }
    expect(denied.status).toBe(500);
    expect(JSON.stringify(denied.body)).not.toContain('SYNTHETIC_PRIVATE_PATH');
    expect(denied.body.data?.token).toBeUndefined();
    expect(challenge.consumedAt).toBeUndefined();
    expect(db.auditLogs).toHaveLength(0);

    const accepted = await verify('login');
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.token).toEqual(expect.any(String));
    expect(challenge.consumedAt).toEqual(expect.any(Number));
    expect(db.auditLogs.filter(log => log.action === 'USER_LOGIN_OTP')).toHaveLength(1);
    expect((await verify('login')).status).toBe(400);
  });

  it('keeps password-recovery OTP unconsumed on a failed verification save', async () => {
    const challenge = otp('password_recovery');
    db.otpChallenges.push(challenge);
    const failure = vi.spyOn(db, 'save').mockImplementationOnce(() => {
      throw new Error('SYNTHETIC_PRIVATE_PATH:/secret/recovery.env');
    });
    let denied;
    try { denied = await verify('password_recovery'); } finally { failure.mockRestore(); }
    expect(denied.status).toBe(500);
    expect(challenge.consumedAt).toBeUndefined();
    expect(JSON.stringify(denied.body)).not.toContain('SYNTHETIC_PRIVATE_PATH');
    expect((await verify('password_recovery')).status).toBe(200);
    expect(challenge.consumedAt).toEqual(expect.any(Number));
    expect(db.auditLogs).toHaveLength(0);
    expect((await verify('password_recovery')).status).toBe(400);
  });

  it('does not increment persistent failure attempts in memory when disk write fails', async () => {
    const challenge = otp('login');
    db.otpChallenges.push(challenge);
    const failure = vi.spyOn(db, 'save').mockImplementationOnce(() => {
      throw new Error('SYNTHETIC_PRIVATE_PATH:/secret/login.env');
    });
    let denied;
    try { denied = await verify('login', '000000'); } finally { failure.mockRestore(); }
    expect(denied.status).toBe(500);
    expect(challenge.attempts).toBe(0);
    expect(JSON.stringify(denied.body)).not.toContain('SYNTHETIC_PRIVATE_PATH');
    expect((await verify('login', '000000')).status).toBe(400);
    expect(challenge.attempts).toBe(1);
  });

  it('never sends an OTP if the new challenge cannot be saved', async () => {
    db.captchaChallenges.push({
      id: 'synthetic-send-captcha', value: 'ABCDE', action: 'otp',
      attempts: 0, createdAt: Date.now(), expiresAt: Date.now() + 120000,
    });
    const originalSave = db.save.bind(db);
    const failure = vi.spyOn(db, 'save').mockImplementation(() => {
      if (db.otpChallenges.length > 0) {
        throw new Error('SYNTHETIC_PRIVATE_PATH:/secret/sending.env');
      }
      return originalSave();
    });
    let result;
    try {
      result = await request(app).post('/api/auth/otp/send')
        .send({ mobile: phone, purpose: 'login', captchaId: 'synthetic-send-captcha', captchaValue: 'ABCDE' });
    } finally {
      failure.mockRestore();
    }
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toContain('SYNTHETIC_PRIVATE_PATH');
    expect(db.otpChallenges).toHaveLength(0);
    expect(db.data.smsHistory).toHaveLength(0);
  });
});
