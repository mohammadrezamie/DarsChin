import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { adminRouter } from '../server/routes/admin';
import { generateToken } from '../server/middleware/auth';
import type { StudentAcademicProfile, User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);

const delegateId = 'test-global-student-delegate';
const studentId = 'test-private-student-overview';
const now = new Date().toISOString();
let rootHeader = '';
let delegateHeader = '';

beforeAll(async () => {
  await db.init(true);
  const root = db.users.find(u => u.id === 'usr-super');
  if (!root) throw new Error('Missing synthetic root fixture');
  rootHeader = 'Bearer ' + generateToken(root);
  const delegate: User = {
    id: delegateId, mobile: '09900007981', name: 'Synthetic academic admin',
    roles: ['student', 'admin'],
    permissions: ['admin.panel.access', 'student-management.read', 'academic-policy.manage'],
    demandScopes: [{ campusId: 'test-camp', degreeLevelId: 'test-degree', majorId: 'test-major' }],
    createdAt: now,
  };
  const student: User = {
    id: studentId, mobile: '09900007982', name: 'Synthetic sensitive student',
    roles: ['student'], createdAt: now,
  };
  const profile: StudentAcademicProfile = {
    userId: studentId, universityId: 'test-univ',
    campusId: 'test-camp', degreeLevelId: 'test-degree', majorId: 'test-major',
    entryYearId: 'test-entry', isTrackSelected: false, desiredTrackIds: [],
    updatedAt: now,
  };
  db.users.push(delegate, student);
  db.studentProfiles.push(profile);
  delegateHeader = 'Bearer ' + generateToken(delegate);
});

afterAll(() => {
  db.data.users = db.users.filter(u => u.id !== delegateId && u.id !== studentId);
  db.data.studentProfiles = db.studentProfiles.filter(p => p.userId !== studentId);
  db.data.auditLogs = db.auditLogs.filter(a =>
    !(a.action === 'UPDATE_FINAL_SEMESTER_OVERRIDE' && a.entityId === studentId));
  db.save();
});

describe('global student directory is restricted to verified root', () => {
  it('does not enumerate student phone numbers for a delegated admin with legacy read grants', async () => {
    const denied = await request(app).get('/api/admin/students-overview')
      .set('Authorization', delegateHeader);
    expect(denied.status).toBe(403);
    expect(JSON.stringify(denied.body)).not.toContain('09900007982');

    const allowed = await request(app).get('/api/admin/students-overview')
      .set('Authorization', rootHeader);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.some((u: { userId: string }) => u.userId === studentId)).toBe(true);
  });

  it('does not allow the same delegated admin to change global graduation overrides', async () => {
    const previous = db.studentProfiles.find(p => p.userId === studentId)!;
    const snapshot = JSON.stringify(previous);
    const denied = await request(app)
      .put('/api/admin/students/' + studentId + '/final-semester-override')
      .set('Authorization', delegateHeader)
      .send({ isFinalSemesterOverride: true, finalSemesterNotes: 'test' });
    expect(denied.status).toBe(403);
    expect(JSON.stringify(previous)).toBe(snapshot);
  });

  it('saves the root override and its privacy-safe audit together', async () => {
    const before = db.auditLogs.filter(a =>
      a.action === 'UPDATE_FINAL_SEMESTER_OVERRIDE' && a.entityId === studentId).length;
    const privateNotes = 'synthetic private academic note';
    const response = await request(app)
      .put('/api/admin/students/' + studentId + '/final-semester-override')
      .set('Authorization', rootHeader)
      .send({ isFinalSemesterOverride: true, finalSemesterNotes: privateNotes });
    expect(response.status).toBe(200);
    const latest = db.auditLogs.find(a =>
      a.action === 'UPDATE_FINAL_SEMESTER_OVERRIDE' && a.entityId === studentId);
    expect(latest).toBeDefined();
    expect(latest?.details).not.toContain(privateNotes);
    expect(db.auditLogs.filter(a =>
      a.action === 'UPDATE_FINAL_SEMESTER_OVERRIDE' && a.entityId === studentId)).toHaveLength(before + 1);
    expect(db.studentProfiles.find(p => p.userId === studentId)?.isFinalSemesterOverride).toBe(true);
  });

  it('restores the previous in-memory student record and audit if persistence fails', async () => {
    const profile = db.studentProfiles.find(p => p.userId === studentId)!;
    const before = JSON.stringify(profile);
    const logCount = db.auditLogs.length;
    const secret = 'SYNTHETIC_SECRET:/etc/private/server.env';
    const fail = vi.spyOn(db, 'save').mockImplementationOnce(() => {
      throw new Error(secret);
    });
    try {
      const response = await request(app)
        .put('/api/admin/students/' + studentId + '/final-semester-override')
        .set('Authorization', rootHeader)
        .send({ isFinalSemesterOverride: false, finalSemesterNotes: secret });
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(secret);
      expect(JSON.stringify(profile)).toBe(before);
      expect(db.auditLogs).toHaveLength(logCount);
    } finally {
      fail.mockRestore();
    }
  });
});
