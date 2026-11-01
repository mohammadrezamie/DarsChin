import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createGuestAbuseLimiters } from '../server/middleware/guest-abuse';

describe('guest throttling and trusted proxy boundaries', () => {
  it('limits repeated image generation and returns a machine-readable retry interval', async () => {
    const app = express();
    app.set('trust proxy', 'loopback');
    app.get('/captcha', createGuestAbuseLimiters().captcha, (_req, res) => res.json({ success: true }));
    const forwarded = { 'X-Forwarded-For': '198.51.100.23' };

    for (let i = 0; i < 240; i += 1) {
      const response = await request(app).get('/captcha').set(forwarded);
      expect(response.status).toBe(200);
    }
    const limited = await request(app).get('/captcha').set(forwarded);
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limited.headers['ratelimit']).toBeDefined();
    expect(limited.body).toMatchObject({ success: false });
    expect(limited.headers['cache-control']).toBe('no-store');
    const unrelated = await request(app).get('/captcha').set({ 'X-Forwarded-For': '198.51.100.24' });
    expect(unrelated.status).toBe(200);
  });

  it('does not allow attacker-supplied leftmost XFF entries to escape a limit behind localhost Nginx', async () => {
    const app = express();
    app.set('trust proxy', 'loopback');
    app.post('/register', createGuestAbuseLimiters().register, (_req, res) => res.json({ success: true }));
    for (let i = 0; i < 80; i += 1) {
      const response = await request(app).post('/register')
        .set('X-Forwarded-For', `203.0.113.${i + 1}, 198.51.100.60`);
      expect(response.status).toBe(200);
    }
    const blocked = await request(app).post('/register')
      .set('X-Forwarded-For', '203.0.113.200, 198.51.100.60');
    expect(blocked.status).toBe(429);
  });

  it('limits IPv6 address rotation within the same /56 network', async () => {
    const app = express();
    app.set('trust proxy', 'loopback');
    app.post('/register', createGuestAbuseLimiters().register, (_req, res) => res.status(204).end());
    for (let i = 0; i < 80; i += 1) {
      const ip = `2001:db8:1234:ab${(i % 16).toString(16).padStart(2, '0')}::1`;
      const response = await request(app).post('/register').set('X-Forwarded-For', ip);
      expect(response.status).toBe(204);
    }
    const blocked = await request(app).post('/register')
      .set('X-Forwarded-For', '2001:db8:1234:abff::5');
    expect(blocked.status).toBe(429);
  });

  it('leaves health checks and authenticated workspace API requests unaffected', async () => {
    const app = express();
    const limits = createGuestAbuseLimiters();
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
    app.post('/api/auth/otp/send', limits.otpSend, (_req, res) => res.status(202).end());
    for (let i = 0; i < 60; i += 1) {
      expect((await request(app).post('/api/auth/otp/send')).status).toBe(202);
    }
    expect((await request(app).post('/api/auth/otp/send')).status).toBe(429);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});
