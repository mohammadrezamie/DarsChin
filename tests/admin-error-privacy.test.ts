import { beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { adminRouter } from '../server/routes/admin';
import { generateToken } from '../server/middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
let rootAuth = '';

beforeAll(async () => {
  await db.init(true);
  const root = db.users.find(user => user.id === 'usr-super');
  if (!root) throw new Error('Synthetic root fixture missing');
  rootAuth = 'Bearer ' + generateToken(root);
});

describe('administrative API internal exception privacy', () => {
  it('does not expose internal backup serialization errors or file paths', async () => {
    const secret = 'SYNTHETIC_SECRET_MARKER:/etc/darschyn/runtime.env';
    const spy = vi.spyOn(db, 'exportBackup').mockImplementationOnce(() => { throw new Error(secret); });
    try {
      const res = await request(app).get('/api/admin/backup').set('Authorization', rootAuth);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: 'آماده‌سازی فایل پشتیبان ناموفق بود.' });
      expect(JSON.stringify(res.body)).not.toContain(secret);
    } finally {
      spy.mockRestore();
    }
  });
});
