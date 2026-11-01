import { beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { demandRouter } from '../server/routes/demand';
import { generateToken } from '../server/middleware/auth';
import type { DemandSurvey, User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/demand', demandRouter);

beforeAll(async () => { await db.init(true); });

describe('P0 demand report privacy against forged privileged records', () => {
  it('denies a fake root label even with all permissions and matching scopes', async () => {
    const original = db.data;
    const scope = { campusId: 'security-unit', degreeLevelId: 'security-degree', majorId: 'security-major' };
    const forged: User = {
      id: 'security-forged-demand-root', mobile: '09900009991', name: 'Synthetic',
      roles: ['super-admin', 'admin'], permissions: ['demand.manage', 'demand.export'],
      demandScopes: [scope], createdAt: new Date().toISOString(),
    };
    const survey: DemandSurvey = {
      id: 'security-survey', title: 'Synthetic security survey', description: '',
      targetTermId: 'security-term', universityId: 'security-university',
      curriculumId: 'security-chart', ...scope,
      entryYearIds: [], trackIds: [], courseIds: [], recommendedMinimumByCourse: {},
      status: 'OPEN', createdBy: 'usr-super', createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      db.data = {
        ...original,
        users: [...original.users, forged],
        demandSurveys: [...original.demandSurveys, survey],
        demandResponses: [],
        auditLogs: [...original.auditLogs],
      };
      const forgedAuth = { Authorization: 'Bearer ' + generateToken(forged) };
      expect((await request(app).get('/api/demand/surveys/security-survey/report')
        .set(forgedAuth)).status).toBe(403);
      expect((await request(app).get('/api/demand/surveys/security-survey/export.csv')
        .set(forgedAuth)).status).toBe(403);

      const root = db.users.find(user => user.id === 'usr-super');
      if (!root) throw new Error('Verified synthetic root fixture missing');
      const rootAuth = { Authorization: 'Bearer ' + generateToken(root) };
      expect((await request(app).get('/api/demand/surveys/security-survey/report')
        .set(rootAuth)).status).toBe(200);
      expect((await request(app).get('/api/demand/surveys/security-survey/export.csv')
        .set(rootAuth)).status).toBe(200);
    } finally {
      db.data = original;
      db.save();
    }
  });
});
