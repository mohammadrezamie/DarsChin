import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../db/database';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth';
import { exportDemandCsv, listDemandStudents, managerCanAccessDemand, summarizeDemand, summarizeDemandByCohort, surveyAppliesToProfile } from '../../src/domain/course-demand';
import type { DemandResponse, DemandSurvey } from '../../src/types';

export const demandRouter = Router();
demandRouter.use(authenticate);
demandRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });

const identifier = z.string().trim().min(1).max(120);
const surveySchema = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().max(1000).default(''),
  targetTermId: identifier,
  universityId: identifier,
  campusId: identifier,
  degreeLevelId: identifier,
  majorId: identifier,
  curriculumId: identifier,
  curriculumIds: z.array(identifier).min(1).max(30).optional(),
  entryYearIds: z.array(identifier).min(1).max(30),
  // Legacy track-scoped surveys remain readable; new forms collect track as optional profile metadata.
  trackIds: z.array(identifier).max(30).default([]),
  courseIds: z.array(identifier).min(1).max(100),
  recommendedMinimumByCourse: z.record(z.string(), z.number().int().min(0).max(500)).default({}),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
}).strict();
const responseSchema = z.object({
  courseIds: z.array(identifier).max(100),
  studentNumber: z.string().trim().regex(/^[0-9۰-۹٠-٩]{6,20}$/),
  anticipatedGraduation: z.enum(['YES', 'NO', 'UNKNOWN']),
}).strict();
const statusSchema = z.object({ status: z.enum(['OPEN','CLOSED','ARCHIVED']) }).strict();
const fresh = () => new Date().toISOString();
const failure = (res: any, code: number, error: string) => res.status(code).json({ success: false, error });
function scopeStudent(req: AuthenticatedRequest, survey: DemandSurvey) {
  const profile = db.studentProfiles.find(x => x.userId === req.user!.id);
  return profile && surveyAppliesToProfile(survey, profile) &&
    db.curricula.some(c => (survey.curriculumIds?.length
      ? survey.curriculumIds.includes(c.id) : c.id === survey.curriculumId) &&
      c.entryYearId === profile.entryYearId);
}
const getSurvey = (id: string) => db.demandSurveys.find(s => s.id === id);
function isOpen(survey: DemandSurvey) {
  const now = Date.now();
  return survey.status === 'OPEN' &&
    (!survey.startsAt || Date.parse(survey.startsAt) <= now) &&
    (!survey.endsAt || Date.parse(survey.endsAt) >= now);
}
function audit(adminId: string, action: string, entityId: string) {
  db.auditLogs.push({
    id: 'audit-demand-' + randomUUID(), adminId, action,
    entityType: 'DEMAND_SURVEY', entityId, createdAt: fresh(),
  });
}

demandRouter.get('/surveys', (req: AuthenticatedRequest, res) => {
  const list = db.demandSurveys.filter(s => managerCanAccessDemand(req.user!, s) ||
    (!!scopeStudent(req, s) && (
      isOpen(s) ||
      // Keep a student's own previously submitted demand visible as history
      // after the manager closes/archives the survey; editing stays disabled.
      db.demandResponses.some(r => r.surveyId === s.id && r.userId === req.user!.id)
    )));
  return res.json({ success: true, data: list });
});

demandRouter.post('/surveys', (req: AuthenticatedRequest, res) => {
  const input = surveySchema.safeParse(req.body);
  if (!input.success) return failure(res, 400, 'داده‌های فرم نیازسنجی معتبر نیستند.');
  const x = input.data;
  if (!managerCanAccessDemand(req.user!, x)) return failure(res, 403, 'مدیریت نیازسنجی این رشته در دسترسی شما نیست.');
  const validScope = db.universities.some(u => u.id === x.universityId && u.active) &&
    db.campuses.some(c => c.id === x.campusId && c.universityId === x.universityId && c.active) &&
    db.degreeLevels.some(d => d.id === x.degreeLevelId && d.active) &&
    db.majors.some(m => m.id === x.majorId && m.degreeLevelId === x.degreeLevelId && m.active) &&
    db.academicTerms.some(t => t.id === x.targetTermId);
  const chosenChartIds = x.curriculumIds || [x.curriculumId];
  const charts = chosenChartIds.map(id=>db.curricula.find(c=>c.id===id &&
    c.universityId===x.universityId && c.campusId===x.campusId &&
    c.degreeLevelId===x.degreeLevelId && c.majorId===x.majorId &&
    c.status!=='archived'));
  if (!validScope || !charts.length || charts.some(c=>!c) ||
    new Set(chosenChartIds).size!==chosenChartIds.length ||
    new Set(x.entryYearIds).size!==x.entryYearIds.length ||
    charts.length!==x.entryYearIds.length ||
    charts.some(c=>!x.entryYearIds.includes(c!.entryYearId)) ||
    charts.some(c=>!db.entryYears.some(year=>year.id===c!.entryYearId && year.active)) ||
    x.trackIds.some(id=>!db.tracks.some(t=>t.id===id && t.majorId===x.majorId && t.active))) {
    return failure(res,400,'ورودی‌ها و چارت‌های هر ورودی باید یکتا و متعلق به یک رشته و مقطع باشند.');
  }
  // Courses can come from any of the selected entry-year charts. The response
  // endpoint separately checks that each student requests only own-chart courses.
  const availableIds = new Set(db.curriculumCourses.filter(cc =>
    chosenChartIds.includes(cc.curriculumId) && cc.active!==false).map(cc=>cc.courseId));
  if (new Set(x.courseIds).size!==x.courseIds.length ||
    x.courseIds.some(id=>!availableIds.has(id) || !db.courses.some(c=>c.id===id && c.active)) ||
    Object.keys(x.recommendedMinimumByCourse).some(id=>!x.courseIds.includes(id))) {
    return failure(res,400,'دروس نیازسنجی باید یکتا و متعلق به چارت یکی از ورودی‌های منتخب باشند.');
  }
  if (x.startsAt && x.endsAt && x.startsAt >= x.endsAt) return failure(res, 400, 'زمان پایان باید پس از آغاز باشد.');
  const survey: DemandSurvey = { ...x, id: 'demand-' + randomUUID(), status: 'DRAFT',
    createdBy: req.user!.id, createdAt: fresh(), updatedAt: fresh() };
  db.demandSurveys.push(survey);
  audit(req.user!.id, 'DEMAND_SURVEY_CREATED', survey.id);
  db.save();
  return res.status(201).json({ success: true, data: survey });
});

demandRouter.put('/surveys/:id/status', (req: AuthenticatedRequest, res) => {
  const survey = getSurvey(req.params.id);
  if (!survey) return failure(res, 404, 'نیازسنجی یافت نشد.');
  if (!managerCanAccessDemand(req.user!, survey)) return failure(res, 403, 'دسترسی مدیر گروه برای این حوزه ندارید.');
  const input = statusSchema.safeParse(req.body);
  if (!input.success) return failure(res, 400, 'وضعیت جدید معتبر نیست.');
  const changes: Record<string,string[]> = {
    DRAFT: ['OPEN','ARCHIVED'], OPEN: ['CLOSED'], CLOSED: ['OPEN','ARCHIVED'], ARCHIVED: [],
  };
  if (!changes[survey.status].includes(input.data.status)) return failure(res, 409, 'انتقال وضعیت مجاز نیست.');
  survey.status = input.data.status;
  survey.updatedAt = fresh();
  audit(req.user!.id, 'DEMAND_SURVEY_' + survey.status, survey.id);
  db.save();
  return res.json({ success: true, data: survey });
});

demandRouter.get('/surveys/:id/response', (req: AuthenticatedRequest, res) => {
  const survey = getSurvey(req.params.id);
  if (!survey || (!managerCanAccessDemand(req.user!, survey) && !scopeStudent(req, survey))) {
    return failure(res, 404, 'نیازسنجی قابل دسترسی نیست.');
  }
  return res.json({ success: true, data: db.demandResponses.find(r =>
    r.surveyId === survey.id && r.userId === req.user!.id) || null });
});

demandRouter.put('/surveys/:id/response', (req: AuthenticatedRequest, res) => {
  const survey = getSurvey(req.params.id);
  if (!survey || !scopeStudent(req, survey)) return failure(res, 404, 'نیازسنجی متناسب با پروندهٔ شما یافت نشد.');
  if (!isOpen(survey)) return failure(res, 409, 'زمان پاسخ‌دهی این نیازسنجی پایان یافته است.');
  const parsed = responseSchema.safeParse(req.body);
  if (!parsed.success) return failure(res, 400, 'شماره دانشجویی، وضعیت ترم آخر یا لیست دروس معتبر نیست.');
  const x = parsed.data;
  const profile = db.studentProfiles.find(p => p.userId === req.user!.id)!;
  const chartsForStudent = db.curricula.filter(c=>c.entryYearId===profile.entryYearId &&
    (survey.curriculumIds?.length ? survey.curriculumIds.includes(c.id) : c.id===survey.curriculumId));
  const availableForStudent = new Set(db.curriculumCourses.filter(cc=>
    chartsForStudent.some(c=>c.id===cc.curriculumId) && cc.active!==false).map(cc=>cc.courseId));
  if (new Set(x.courseIds).size!==x.courseIds.length ||
    x.courseIds.some(id=>!survey.courseIds.includes(id) || !availableForStudent.has(id))) {
    return failure(res,400,'فقط دروس موجود در چارت ورودی خودتان قابل درخواست‌اند.');
  }
  const studentNumber = x.studentNumber.replace(/[۰-۹]/g, d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const previous = db.demandResponses.find(r => r.surveyId === survey.id && r.userId === req.user!.id);
  const response: DemandResponse = {
    id: previous?.id || 'demand-response-' + randomUUID(),
    surveyId: survey.id, userId: req.user!.id,
    studentNumber, anticipatedGraduation: x.anticipatedGraduation, courseIds: x.courseIds,
    snapshot: {
      studentName: req.user!.name, campusId: profile.campusId, majorId: profile.majorId,
      entryYearId: profile.entryYearId, isTrackSelected: profile.isTrackSelected,
      selectedTrackId: profile.selectedTrackId,
    },
    submittedAt: previous?.submittedAt || fresh(), updatedAt: fresh(),
  };
  const index = db.demandResponses.findIndex(r => r.surveyId === survey.id && r.userId === req.user!.id);
  if (index === -1) db.demandResponses.push(response); else db.demandResponses[index] = response;
  // Reuse the identifier on the next survey; students do not refill identical fields.
  profile.studentNumber = studentNumber;
  db.save();
  return res.json({ success: true, data: response, message: 'تقاضای شما ثبت شد؛ این ثبت‌نام درسی نیست.' });
});

demandRouter.get('/surveys/:id/report', (req: AuthenticatedRequest, res) => {
  const survey = getSurvey(req.params.id);
  if (!survey) return failure(res, 404, 'نیازسنجی یافت نشد.');
  if (!managerCanAccessDemand(req.user!, survey)) return failure(res, 403, 'گزارش این رشته در دسترسی شما نیست.');
  return res.json({ success: true, data: {
    ...summarizeDemand(survey, db.demandResponses),
    byCohort: summarizeDemandByCohort(survey, db.demandResponses),
  } });
});

// Identifiable data is available ONLY with separate export permission and scope.
// No student names, phone numbers or student IDs in the ordinary aggregate report.
demandRouter.get('/surveys/:id/students', (req: AuthenticatedRequest, res) => {
  const survey = getSurvey(req.params.id);
  if (!survey) return failure(res, 404, 'نیازسنجی یافت نشد.');
  if (!managerCanAccessDemand(req.user!, survey, true)) {
    return failure(res, 403, 'مجوز جداگانه برای مشاهدهٔ پاسخ‌های فردی دانشجویان لازم است.');
  }
  const rows = listDemandStudents(survey, db.demandResponses);
  audit(req.user!.id, 'DEMAND_PERSONAL_REPORT_VIEWED', survey.id);
  db.save();
  return res.json({success:true,data:{surveyId:survey.id,students:rows}});
});

demandRouter.get('/surveys/:id/export.csv', (req: AuthenticatedRequest, res) => {
  const survey = getSurvey(req.params.id);
  if (!survey) return failure(res, 404, 'نیازسنجی یافت نشد.');
  if (!managerCanAccessDemand(req.user!, survey, true)) return failure(res, 403, 'دسترسی به اطلاعات شناسایی‌کنندهٔ دانشجویان ندارید.');
  const contents = exportDemandCsv(
    survey, db.demandResponses,
    new Map(db.courses.map(c=>[c.id, c.name])),
    new Map(db.entryYears.map(y=>[y.id, String(y.year)])),
    new Map(db.tracks.map(t=>[t.id, t.name])),
    new Map(db.majors.map(m=>[m.id, m.name])),
  );
  audit(req.user!.id, 'DEMAND_PERSONAL_REPORT_EXPORTED', survey.id);
  db.save();
  if (req.query.format === 'json') return res.json({ success: true, data: { csv: contents } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="darschin-demand-' + survey.id + '.csv"');
  return res.send(contents);
});
