import { beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { curriculumRouter } from '../server/routes/curriculum';
import { db } from '../server/db/database';
import { generateToken } from '../server/middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/curriculum', curriculumRouter);

let token = '';
let publishedId = '';
let courseId = '';
let sourceId = '';
beforeAll(async () => {
  await db.init(true);
  const owner = db.users.find(user => user.roles?.includes('super-admin'));
  const published = db.curricula.find(chart => chart.status === 'active');
  if (!owner || !published || db.courses.length < 2) throw new Error('Missing synthetic academic release fixtures');
  token = 'Bearer ' + generateToken(owner);
  publishedId = published.id;
  courseId = db.courses[0].id;
  sourceId = db.courses[1].id;
});

describe('active charts are immutable until an evidence-backed revision is approved', () => {
  it('rejects mutations to published chart metadata and deletion', async () => {
    const before = JSON.stringify(db.curricula.find(chart => chart.id === publishedId));
    const update = await request(app).put('/api/curriculum/' + publishedId)
      .set('Authorization', token).send({ name: 'بدون تأیید', status: 'draft' });
    expect(update.status).toBe(409);
    const remove = await request(app).delete('/api/curriculum/' + publishedId)
      .set('Authorization', token);
    expect(remove.status).toBe(409);
    expect(JSON.stringify(db.curricula.find(chart => chart.id === publishedId))).toBe(before);
  });

  it('rejects direct group/course and prerequisite modification to a published chart', async () => {
    const before = db.curriculumCourses.length;
    const add = await request(app).post(`/api/curriculum/${publishedId}/courses`)
      .set('Authorization', token)
      .send({ courseId, classification: 'MAJOR_REQUIRED', suggestedSemester: 1 });
    expect(add.status).toBe(409);
    const remove = await request(app).delete(`/api/curriculum/${publishedId}/courses/${courseId}`)
      .set('Authorization', token);
    expect(remove.status).toBe(409);
    const relation = await request(app).post('/api/curriculum/rules')
      .set('Authorization', token)
      .send({ curriculumId: publishedId, targetCourseId: courseId,
        relationshipType: 'PREREQUISITE', expression: { type: 'COURSE', courseId: sourceId } });
    expect(relation.status).toBe(409);
    expect(db.curriculumCourses.length).toBe(before);
  });
});
