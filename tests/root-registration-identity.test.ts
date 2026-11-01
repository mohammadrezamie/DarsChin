import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { db } from '../server/db/database';
import authRouter from '../server/routes/auth';
import { otpRouter } from '../server/routes/otp';
import { resolveBootstrapRoot } from '../server/db/root-identity';

const app = express();
app.use(express.json());
app.use('/api/auth/otp', otpRouter);
app.use('/api/auth', authRouter);

beforeAll(async () => {
  vi.stubEnv('TURNSTILE_ENABLED', 'false');
  await db.init(true);
});

describe('P0 privileged root identity isolation', () => {
  const root = { id: 'usr-super', mobile: '09999999999', roles: ['super-admin'] };
  const student = { id: 'usr-student', mobile: '09120000000', roles: ['student'] };

  it('selects only the reserved root identity even if another user exists', () => {
    expect(resolveBootstrapRoot([student, root], root.mobile)).toBe(root);
    expect(resolveBootstrapRoot([student], '09999999999')).toBeUndefined();
  });

  it('refuses to turn an existing student into root when the configured number collides', () => {
    expect(() => resolveBootstrapRoot([student], student.mobile)).toThrow(/conflicts/);
    expect(student.roles).toEqual(['student']);
    expect(() => resolveBootstrapRoot([student, root], student.mobile)).toThrow(/conflicts/);
  });

  it('recognizes international and Persian-formatted collisions, not just raw phone equality', () => {
    const international = { ...student, mobile: '+989121234567' };
    expect(() => resolveBootstrapRoot([international, root], '09121234567')).toThrow(/conflicts/);
    const persian = { ...student, mobile: '۰۹۱۲۱۲۳۴۵۶۷' };
    expect(() => resolveBootstrapRoot([persian, root], '09121234567')).toThrow(/conflicts/);
  });

  it('rejects noncanonical admin phone settings rather than creating an unreachable root', () => {
    expect(() => resolveBootstrapRoot([root], '+989999999999')).toThrow(/canonical/);
    expect(() => resolveBootstrapRoot([root], 'not-a-mobile')).toThrow(/canonical/);
  });
});

describe('P0 concurrent public registration identity durability', () => {
  it('creates independent UUID identities and one-way recovery verifiers with an identical millisecond clock', async () => {
    const mobiles = ['09988000001', '09988000002'];
    async function challenge() {
      const response = await request(app).get('/api/auth/otp/captcha/generate?action=register');
      expect(response.status).toBe(200);
      const id = response.body.data.id as string;
      const answer = db.captchaChallenges.find(c => c.id === id)?.value;
      expect(answer).toBeTruthy();
      return `local:${id}:${answer}`;
    }
    const firstCaptcha = await challenge();
    const secondCaptcha = await challenge();
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);
    let createdIds: string[] = [];
    try {
      for (const [i, mobile] of mobiles.entries()) {
        const result = await request(app).post('/api/auth/register').send({
          mobile,
          password: 'Synthetic-Pilot-Registration-Password',
          name: `Synthetic Student ${i + 1}`,
          captchaToken: i === 0 ? firstCaptcha : secondCaptcha,
        });
        expect(result.status).toBe(201);
        const id = result.body.data.user.id as string;
        createdIds.push(id);
        expect(id).toMatch(/^usr-[a-f0-9-]{36}$/);
      }
      expect(new Set(createdIds).size).toBe(2);
      for (const id of createdIds) {
        const saved = db.users.find(u => u.id === id);
        expect(saved).toBeDefined();
        expect(saved?.roles).toEqual(['student']);
        expect(saved?.recoveryKey).toMatch(/^\$2[aby]\$\d{2}\$/);
        expect(saved?.recoveryKey).not.toContain('rec-');
        expect(db.studentProfiles.filter(p => p.userId === id)).toHaveLength(1);
      }
      const rootUser = db.users.find(u => u.id === 'usr-super');
      if (rootUser) expect(rootUser.roles).toContain('super-admin');
    } finally {
      spy.mockRestore();
      db.data.users = db.users.filter(u => !createdIds.includes(u.id));
      db.data.studentProfiles = db.studentProfiles.filter(p => !createdIds.includes(p.userId));
      db.data.auditLogs = db.auditLogs.filter(log => !createdIds.includes(log.adminId));
      db.save();
    }
  });
});
