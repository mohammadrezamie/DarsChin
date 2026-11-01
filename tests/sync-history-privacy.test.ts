import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { generateToken } from '../server/middleware/auth';
import { syncRouter, type SyncJob } from '../server/routes/sync';
import type { User, StudentProfile } from '../src/types';

const app = express();
app.use('/api/sync', syncRouter);

const prefix = 'scope-history-';
const managedUser = prefix + 'managed';
const otherUser = prefix + 'other';
const managerId = prefix + 'manager';
const outsiderId = prefix + 'outsider';
const now = new Date().toISOString();
let managerToken = '';
let outsiderToken = '';
let rootToken = '';
const job = (id: string, userId: string, campusId: string, error = ''): SyncJob => ({
  id: prefix + id,
  userId, campusId, termId: prefix + 'term',
  status: error ? 'FAILED' : 'RUNNING',
  startedAt: now, totalSnapshots: 0, processedSnapshots: 0,
  error: error || undefined, reconciliationErrors: error ? [error] : [],
});

beforeAll(async () => {
  await db.init(true);
  const root = db.users.find(user => user.id === 'usr-super');
  if (!root) throw new Error('Missing synthetic root');
  rootToken = generateToken(root);

  const campus = prefix + 'campus';
  const degree = prefix + 'degree';
  const major = prefix + 'major';
  const user = (id: string, roles: User['roles'], permissions: string[] = []): User => ({
    id, mobile: id === managerId ? '09900007611' : id === outsiderId ?
      '09900007612' : id === managedUser ? '09900007613' : '09900007614',
    name: 'Synthetic scope fixture', roles, permissions, createdAt: now,
  });
  const manager = user(managerId, ['admin','student'], ['admin.panel.access']);
  manager.demandScopes = [{ campusId: campus, degreeLevelId: degree, majorId: major }];
  const outsider = user(outsiderId, ['admin','student'], ['admin.panel.access']);
  db.users.push(manager, outsider, user(managedUser, ['student']), user(otherUser, ['student']));
  managerToken = generateToken(manager);
  outsiderToken = generateToken(outsider);

  const profile = (id: string, majorId: string): StudentProfile => ({
    userId: id, universityId: prefix + 'university', campusId: campus,
    degreeLevelId: degree, majorId, entryYearId: prefix + 'year',
    isTrackSelected: false, desiredTrackIds: [], updatedAt: now,
  });
  db.studentProfiles.push(profile(managedUser, major), profile(otherUser, prefix + 'other-major'));
  db.syncJobs.push(
    job('managed', managedUser, campus, 'private imported row from student'),
    job('other-major', otherUser, campus, 'student outside assigned major'),
    job('manager-own', managerId, campus),
    job('wrong-campus', managedUser, prefix + 'different-campus'),
  );
});

afterAll(() => {
  const ids = new Set([managedUser, otherUser, managerId, outsiderId]);
  db.data.users = db.users.filter(user => !ids.has(user.id));
  db.data.studentProfiles = db.studentProfiles.filter(p => !ids.has(p.userId));
  db.syncJobs = db.syncJobs.filter(j => !j.id.startsWith(prefix));
  db.save();
});

const fetchHistory = (token: string) => request(app).get('/api/sync/jobs')
  .set('Authorization', 'Bearer ' + token);

describe('admin sync history is private by assigned academic scope', () => {
  it('returns only self and scoped student records, without raw importer errors', async () => {
    const r = await fetchHistory(managerToken);
    expect(r.status).toBe(200);
    const ours = (r.body.data as SyncJob[]).filter(j => j.id.startsWith(prefix));
    expect(ours.map(j => j.id).sort()).toEqual([
      prefix + 'managed', prefix + 'manager-own',
    ].sort());
    expect(ours.find(j => j.userId === managedUser)?.error).not.toContain('private imported row');
    expect(ours.every(j => !JSON.stringify(j.reconciliationErrors).includes('private imported row'))).toBe(true);
    expect(JSON.stringify(ours)).not.toContain('student outside assigned major');
  });

  it('never treats plain admin.panel.access as permission to browse other student jobs', async () => {
    const r = await fetchHistory(outsiderToken);
    expect(r.status).toBe(200);
    expect((r.body.data as SyncJob[]).filter(j => j.id.startsWith(prefix))).toEqual([]);
  });

  it('retains all original records and diagnostics for authenticated configured root only', async () => {
    const r = await fetchHistory(rootToken);
    expect(r.status).toBe(200);
    const ours = (r.body.data as SyncJob[]).filter(j => j.id.startsWith(prefix));
    expect(ours).toHaveLength(4);
    expect(ours.find(j => j.id === prefix + 'managed')?.error)
      .toBe('private imported row from student');
  });

  it('does not expose history to a student even if student can read own sync status', async () => {
    const student = db.users.find(u => u.id === managedUser)!;
    expect((await fetchHistory(generateToken(student))).status).toBe(403);
  });
});
