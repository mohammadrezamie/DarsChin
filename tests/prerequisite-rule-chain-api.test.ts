import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { curriculumRouter } from '../server/routes/curriculum';
import { generateToken } from '../server/middleware/auth';
import type { Course, Curriculum, CurriculumCourse, User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/curriculum', curriculumRouter);

const prefix = 'graph-chain-api-regression-20261029';
const chartA = prefix + '-a';
const chartB = prefix + '-b';
const userId = prefix + '-admin';
const ids = ['A', 'B', 'C', 'D'].map(letter => prefix + '-' + letter);
let authorization = '';

beforeAll(async () => {
  await db.init(true);
  const base = db.curricula[0];
  const sampleCourse = db.courses[0];
  const sampleAssignment = db.curriculumCourses[0];
  if (!base || !sampleCourse || !sampleAssignment) throw Error('Synthetic curriculum fixtures unavailable');
  const user: User = {
    id: userId, name: 'مدیر آزمایشی پیش‌نیاز', mobile: '09999988023',
    roles: ['admin'], permissions: ['prerequisite.manage'],
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  authorization = 'Bearer ' + generateToken(user);
  for (const [id, name] of [[chartA, 'چارت A'], [chartB, 'چارت B']]) {
    db.curricula.push({
      ...base, id, name, version: prefix, status: 'draft',
    } as Curriculum);
    for (const courseId of ids) {
      db.curriculumCourses.push({
        ...sampleAssignment, id: prefix + '-link-' + id + '-' + courseId,
        curriculumId: id, courseId, active: true,
      } as CurriculumCourse);
    }
  }
  ids.forEach((id, index) => {
    db.courses.push({
      ...sampleCourse, id, code: prefix + index, name: 'درس آزمایشی ' + index,
      active: true,
    } as Course);
  });
  db.save();
});

afterAll(() => {
  db.data.users = db.users.filter(item => item.id !== userId);
  db.data.courses = db.courses.filter(item => !ids.includes(item.id));
  db.data.curricula = db.curricula.filter(item => ![chartA, chartB].includes(item.id));
  db.data.curriculumCourses = db.curriculumCourses.filter(item => ![chartA, chartB].includes(item.curriculumId));
  db.data.academicRules = db.academicRules.filter(item => ![chartA, chartB].includes(item.curriculumId));
  db.save();
});

const add = (chart: string, source: string, target: string,
  relationshipType: 'PREREQUISITE' | 'COREQUISITE' = 'PREREQUISITE') =>
  request(app).post('/api/curriculum/rules')
    .set('Authorization', authorization)
    .send({
      curriculumId: chart, targetCourseId: target, relationshipType,
      expression: { type: 'COURSE', courseId: source },
    });

describe('server-side long-chain prerequisite editing', () => {
  it('accepts a long valid chain and rejects cycles and out-of-chart references', async () => {
    const [a, b, c, d] = ids;
    expect((await add(chartA, a, b)).status).toBe(200);
    expect((await add(chartA, b, c)).status).toBe(200);
    expect((await add(chartA, c, d)).status).toBe(200);
    const before = db.academicRules.filter(rule => rule.curriculumId === chartA).length;
    const cycle = await add(chartA, d, a);
    expect(cycle.status).toBe(400);
    expect(cycle.body.error).toMatch(/چرخه/);
    expect((await add(chartA, a, a)).status).toBe(400);
    expect((await add(chartA, a, 'foreign-course')).status).toBe(400);
    expect(db.academicRules.filter(rule => rule.curriculumId === chartA)).toHaveLength(before);
  });

  it('keeps charts independent and permits reciprocal corequisites', async () => {
    const [a, b, c] = ids;
    // This edge would create a cycle if the server mixed chart A's B→C with chart B.
    expect((await add(chartB, c, a)).status).toBe(200);
    expect((await add(chartB, a, b, 'COREQUISITE')).status).toBe(200);
    expect((await add(chartB, b, a, 'COREQUISITE')).status).toBe(200);
    expect(db.academicRules.filter(rule => rule.curriculumId === chartB)).toHaveLength(3);
  });

  it('does not let an unauthenticated user publish an academic rule', async () => {
    const response = await request(app).post('/api/curriculum/rules').send({
      curriculumId: chartA, targetCourseId: ids[1],
      relationshipType: 'PREREQUISITE', expression: { type: 'COURSE', courseId: ids[0] },
    });
    expect(response.status).toBe(401);
  });
});
