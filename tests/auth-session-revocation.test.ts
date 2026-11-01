import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../src/types';
import { db, type DatabaseSchema } from '../server/db/database';
import { authenticate, generateToken } from '../server/middleware/auth';
import { authRouter } from '../server/routes/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.get('/api/private', authenticate, (_req, res) => res.json({ success: true }));

const testMobile = '09123456789';
const originalPassword = 'old-password-01';
let original: DatabaseSchema;

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeEach(() => {
  original = db.data;
  const user: User = {
    id: 'auth-revoke-fixture',
    mobile: testMobile,
    name: 'کاربر مصنوعی',
    roles: ['student'],
    password: bcrypt.hashSync(originalPassword, 4),
    createdAt: new Date(0).toISOString(),
  };
  db.data = {
    ...original,
    users: [user],
    auditLogs: [],
    otpChallenges: [],
  };
});

afterEach(() => {
  db.data = original;
});

describe('P0 JWT invalidation after sensitive credential changes', () => {
  it('accepts the old token before change, revokes it afterward and returns a new live token', async () => {
    const before = generateToken(db.users[0]);
    expect((await request(app).get('/api/private').set(bearer(before))).status).toBe(200);

    const change = await request(app).post('/api/auth/change-password')
      .set(bearer(before))
      .send({ currentPassword: originalPassword, newPassword: 'new-password-02' });
    expect(change.status).toBe(200);
    expect(change.body.data.token).toEqual(expect.any(String));
    expect(db.users[0].sessionVersion).toBe(1);
    expect(bcrypt.compareSync('new-password-02', db.users[0].password!)).toBe(true);
    expect((await request(app).get('/api/private').set(bearer(before))).status).toBe(401);
    expect((await request(app).get('/api/private').set(bearer(change.body.data.token))).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(bearer(before))).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(bearer(change.body.data.token))).status).toBe(200);
  });

  it('invalidates every pre-recovery token when a verified OTP resets the password', async () => {
    const oldToken = generateToken(db.users[0]);
    const id = 'recovery-otp-synthetic';
    const challenge = {
      id,
      mobile: testMobile,
      purpose: 'password_recovery' as const,
      hashedOtp: bcrypt.hashSync('123456', 4),
      createdAt: Date.now() - 5_000,
      expiresAt: Date.now() + 120_000,
      attempts: 0,
      consumedAt: Date.now() - 1_000,
    };
    db.otpChallenges.push(challenge);

    const reset = await request(app).post('/api/auth/recover-password')
      .send({ mobile: testMobile, newPassword: 'new-password-03', otpChallengeId: id });
    expect(reset.status).toBe(200);
    expect(db.users[0].sessionVersion).toBe(1);
    expect(db.auditLogs.filter(log => log.entityId === db.users[0].id)
      .every(log => !log.details.includes(testMobile) && !log.details.includes(db.users[0].name))).toBe(true);
    expect(db.otpChallenges[0].recoveredAt).toEqual(expect.any(Number));
    expect((await request(app).get('/api/private').set(bearer(oldToken))).status).toBe(401);
    expect((await request(app).get('/api/private').set(bearer(generateToken(db.users[0])))).status).toBe(200);

    const repeat = await request(app).post('/api/auth/recover-password')
      .send({ mobile: testMobile, newPassword: 'attacker-override', otpChallengeId: id });
    expect(repeat.status).not.toBe(200);
    expect(db.users[0].sessionVersion).toBe(1);
  });

  it('accepts legacy JWTs without sv only before the first rotation and rejects malformed versions', async () => {
    const old = jwt.sign({ id: db.users[0].id, roles: ['student'] }, process.env.JWT_SECRET!, { expiresIn: '1h' });
    expect((await request(app).get('/api/private').set(bearer(old))).status).toBe(200);
    const malformed = jwt.sign({ id: db.users[0].id, sv: '0' }, process.env.JWT_SECRET!, { expiresIn: '1h' });
    expect((await request(app).get('/api/private').set(bearer(malformed))).status).toBe(401);
    db.users[0].sessionVersion = 1;
    expect((await request(app).get('/api/private').set(bearer(old))).status).toBe(401);
  });
  it('keeps the original credential, JWT and audit on failed password-change persistence', async () => {
    const user = db.users[0];
    const originalHash = user.password;
    const token = generateToken(user);
    const fail = vi.spyOn(db, 'save').mockImplementationOnce(() => {
      throw new Error('SYNTHETIC_PRIVATE_PATH:/private/credential.env');
    });
    let response;
    try {
      response = await request(app).post('/api/auth/change-password')
        .set(bearer(token)).send({ currentPassword: originalPassword, newPassword: 'unsaved-password-04' });
    } finally {
      fail.mockRestore();
    }
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('SYNTHETIC_PRIVATE_PATH');
    expect(user.password).toBe(originalHash);
    expect(user.sessionVersion).toBeUndefined();
    expect(db.auditLogs).toHaveLength(0);
    expect((await request(app).get('/api/private').set(bearer(token))).status).toBe(200);

    const retry = await request(app).post('/api/auth/change-password')
      .set(bearer(token)).send({ currentPassword: originalPassword, newPassword: 'saved-password-04' });
    expect(retry.status).toBe(200);
    expect(user.sessionVersion).toBe(1);
    expect((await request(app).get('/api/private').set(bearer(token))).status).toBe(401);
  });

  it('retains a verified recovery OTP for retry when the credential write fails', async () => {
    const user = db.users[0];
    const originalHash = user.password;
    const token = generateToken(user);
    const challenge = {
      id: 'synthetic-recovery-durable-otp',
      mobile: testMobile,
      purpose: 'password_recovery' as const,
      hashedOtp: bcrypt.hashSync('333333', 4),
      createdAt: Date.now() - 1000,
      expiresAt: Date.now() + 120000,
      attempts: 0,
      consumedAt: Date.now() - 300,
      recoveredAt: undefined as number | undefined,
    };
    db.otpChallenges.push(challenge);
    const fail = vi.spyOn(db, 'save').mockImplementationOnce(() => {
      throw new Error('SYNTHETIC_PRIVATE_PATH:/private/otp.env');
    });
    let response;
    try {
      response = await request(app).post('/api/auth/recover-password')
        .send({ mobile: testMobile, newPassword: 'unsaved-password-05', otpChallengeId: challenge.id });
    } finally {
      fail.mockRestore();
    }
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('SYNTHETIC_PRIVATE_PATH');
    expect(user.password).toBe(originalHash);
    expect(user.sessionVersion).toBeUndefined();
    expect(challenge.recoveredAt).toBeUndefined();
    expect(db.auditLogs).toHaveLength(0);
    expect((await request(app).get('/api/private').set(bearer(token))).status).toBe(200);

    const retry = await request(app).post('/api/auth/recover-password')
      .send({ mobile: testMobile, newPassword: 'saved-password-05', otpChallengeId: challenge.id });
    expect(retry.status).toBe(200);
    expect(challenge.recoveredAt).toEqual(expect.any(Number));
    expect(user.sessionVersion).toBe(1);
    expect((await request(app).get('/api/private').set(bearer(token))).status).toBe(401);
  });

});
