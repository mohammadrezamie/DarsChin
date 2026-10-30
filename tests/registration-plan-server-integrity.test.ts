import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db, type DatabaseSchema } from '../server/db/database';
import { studentRouter } from '../server/routes/student';
import { generateToken } from '../server/middleware/auth';
import { validateRegistrationPlanReferences, countRegistrationPlanUnits } from '../server/domain/registration-plan-integrity';
import { updatePlanSchema } from '../server/schemas/student';
import type { CourseOffering, StudentAcademicProfile, User } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/student', studentRouter);
const userId = 'test-reg-plan-integrity-20261030';
const token = () => ({ Authorization: 'Bearer ' + generateToken({ id: userId }) });
let original: DatabaseSchema;
let profile: StudentAcademicProfile;
let courseId: string;
let termId: string;
let main: CourseOffering;
let reserve: CourseOffering;

beforeAll(async () => {
  await db.init(true);
  original = db.data;
  const chart = original.curricula.find(c => c.status === 'active');
  if (!chart) throw new Error('An active sample curriculum is required');
  const course = original.curriculumCourses.find(row => row.curriculumId === chart.id);
  if (!course) throw new Error('Sample course is required');
  courseId = course.courseId;
  termId = original.academicTerms.find(t => t.isCurrent)?.id || original.academicTerms[0].id;
  profile = {
    userId, universityId: chart.universityId, campusId: chart.campusId,
    degreeLevelId: chart.degreeLevelId, majorId: chart.majorId,
    entryYearId: chart.entryYearId, isTrackSelected: false,
    selectedTrackId: null, desiredTrackIds: [], currentTermId: termId,
    updatedAt: new Date().toISOString(),
  };
  const fixture = (id: string, groupCode: string): CourseOffering => ({
    id, termId, campusId: profile.campusId, courseId, rawCourseCode: '410022',
    groupCode, instructor: 'استاد آزمایشی', dayOfWeek: 'شنبه',
    startTime: '08:00', endTime: '09:30', capacity: 30, enrolledCount: 0,
    source: 'manual', active: true,
  });
  main = fixture('test-integrity-main', '01');
  reserve = fixture('test-integrity-reserve', '02');
  const user: User = {
    id: userId, name: 'Synthetic Planner User', mobile: '09908888088',
    roles: ['student'], permissions: [], createdAt: new Date().toISOString(),
  };
  // Clone collections: never mutate users/students in the seed snapshot.
  db.data = {
    ...original,
    users: [...original.users, user],
    studentProfiles: [...original.studentProfiles, profile],
    studentPlans: [...(original.studentPlans || [])],
    courseOfferings: [...original.courseOfferings, main, reserve],
  };
});

afterAll(() => {
  db.data = original;
  db.save();
});

describe('one unified registration queue has integrity at the write boundary', () => {
  it('allows valid ordered reserve groups of a single course and returns the saved order', async () => {
    const res = await request(app).put('/api/student/plan').set(token()).send({
      selectedOfferingIds: [], coursePriorities: [courseId],
      offeringPriorities: { [courseId]: [main.id, reserve.id] },
    });
    expect(res.status).toBe(200);
    const restored = await request(app).get('/api/student/plan').set(token());
    expect(restored.status).toBe(200);
    expect(restored.body.data.offeringPriorities[courseId]).toEqual([main.id, reserve.id]);
    expect(restored.body.data.coursePriorities).toEqual([courseId]);
  });

  it('rejects cross-course, cross-campus, cross-term, inactive and unknown reserve references without altering saved data', async () => {
    const savedBefore = JSON.stringify(db.studentPlans.find(row => row.userId === userId));
    const bad: CourseOffering[] = [
      { ...reserve, id: 'foreign-course', courseId: 'foreign-course' },
      { ...reserve, id: 'foreign-campus', campusId: 'foreign-campus' },
      { ...reserve, id: 'foreign-term', termId: 'other-term' },
      { ...reserve, id: 'inactive-reserve', active: false },
    ];
    db.courseOfferings.push(...bad);
    for (const id of [...bad.map(row => row.id), 'missing-reserve']) {
      const res = await request(app).put('/api/student/plan').set(token()).send({
        selectedOfferingIds: [], offeringPriorities: { [courseId]: [main.id, id] },
      });
      expect(res.status, id).toBe(400);
      expect(JSON.stringify(db.studentPlans.find(row => row.userId === userId))).toBe(savedBefore);
    }
  });

  it('rejects duplicate group entries and multiple primary groups of one course', async () => {
    expect(updatePlanSchema.safeParse({
      selectedOfferingIds: [main.id, main.id],
    }).success).toBe(false);
    expect(updatePlanSchema.safeParse({
      coursePriorities: [courseId, courseId],
    }).success).toBe(false);
    expect(updatePlanSchema.safeParse({
      offeringPriorities: { [courseId]: [main.id, main.id] },
    }).success).toBe(false);
    const duplicatePrimary = await request(app).put('/api/student/plan').set(token()).send({
      selectedOfferingIds: [main.id, reserve.id],
    });
    expect(duplicatePrimary.status).toBe(400);
    expect(duplicatePrimary.body.error).toContain('فقط یک گروه اصلی');
  });

  it('uses the exact active chart when writing a selected plan, never a convenient unrelated chart', async () => {
    const actual = db.studentProfiles.find(p => p.userId === userId)!;
    const before = actual.universityId;
    actual.universityId = 'university-mismatch';
    try {
      const res = await request(app).put('/api/student/plan').set(token()).send({
        selectedOfferingIds: [main.id],
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('چارت فعال');
    } finally {
      actual.universityId = before;
    }
  });

  it('keeps the displaced main group available in fallback order on the selection endpoint', () => {
    const route = readFileSync(resolve(process.cwd(), 'server/routes/student.ts'), 'utf8');
    expect(route).toContain('...(sameCourseExistingOffering ? [sameCourseExistingOffering.id] : [])');
    expect(route).toContain('plannedOfferingIdsInSameTerm: selectedOfferingIds');
  });

  it('counts only explicit extra-unit metadata, not similar words in a course title', () => {
    const courses = [
      { id: courseId, units: 3, name: 'وصایا / title alone is NOT a rule', isExtraUnit: false },
      { id: 'explicit-extra', units: 2, name: 'درس آزمایشی', isExtraUnit: true },
    ] as any;
    const extra: CourseOffering = { ...main, id: 'extra-group', courseId: 'explicit-extra' };
    expect(countRegistrationPlanUnits([main.id, extra.id], [main, extra], courses)).toBe(3);
    expect(countRegistrationPlanUnits([main.id, reserve.id], [main, reserve], courses)).toBe(3);
    expect(countRegistrationPlanUnits([main.id], [main], [{ ...courses[0], isExtraUnit: true }])).toBe(0);
    const endpoint = readFileSync(resolve(process.cwd(), 'server/routes/student.ts'), 'utf8');
    expect(endpoint).toContain('const countedUnits = countRegistrationPlanUnits(selectedOfferingIds');
    expect(endpoint).toContain('const candidateUnits = countRegistrationPlanUnits(candidateIds');
    expect(endpoint).not.toContain("c?.name.includes('وصایا')");
    expect(endpoint).not.toContain("targetCourse?.name.includes('انس')");
    expect(endpoint).not.toContain('ترم تابستان (۸ واحد)');
  });

  it('does not trust a foreign-course reserve even when all groups are in the same term', () => {
    const err = validateRegistrationPlanReferences({
      currentTermId: termId, campusId: profile.campusId,
      selectedOfferingIds: [main.id],
      offeringPriorities: { 'wrong-course-id': [reserve.id] },
      offerings: [main, reserve],
    });
    expect(err).toContain('همان درس');
  });
});


describe('account-and-term-isolated manual group registration marks',()=>{
  it('persists only currently selected group and never creates official status', async()=>{
    let plan=db.studentPlans.find(row=>row.userId===userId && row.termId===termId);
    if(!plan) {
      plan={id:'test-progress-plan',userId,termId,selectedOfferingIds:[],
        coursePriorities:[],offeringPriorities:{},updatedAt:new Date().toISOString()};
      db.studentPlans.push(plan);
    }
    plan.selectedOfferingIds=[main.id];
    const mark=await request(app).put('/api/student/registration-progress').set(token())
      .send({offeringId:main.id,registered:true});
    expect(mark.status).toBe(200);
    expect(mark.body.data.registeredOfferingIds).toEqual([main.id]);
    const fresh=await request(app).get('/api/student/plan').set(token());
    expect(fresh.body.data.registeredOfferingIds).toEqual([main.id]);

    const wrong=await request(app).put('/api/student/registration-progress').set(token())
      .send({offeringId:reserve.id,registered:true});
    expect(wrong.status).toBe(409);
    expect(db.studentPlans.find(row=>row.userId===userId)?.registeredOfferingIds).toEqual([main.id]);

    const invalid=await request(app).put('/api/student/registration-progress').set(token())
      .send({offeringId:main.id,registered:'yes'});
    expect(invalid.status).toBe(400);
    const cleared=await request(app).put('/api/student/plan').set(token()).send({
      selectedOfferingIds:[],coursePriorities:[],offeringPriorities:{},
    });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.registeredOfferingIds).toEqual([]);
  });

  it('will not change marks from a different term or an account without that group',async()=>{
    const plan=db.studentPlans.find(row=>row.userId===userId && row.termId===termId)!;
    plan.selectedOfferingIds=[main.id];
    const otherTerm=profile.currentTermId!;
    profile.currentTermId='synthetic-unrelated-term';
    try{
      const response=await request(app).put('/api/student/registration-progress').set(token())
        .send({offeringId:main.id,registered:true});
      expect(response.status).toBe(409);
    }finally{profile.currentTermId=otherTerm;}
    expect(plan.registeredOfferingIds).toEqual([]);
  });
});


describe('private registration responses never permit shared HTTP caching',()=>{
  it('marks the plan GET and plan PUT as private, no-store',async()=>{
    const get=await request(app).get('/api/student/plan').set(token());
    expect(get.status).toBe(200);
    expect(get.headers['cache-control']).toBe('private, no-store');
    const put=await request(app).put('/api/student/plan').set(token()).send({selectedOfferingIds:[]});
    expect(put.status).toBe(200);
    expect(put.headers['cache-control']).toBe('private, no-store');
  });
});
