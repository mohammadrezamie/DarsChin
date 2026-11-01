import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, LocalDatabase } from '../server/db/database';
import { adminRouter } from '../server/routes/admin';
import { generateToken } from '../server/middleware/auth';
import type { User } from '../src/types';

const fixtureUser: User = {
  id: 'fixture-user',
  mobile: '09000000000',
  name: 'Synthetic User',
  roles: ['student'],
  permissions: [],
  password: 'synthetic-password-hash',
  recoveryKey: 'synthetic-recovery-secret',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('sensitive administration exports', () => {
  it('removes recovery keys, password hashes and transient auth challenges without mutating the database', () => {
    const database = new LocalDatabase();
    database.data.users = [{ ...fixtureUser }];
    database.data.otpChallenges = [{
      id: 'fixture-otp',
      mobile: fixtureUser.mobile,
      purpose: 'login',
      hashedOtp: 'synthetic-otp-hash',
      createdAt: 1,
      expiresAt: 2,
      attempts: 0,
    }];
    database.data.captchaChallenges = [{
      id: 'fixture-captcha',
      value: 'synthetic-captcha-answer',
      createdAt: 1,
      expiresAt: 2,
      attempts: 0,
    }];

    const original = JSON.stringify(database.data);
    const backup = database.exportBackup();

    expect(backup.users).toHaveLength(1);
    expect(backup.users[0]).not.toHaveProperty('password');
    expect(backup.users[0]).not.toHaveProperty('recoveryKey');
    expect(backup.users[0].name).toBe(fixtureUser.name);
    expect(backup.otpChallenges).toEqual([]);
    expect(backup.captchaChallenges).toEqual([]);
    expect(JSON.stringify(database.data)).toBe(original);
  });

  it('keeps private recovery data out of authenticated admin HTTP responses', async () => {
    const app = express();
    app.use('/api/admin', adminRouter);

    const root: User = {
      id: 'fixture-root',
      mobile: '09000000001',
      name: 'Synthetic Admin',
      roles: ['super-admin'],
      permissions: ['backup.manage'],
      password: 'synthetic-root-hash',
      recoveryKey: 'synthetic-root-recovery-secret',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const originalUsers = db.data.users;
    try {
      db.data.users = [{ ...root }, { ...fixtureUser }];
      const auth = `Bearer ${generateToken(root)}`;
      const unauthorized = await request(app).get('/api/admin/users');
      expect(unauthorized.status).toBe(401);

      const users = await request(app)
        .get('/api/admin/users')
        .set('Authorization', auth);
      expect(users.status).toBe(200);
      expect(users.body.data).toHaveLength(2);
      for (const user of users.body.data) {
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('recoveryKey');
      }

      const backup = await request(app)
        .get('/api/admin/backup')
        .set('Authorization', auth);
      expect(backup.status).toBe(200);
      for (const user of backup.body.users) {
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('recoveryKey');
      }
      expect(backup.body.otpChallenges).toEqual([]);
      expect(backup.body.captchaChallenges).toEqual([]);

      // Privileged requests must not modify live account credentials.
      expect(db.data.users[0].recoveryKey).toBe(root.recoveryKey);
      expect(db.data.users[1].password).toBe(fixtureUser.password);
    } finally {
      db.data.users = originalUsers;
    }
  });
});
