import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, type DatabaseSchema } from '../server/db/database';
import { authenticate, generateToken } from '../server/middleware/auth';
import { authRouter } from '../server/routes/auth';
import { curriculumRouter } from '../server/routes/curriculum';
import { demandRouter } from '../server/routes/demand';
import { offeringsRouter } from '../server/routes/offerings';
import { smsCenterRouter } from '../server/routes/sms-center';
import type { User, DemandSurvey, StudentAcademicProfile } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/curriculum', curriculumRouter);
app.use('/api/demand', demandRouter);
app.use('/api/offerings', offeringsRouter);
app.use('/api/sms-center', smsCenterRouter);
app.get('/api/private', authenticate, (_req, res) => res.json({ success: true }));

const secretMarker = 'SYNTHETIC_PRIVATE_LOCATION:/secrets/real-operator.env';
let original: DatabaseSchema;
let adminAuth = '';
let studentAuth = '';
let rootAuth = '';
let chartId = '';
let courseId = '';
let campusId = '';
let termId = '';
let originalStudentNumber: string | undefined;
const currentUserId = 'synthetic-security-coverage-student';
const adminId = 'synthetic-security-coverage-manager';

beforeAll(async () => { await db.init(true); });
beforeEach(() => {
  original = db.data;
  const chart = original.curricula.find(c => c.status === 'active' && original.curriculumCourses.some(cc => cc.curriculumId === c.id && cc.active !== false));
  if (!chart) throw Error('Requires a seeded active chart and course');
  chartId = chart.id;
  campusId = chart.campusId;
  termId = original.academicTerms[0].id;
  courseId = original.curriculumCourses.find(cc => cc.curriculumId === chartId && cc.active !== false)!.courseId;
  const student: User = { id: currentUserId, name: 'Synthetic Student', mobile: '09900008381',
    roles: ['student'], createdAt: new Date().toISOString() };
  const manager: User = { id: adminId, name: 'Synthetic Manager', mobile: '09900008382',
    roles: ['admin'], permissions: ['curriculum.manage', 'offering.manage', 'sms.manage'],
    createdAt: new Date().toISOString() };
  const root: User = { id: 'usr-super', mobile: process.env.ROOT_OWNER_MOBILE!, name: 'Synthetic Root',
    roles: ['super-admin', 'admin', 'student'], createdAt: new Date().toISOString() };
  const profile: StudentAcademicProfile = { userId: student.id, universityId: chart.universityId,
    campusId: chart.campusId, degreeLevelId: chart.degreeLevelId, majorId: chart.majorId,
    entryYearId: chart.entryYearId, isTrackSelected: false, desiredTrackIds: [],
    studentNumber: '1403555511', currentTermId: termId, updatedAt: new Date().toISOString() };
  originalStudentNumber = profile.studentNumber;
  db.data = {
    ...original,
    users: [student, manager, root], studentProfiles: [profile],
    curricula: [{ ...chart }, { ...chart, id: 'synthetic-unpublished-chart', status: 'draft' }],
    demandSurveys: [], demandResponses: [], auditLogs: [], smsHistory: [],
    smsSettings: undefined,
    courseOfferings: [...original.courseOfferings],
  };
  studentAuth = 'Bearer ' + generateToken(student);
  adminAuth = 'Bearer ' + generateToken(manager);
  rootAuth = 'Bearer ' + generateToken(root);
});
afterEach(() => {
  vi.restoreAllMocks();
  db.data = original;
});
const failure = () => vi.spyOn(db, 'save').mockImplementationOnce(() => { throw Error(secretMarker); });
const noSecrets = (res: { body: unknown }) => expect(JSON.stringify(res.body)).not.toContain(secretMarker);
const survey = (): DemandSurvey => ({
  id: 'synthetic-durable-demand', title: 'Synthetic Demand', description: 'Private test',
  status: 'DRAFT', targetTermId: termId,
  universityId: db.studentProfiles[0].universityId, campusId,
  degreeLevelId: db.studentProfiles[0].degreeLevelId, majorId: db.studentProfiles[0].majorId,
  curriculumId: chartId, entryYearIds: [db.studentProfiles[0].entryYearId],
  trackIds: [], courseIds: [courseId], recommendedMinimumByCourse: {},
  createdBy: 'usr-super', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});
const offeringPayload = () => ({
  termId, campusId, courseId, groupCode: '38', instructor: 'Synthetic Teacher',
  capacity: 20, startTime: '09:00', endTime: '11:00', dayOfWeek: 'شنبه',
});

describe('session revocation and login audit integrity', () => {
  it('logout revokes every existing signed JWT, not just the browser UI', async () => {
    const oldToken = studentAuth;
    expect((await request(app).get('/api/private').set('Authorization', oldToken)).status).toBe(200);
    const logout = await request(app).post('/api/auth/logout').set('Authorization', oldToken);
    expect(logout.status).toBe(200);
    expect((await request(app).get('/api/private').set('Authorization', oldToken)).status).toBe(401);
    expect(db.auditLogs.filter(x => x.action === 'USER_LOGOUT_ALL_SESSIONS')).toHaveLength(1);
  });
  it('cannot report a successful logout without saving session invalidation', async () => {
    const spy = failure();
    const response = await request(app).post('/api/auth/logout').set('Authorization', studentAuth);
    spy.mockRestore();
    expect(response.status).toBe(503);
    noSecrets(response);
    expect(db.users[0].sessionVersion).toBeUndefined();
    expect(db.auditLogs).toHaveLength(0);
    expect((await request(app).get('/api/private').set('Authorization', studentAuth)).status).toBe(200);
  });
});

describe('public and managerial curriculum visibility', () => {
  it('keeps drafts and archived charts hidden from anonymous and student requests', async () => {
    for (const auth of ['', studentAuth]) {
      const list = auth ? await request(app).get('/api/curriculum').set('Authorization', auth)
        : await request(app).get('/api/curriculum');
      expect(list.status).toBe(200);
      expect(list.body.data.some((c: { id: string }) => c.id === 'synthetic-unpublished-chart')).toBe(false);
      const hidden = auth ? await request(app).get('/api/curriculum/synthetic-unpublished-chart/full').set('Authorization', auth)
        : await request(app).get('/api/curriculum/synthetic-unpublished-chart/full');
      expect(hidden.status).toBe(404);
    }
    const denied = await request(app).get('/api/curriculum/synthetic-unpublished-chart/full')
      .set('Authorization', 'Bearer forged');
    expect(denied.status).toBe(401);
  });
  it('preserves authenticated academic-manager access to draft charts', async () => {
    const listing = await request(app).get('/api/curriculum').set('Authorization', adminAuth);
    expect(listing.status).toBe(200);
    expect(listing.body.data.some((c: { id: string }) => c.id === 'synthetic-unpublished-chart')).toBe(true);
    const details = await request(app).get('/api/curriculum/synthetic-unpublished-chart/full')
      .set('Authorization', adminAuth);
    expect(details.status).toBe(200);
  });
});

describe('academic and personal operations fail without phantom records', () => {
  it('rolls back a survey status and its audit when storage fails', async () => {
    const created = survey();
    db.demandSurveys.push(created);
    const snapshot = JSON.stringify(created);
    const spy = failure();
    const response = await request(app).put('/api/demand/surveys/' + created.id + '/status')
      .set('Authorization', rootAuth).send({ status: 'OPEN' });
    spy.mockRestore();
    expect(response.status).toBe(503);
    noSecrets(response);
    expect(JSON.stringify(created)).toBe(snapshot);
    expect(db.auditLogs).toHaveLength(0);
  });
  it('restores student demand data and student identifier when save fails', async () => {
    const created = survey();
    created.status = 'OPEN';
    db.demandSurveys.push(created);
    const spy = failure();
    const response = await request(app).put('/api/demand/surveys/' + created.id + '/response')
      .set('Authorization', studentAuth).send({
        courseIds: [courseId], studentNumber: '1403999999', anticipatedGraduation: 'NO',
      });
    spy.mockRestore();
    expect(response.status).toBe(503);
    noSecrets(response);
    expect(db.demandResponses).toHaveLength(0);
    expect(db.studentProfiles[0].studentNumber).toBe(originalStudentNumber);
  });
  it('never changes SMS provider settings or records an audit without a successful save', async () => {
    const spy = failure();
    const response = await request(app).put('/api/sms-center/settings')
      .set('Authorization', adminAuth).send({
        mode: 'niazpardaz', senderLine: '50001234', otpTemplate: 'کد تأیید شما: {code}',
      });
    spy.mockRestore();
    expect(response.status).toBe(503);
    noSecrets(response);
    expect(db.data.smsSettings).toBeUndefined();
    expect(db.auditLogs).toHaveLength(0);
  });
  it('restores course offerings on failed create, update and delete', async () => {
    const before = JSON.stringify(db.courseOfferings);
    let spy = failure();
    const create = await request(app).post('/api/offerings').set('Authorization', adminAuth).send(offeringPayload());
    spy.mockRestore();
    expect(create.status).toBe(503);
    noSecrets(create);
    expect(JSON.stringify(db.courseOfferings)).toBe(before);

    const existing = db.courseOfferings[0];
    if (!existing) throw Error('Requires a seeded offering');
    const originalName = existing.instructor;
    spy = failure();
    const update = await request(app).put('/api/offerings/' + existing.id)
      .set('Authorization', adminAuth).send({ instructor: 'Changed Teacher' });
    spy.mockRestore();
    expect(update.status).toBe(503);
    expect(existing.instructor).toBe(originalName);
    expect(JSON.stringify(db.courseOfferings)).toBe(before);

    spy = failure();
    const remove = await request(app).delete('/api/offerings/' + existing.id).set('Authorization', adminAuth);
    spy.mockRestore();
    expect(remove.status).toBe(503);
    expect(JSON.stringify(db.courseOfferings)).toBe(before);
  });
});
