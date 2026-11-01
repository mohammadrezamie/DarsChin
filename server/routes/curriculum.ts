// ============================================================================
// DARSCHYN (درس‌چین) - Curriculum Management & Rule Engine CRUD
// ============================================================================

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/database';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth';
import { extractSourceCourseIds } from '../../src/utils/academic';
import { createsPrerequisiteCycle } from '../../src/domain/prerequisite-graph';
import { validate } from '../middleware/validate';
import { createAcademicRuleSchema } from '../schemas/academic-rule';
import {
  Curriculum,
  CurriculumCourse,
  AcademicRule,
} from '../../src/types';

export const curriculumRouter = Router();

// Get full curriculum details with courses & rules
curriculumRouter.get('/', (req, res) => {
  const { majorId, entryYearId } = req.query;
  let list = db.curricula;
  if (majorId) list = list.filter((c) => c.majorId === majorId);
  if (entryYearId) list = list.filter((c) => c.entryYearId === entryYearId);
  res.json({ success: true, data: list });
});

curriculumRouter.get('/:id/full', (req, res) => {
  const curriculum = db.curricula.find((c) => c.id === req.params.id);
  if (!curriculum) return res.status(404).json({ success: false, error: 'چارت درسی یافت نشد.' });

  const assignedCourses = db.curriculumCourses.filter((cc) => cc.curriculumId === curriculum.id);
  const prereqs = db.academicRules.filter((pr) => pr.curriculumId === curriculum.id && pr.relationshipType === 'PREREQUISITE');
  const coreqs = db.academicRules.filter((cr) => cr.curriculumId === curriculum.id && cr.relationshipType === 'COREQUISITE');

  // Populate course details
  const enrichedCourses = assignedCourses.map((ac) => {
    const courseDetails = db.courses.find((c) => c.id === ac.courseId);
    return {
      ...ac,
      course: courseDetails,
    };
  });

  res.json({
    success: true,
    data: {
      curriculum,
      courses: enrichedCourses,
      prerequisites: prereqs,
      corequisites: coreqs,
    },
  });
});

// Admin: Create Curriculum
curriculumRouter.post('/', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const {
    universityId,
    campusId,
    degreeLevelId,
    majorId,
    entryYearId,
    version,
    name,
    notes,
    status = 'draft',
  } = req.body ?? {};

  if (![universityId, campusId, degreeLevelId, majorId, entryYearId, name]
      .every(value => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ success: false, error: 'لطفاً تمام اطلاعات اصلی چارت را وارد کنید.' });
  }
  if (status !== 'draft') {
    return res.status(400).json({ success: false, error: 'چارت جدید فقط به صورت پیش‌نویس قابل ثبت است؛ انتشار نیازمند گردش تأیید رسمی است.' });
  }
  const validUniversity = db.universities.some(u => u.id === universityId);
  const validCampus = db.campuses.some(c => c.id === campusId && c.universityId === universityId);
  const validDegree = db.degreeLevels.some(d => d.id === degreeLevelId);
  const validMajor = db.majors.some(m => m.id === majorId && m.degreeLevelId === degreeLevelId);
  const validEntryYear = db.entryYears.some(y => y.id === entryYearId);
  if (!validUniversity || !validCampus || !validDegree || !validMajor || !validEntryYear) {
    return res.status(400).json({ success: false, error: 'ترکیب دانشگاه، واحد، رشته، مقطع یا سال ورود معتبر نیست.' });
  }
  const targetVersion = typeof version === 'string' && version.trim() ? version.trim() : 'draft-1';
  if (db.curricula.some(c => c.campusId === campusId && c.degreeLevelId === degreeLevelId &&
      c.majorId === majorId && c.entryYearId === entryYearId && c.version === targetVersion)) {
    return res.status(409).json({ success: false, error: 'این نسخه چارت برای همین واحد، رشته، مقطع و ورودی قبلاً ثبت شده است.' });
  }

  const newCurriculum: Curriculum = {
    id: `curr-${randomUUID()}`,
    universityId,
    campusId,
    degreeLevelId,
    majorId,
    entryYearId,
    version: targetVersion,
    name: name.trim(),
    notes: notes?.trim() || undefined,
    status,
    createdAt: new Date().toISOString(),
  };

  db.curricula.push(newCurriculum);
  db.save();
  res.json({ success: true, data: newCurriculum });
});

// Admin: Update Curriculum
curriculumRouter.put('/:id', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const idx = db.curricula.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'چارت درسی یافت نشد.' });

  if (db.curricula[idx].status !== 'draft') {
    return res.status(409).json({ success: false, error: 'چارت فعال یا بایگانی‌شده را نمی‌توان مستقیم تغییر داد؛ برای اصلاح باید نسخه پیش‌نویس جدید ساخته شود.' });
  }
  const { name, version, status, majorId, entryYearId } = req.body || {};
  if ((status && !['draft', 'archived'].includes(status)) ||
      (name !== undefined && (typeof name !== 'string' || !name.trim())) ||
      (version !== undefined && (typeof version !== 'string' || !version.trim())) ||
      (majorId && !db.majors.some(m => m.id === majorId && m.degreeLevelId === db.curricula[idx].degreeLevelId)) ||
      (entryYearId && !db.entryYears.some(y => y.id === entryYearId))) {
    return res.status(400).json({ success: false, error: 'درخواست ویرایش چارت نامعتبر است؛ انتشار بدون تأیید رسمی غیرفعال است.' });
  }
  const nextVersion = version?.trim() ?? db.curricula[idx].version;
  const nextMajorId = majorId || db.curricula[idx].majorId;
  const nextEntryId = entryYearId || db.curricula[idx].entryYearId;
  if (db.curricula.some(c => c.id !== req.params.id &&
      c.campusId === db.curricula[idx].campusId &&
      c.degreeLevelId === db.curricula[idx].degreeLevelId &&
      c.majorId === nextMajorId && c.entryYearId === nextEntryId && c.version === nextVersion)) {
    return res.status(409).json({ success: false, error: 'این نسخه برای همین واحد، مقطع، رشته و ورودی قبلاً ثبت شده است.' });
  }
  if (name) db.curricula[idx].name = name.trim();
  if (version) db.curricula[idx].version = version.trim();
  if (status) db.curricula[idx].status = status;
  if (majorId) db.curricula[idx].majorId = majorId;
  if (entryYearId) db.curricula[idx].entryYearId = entryYearId;

  db.save();
  res.json({ success: true, data: db.curricula[idx] });
});

// Admin: Delete Curriculum
curriculumRouter.delete('/:id', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const idx = db.curricula.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'چارت درسی یافت نشد.' });

  if (db.curricula[idx].status !== 'draft') {
    return res.status(409).json({ success: false, error: 'حذف مستقیم چارت فعال یا بایگانی‌شده مجاز نیست؛ سابقه مصوبات باید حفظ شود.' });
  }
  db.curricula.splice(idx, 1);
  db.data.curriculumCourses = db.curriculumCourses.filter(c => c.curriculumId !== req.params.id);
  db.data.academicRules = db.data.academicRules.filter(c => c.curriculumId !== req.params.id);
  
  db.save();
  res.json({ success: true, message: 'چارت با موفقیت حذف شد.' });
});

// Admin: Assign Course to Curriculum
curriculumRouter.post('/:id/courses', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const curriculumId = req.params.id;
  const chart = db.curricula.find(c => c.id === curriculumId);
  if (!chart) return res.status(404).json({ success: false, error: 'چارت درسی یافت نشد.' });
  if (chart.status !== 'draft') return res.status(409).json({ success: false, error: 'فقط چارت پیش‌نویس قابل ویرایش است.' });

  const { courseId, trackId, suggestedSemester = 1, classification = 'MAJOR_REQUIRED', categoryOverride } = req.body || {};
  if (!db.courses.some(course => course.id === courseId) ||
      !['MAJOR_REQUIRED', 'MAJOR_ELECTIVE', 'TRACK_REQUIRED', 'TRACK_ELECTIVE'].includes(classification) ||
      (trackId && !db.tracks.some(track => track.id === trackId && track.majorId === chart.majorId))) {
    return res.status(400).json({ success: false, error: 'شناسه درس، دسته‌بندی یا گرایش معتبر نیست.' });
  }
  const semester = Number(suggestedSemester);
  if (!Number.isInteger(semester) || semester < 1 || semester > 12) {
    return res.status(400).json({ success: false, error: 'نیمسال پیشنهادی باید عدد صحیح بین ۱ تا ۱۲ باشد.' });
  }

  const existing = db.curriculumCourses.find(
    (cc) => cc.curriculumId === curriculumId && cc.courseId === courseId && cc.trackId === (trackId || null)
  );
  if (existing) {
    return res.status(400).json({ success: false, error: 'این درس قبلاً به این چارت/گرایش اضافه شده است.' });
  }

  const newEntry: CurriculumCourse = {
    id: `cc-${randomUUID()}`,
    curriculumId,
    courseId,
    suggestedSemester: semester,
    classification,
    trackId: trackId || null,
    categoryOverride,
    active: true,
  };

  db.curriculumCourses.push(newEntry);
  db.save();
  res.json({ success: true, data: newEntry });
});

// Admin: Remove Course from Curriculum
curriculumRouter.delete('/:id/courses/:courseId', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const chart = db.curricula.find(c => c.id === req.params.id);
  if (!chart) return res.status(404).json({ success: false, error: 'چارت درسی یافت نشد.' });
  if (chart.status !== 'draft') return res.status(409).json({ success: false, error: 'فقط چارت پیش‌نویس قابل ویرایش است.' });
  const idx = db.curriculumCourses.findIndex(
    (cc) => cc.curriculumId === req.params.id && cc.courseId === req.params.courseId
  );
  if (idx === -1) return res.status(404).json({ success: false, error: 'درس در این چارت یافت نشد.' });

  db.curriculumCourses.splice(idx, 1);
  // Also clean up rules pointing to or from this course in this curriculum
  db.data.academicRules = db.data.academicRules.filter(
    (r) => !(r.curriculumId === req.params.id && (r.targetCourseId === req.params.courseId || extractSourceCourseIds(r.expression).includes(req.params.courseId)))
  );
  db.save();
  res.json({ success: true, message: 'درس و قوانین مرتبط از چارت حذف شدند.' });
});


// Admin: List all Academic Rules
curriculumRouter.get('/rules', authenticate, requirePermission('prerequisite.manage'), (req, res) => {
  const enriched = db.data.academicRules.map(r => {
    const targetCourse = db.data.courses.find(c => c.id === r.targetCourseId);
    const curr = db.data.curricula.find(c => c.id === r.curriculumId);
    const major = db.data.majors.find(m => m.id === r.majorId);
    const track = db.data.tracks.find(t => t.id === r.trackId);
    const entryYear = db.data.entryYears.find(ey => ey.id === r.entryYearId);
    return {
      ...r,
      targetCourseName: targetCourse?.name || r.targetCourseId,
      curriculumName: curr?.name || r.curriculumId,
      majorName: major?.name || r.majorId,
      trackName: track?.name || r.trackId,
      entryYearName: entryYear?.year || r.entryYearId,
    };
  });
  res.json({ success: true, data: enriched });
});

// Admin: Add Academic Rule
curriculumRouter.post('/rules', authenticate, requirePermission('prerequisite.manage'), validate(createAcademicRuleSchema), (req, res) => {
  const {
    curriculumId,
    entryYearId,
    majorId,
    trackId,
    targetCourseId,
    relationshipType,
    expression,
    notes,
  } = req.body;

  const chart = db.curricula.find(curriculum => curriculum.id === curriculumId);
  if (!chart) return res.status(404).json({ success: false, error: 'چارت درسی یافت نشد.' });
  if (chart.status !== 'draft') {
    return res.status(409).json({ success: false, error: 'قوانین فقط در چارت پیش‌نویس قابل ویرایش‌اند.' });
  }
  const sourceIds = extractSourceCourseIds(expression);
  const assigned = new Set(db.curriculumCourses.filter(row => row.curriculumId === curriculumId).map(row => row.courseId));
  if (!assigned.has(targetCourseId) || sourceIds.some(id => !assigned.has(id))) {
    return res.status(400).json({ success: false, error: 'پیش از تعریف رابطه، درس مقصد و همه دروس مبدا را به همین چارت اضافه کنید.' });
  }
  if (!db.curricula.some(curriculum => curriculum.id === curriculumId) ||
      !db.courses.some(course => course.id === targetCourseId) ||
      sourceIds.length === 0 || sourceIds.some(id => !db.courses.some(course => course.id === id))) {
    return res.status(400).json({ success: false, error: 'چارت، درس مقصد یا درس مبدا معتبر نیست.' });
  }
  // An AND/OR logical group remains an AST. Only the PREREQUISITE edges
  // must form a DAG; true structural COREQUISITEs can be reciprocal.
  if (relationshipType === 'PREREQUISITE' &&
      createsPrerequisiteCycle(curriculumId, targetCourseId, expression, db.data.academicRules)) {
    return res.status(400).json({ success: false, error: 'این پیش‌نیاز چرخه وابستگی ایجاد می‌کند.' });
  }

  if (db.data.academicRules.some(rule => rule.curriculumId === curriculumId &&
      rule.targetCourseId === targetCourseId && rule.relationshipType === relationshipType &&
      JSON.stringify(rule.expression) === JSON.stringify(expression) &&
      (rule.trackId || null) === (trackId || null))) {
    return res.status(409).json({ success: false, error: 'این رابطه قبلاً در همین نسخه چارت تعریف شده است.' });
  }
  const newRule = {
    id: `rule-${randomUUID()}`,
    curriculumId,
    entryYearId: entryYearId || null,
    majorId: majorId || null,
    trackId: trackId || null,
    targetCourseId,
    relationshipType,
    expression,
    notes: notes?.trim() || undefined,
  };

  db.data.academicRules.push(newRule as any);
  db.save();
  res.json({ success: true, data: newRule });
});

// Admin: Delete Academic Rule
curriculumRouter.delete('/rules/:ruleId', authenticate, requirePermission('prerequisite.manage'), (req, res) => {
  const idx = db.data.academicRules.findIndex((r) => r.id === req.params.ruleId);
  if (idx === -1) return res.status(404).json({ success: false, error: 'قانون یافت نشد.' });
  const chart = db.curricula.find(c => c.id === db.data.academicRules[idx].curriculumId);
  if (!chart || chart.status !== 'draft') {
    return res.status(409).json({ success: false, error: 'ویرایش قانون چارت فعال یا فاقد پیش‌نویس مجاز نیست.' });
  }
  db.data.academicRules.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'قانون حذف شد.' });
});