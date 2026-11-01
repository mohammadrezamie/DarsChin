import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import express from 'express';
import { assertRuntimeSecurityConfiguration } from '../server/security/runtime-config';
import { createGuestAbuseLimiters } from '../server/middleware/guest-abuse';

const secure = {
  NODE_ENV: 'production', JWT_SECRET: 'synthetic-random-separator-9d24f3db0df678eeb68c0d67',
  ROOT_OWNER_MOBILE: '09900000001',
  ROOT_OWNER_PASSWORD: 'synthetic-strong-root-unique-41',
  ROOT_OWNER_RECOVERY_KEY: 'synthetic-strong-recovery-unique-42',
} as NodeJS.ProcessEnv;

describe('production runtime credential validation', () => {
  it('accepts distinct sufficiently long synthetic secrets', () => {
    expect(() => assertRuntimeSecurityConfiguration(secure)).not.toThrow();
  });
  it('blocks common/default, missing, reused and weak credentials before bootstrap', () => {
    for (const overrides of [
      { JWT_SECRET: 'secret' },
      { JWT_SECRET: 'a'.repeat(40) },
      { JWT_SECRET: '' },
      { ROOT_OWNER_PASSWORD: '123456' },
      { ROOT_OWNER_PASSWORD: secure.JWT_SECRET },
      { ROOT_OWNER_RECOVERY_KEY: '' },
      { ROOT_OWNER_RECOVERY_KEY: secure.ROOT_OWNER_PASSWORD },
      { ROOT_OWNER_MOBILE: 'invalid' },
      { MOCK_OTP_CODE: '123456' },
    ]) {
      expect(() => assertRuntimeSecurityConfiguration({ ...secure, ...overrides })).toThrow();
    }
    expect(() => assertRuntimeSecurityConfiguration({ NODE_ENV: 'test' })).not.toThrow();
  });
  it('guards the real production startup before database initialization', () => {
    const file = readFileSync(resolve(process.cwd(), 'server.ts'), 'utf8');
    expect(file.indexOf('assertRuntimeSecurityConfiguration();')).toBeGreaterThan(0);
    expect(file.indexOf('assertRuntimeSecurityConfiguration();')).toBeLessThan(file.indexOf('await db.init(true);'));
  });
});

describe('separate brute-force and archive resource limits', () => {
  it('limits OTP verification attempts without affecting other APIs', async () => {
    const app = express();
    const lim = createGuestAbuseLimiters();
    app.post('/verify', lim.otpVerify, (_req, res) => res.sendStatus(204));
    app.post('/recover', lim.passwordRecovery, (_req, res) => res.sendStatus(204));
    for (let i=0; i<90; i++) expect((await request(app).post('/verify')).status).toBe(204);
    expect((await request(app).post('/verify')).status).toBe(429);
    expect((await request(app).post('/recover')).status).toBe(204);
  });
  it('limits expensive extension archive downloads separately from login', async () => {
    const app = express();
    const lim = createGuestAbuseLimiters();
    app.get('/extension', lim.extensionDownload, (_req, res) => res.sendStatus(204));
    app.post('/login', lim.login, (_req, res) => res.sendStatus(204));
    for (let i=0; i<20; i++) expect((await request(app).get('/extension')).status).toBe(204);
    expect((await request(app).get('/extension')).status).toBe(429);
    expect((await request(app).post('/login')).status).toBe(204);
  });
  it('mounts the additional limiters on actual server endpoints', () => {
    const source = readFileSync(resolve(process.cwd(), 'server.ts'), 'utf8');
    for (const fragment of [
      "app.post('/api/auth/otp/verify', guestLimits.otpVerify)",
      "app.post('/api/auth/recover-password', guestLimits.passwordRecovery)",
      "app.get('/api/extension/download', guestLimits.extensionDownload)",
    ]) expect(source).toContain(fragment);
  });
});
