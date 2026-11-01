import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { supportRouter } from '../server/routes/support';
import { generateToken } from '../server/middleware/auth';
import type { User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/support', supportRouter);

const firstId = 'synthetic-support-integrity-a';
const secondId = 'synthetic-support-integrity-b';
const adminId = 'synthetic-support-integrity-admin';
const fixtureTicketId = 'synthetic-support-integrity-ticket';
const marker = 'SYNTHETIC_PRIVATE_MARKER:/secure/production.env';
const createdIds: string[] = [];
let firstAuth = '';
let secondAuth = '';
let adminAuth = '';

beforeAll(async () => {
  await db.init(true);
  const users: User[] = [
    { id: firstId, mobile: '09900008201', name: 'Support fixture A', roles: ['student'], createdAt: new Date().toISOString() },
    { id: secondId, mobile: '09900008202', name: 'Support fixture B', roles: ['student'], createdAt: new Date().toISOString() },
    { id: adminId, mobile: '09900008203', name: 'Support fixture admin', roles: ['admin'], permissions: ['support.manage'], createdAt: new Date().toISOString() },
  ];
  db.users.push(...users);
  db.supportTickets.push({
    id: fixtureTicketId, userId: firstId, subject: 'Synthetic private ticket',
    status: 'OPEN', createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
  });
  firstAuth = 'Bearer ' + generateToken(users[0]);
  secondAuth = 'Bearer ' + generateToken(users[1]);
  adminAuth = 'Bearer ' + generateToken(users[2]);
});

afterAll(() => {
  db.data.users = db.users.filter(u => ![firstId, secondId, adminId].includes(u.id));
  db.data.supportTickets = db.supportTickets.filter(t => t.id !== fixtureTicketId && !createdIds.includes(t.id));
  db.data.supportMessages = db.supportMessages.filter(m => m.ticketId !== fixtureTicketId && !createdIds.includes(m.ticketId));
  db.data.bugReports = db.bugReports.filter(b => b.userId !== firstId && b.userId !== secondId);
  db.save();
});

async function withFailedSave<T>(action: () => Promise<T>): Promise<T> {
  const save = vi.spyOn(db, 'save').mockImplementationOnce(() => { throw new Error(marker); });
  try {
    return await action();
  } finally {
    save.mockRestore();
  }
}

describe('support ticket privacy and durable writes', () => {
  it('creates distinct ticket IDs even for different users in the same millisecond', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1800000000000);
    try {
      const a = await request(app).post('/api/support/tickets')
        .set('Authorization', firstAuth).send({ subject: 'Private A' });
      const b = await request(app).post('/api/support/tickets')
        .set('Authorization', secondAuth).send({ subject: 'Private B' });
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(a.body.data.id).not.toBe(b.body.data.id);
      createdIds.push(a.body.data.id, b.body.data.id);
      expect(a.headers['cache-control']).toBe('no-store');
      const forbidden = await request(app).get('/api/support/tickets/' + a.body.data.id + '/messages')
        .set('Authorization', secondAuth);
      expect(forbidden.status).toBe(403);
      const own = await request(app).get('/api/support/tickets')
        .set('Authorization', secondAuth);
      expect(own.body.data.some((t: { id: string }) => t.id === a.body.data.id)).toBe(false);
    } finally {
      clock.mockRestore();
    }
  });

  it('does not retain a phantom ticket when disk persistence fails', async () => {
    const before = db.supportTickets.length;
    const response = await withFailedSave(() => request(app).post('/api/support/tickets')
      .set('Authorization', firstAuth).send({ subject: marker }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain(marker);
    expect(db.supportTickets).toHaveLength(before);
  });

  it('rolls back message and ticket metadata together on failure', async () => {
    const ticket = db.supportTickets.find(t => t.id === fixtureTicketId)!;
    const original = JSON.stringify(ticket);
    const before = db.supportMessages.length;
    const response = await withFailedSave(() => request(app).post('/api/support/tickets/' + fixtureTicketId + '/messages')
      .set('Authorization', firstAuth).send({ content: marker }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain(marker);
    expect(db.supportMessages).toHaveLength(before);
    expect(JSON.stringify(ticket)).toBe(original);
  });

  it('does not retain a phantom bug report after a disk error', async () => {
    const before = db.bugReports.length;
    const response = await withFailedSave(() => request(app).post('/api/support/bugs')
      .set('Authorization', firstAuth).send({
        title: 'Synthetic bug', category: 'OTHER', severity: 'LOW', description: marker,
      }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain(marker);
    expect(db.bugReports).toHaveLength(before);
  });

  it('restores ticket status if an administrator update cannot be saved', async () => {
    const ticket = db.supportTickets.find(t => t.id === fixtureTicketId)!;
    const before = ticket.status;
    const response = await withFailedSave(() => request(app).put('/api/support/admin/tickets/' + fixtureTicketId + '/status')
      .set('Authorization', adminAuth).send({ status: 'CLOSED' }));
    expect(response.status).toBe(500);
    expect(ticket.status).toBe(before);
    expect(JSON.stringify(response.body)).not.toContain(marker);
  });

  it('never allows another student to post to somebody else\'s ticket', async () => {
    const response = await request(app).post('/api/support/tickets/' + fixtureTicketId + '/messages')
      .set('Authorization', secondAuth).send({ content: 'Unauthorized message' });
    expect(response.status).toBe(403);
    expect(db.supportMessages.some(m => m.ticketId === fixtureTicketId && m.senderId === secondId)).toBe(false);
  });
});
