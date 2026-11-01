// ============================================================================
// DARSCHYN (درس‌چین) - Curriculum Management & Rule Engine CRUD
// ============================================================================

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/database';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth';
import { extractSourceCourseIds } from '../../src/utils/academic';
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
    status = 'active',
  } = req.body;

  if (![universityId,campusId,degreeLevelId,majorId,entryYearId,name].every(
    v=>typeof v==='string' && v.trim().length>0 && v.length<=150
  )) return res.status(400).json({success:false,error:'اطلاعات اصلی چارت معتبر نیست.'});
  if (!['draft','active'].includes(status) ||
      (version != null && (typeof version!=='string'||version.length>48)) ||
      (notes != null && (typeof notes!=='string'||notes.length>2000))) {
    return res.status(400).json({success:false,error:'وضعیت، نسخه یا یادداشت چارت معتبر نیست.'});
  }
  if (!db.universities.some(x=>x.id===universityId&&x.active) ||
      !db.campuses.some(x=>x.id===campusId&&x.universityId===universityId&&x.active) ||
      !db.degreeLevels.some(x=>x.id===degreeLevelId&&x.active) ||
      !db.majors.some(x=>x.id===majorId&&x.degreeLevelId===degreeLevelId&&x.active) ||
      !db.entryYears.some(x=>x.id===entryYearId&&x.active)) {
    return res.status(400).json({success:false,error:'دانشگاه، واحد، مقطع، رشته یا ورودی با هم تطابق ندارند.'});
  }
  if(db.curricula.some(x=>x.campusId===campusId&&x.majorId===majorId&&
      x.degreeLevelId===degreeLevelId&&x.entryYearId===entryYearId&&x.version===(version||'1.0'))) {
    return res.status(409).json({success:false,error:'برای این ورودی، نسخهٔ چارت تکراری است.'});
  }

  const newCurriculum: Curriculum = {
    id: 'curr-' + randomUUID(),
    universityId,
    campusId,
    degreeLevelId,
    majorId,
    entryYearId,
    version: version || '1.0',
    name: name.trim(),
    notes: notes?.trim() || undefined,
    status,
    createdAt: new Date().toISOString(),
  };

  db.curricula.push(newCurriculum);
  db.save();
  res.json({ success: true, data: newCurriculum });
});

// A multi-entry-year demand survey can reference the same chart through either
// the original singular relation or its current multi-chart association.
const surveyUsesCurriculum = (chartId: string) =>
  db.demandSurveys.some(s => s.curriculumId === chartId || s.curriculumIds?.includes(chartId));

const curriculumHasStudents = (chart: Curriculum) =>
  db.studentProfiles.some(p =>
    p.universityId === chart.universityId &&
    p.campusId === chart.campusId &&
    p.degreeLevelId === chart.degreeLevelId &&
    p.majorId === chart.majorId &&
    p.entryYearId === chart.entryYearId);

const curriculumHasLinkedData = (chart: Curriculum) =>
  surveyUsesCurriculum(chart.id) ||
  curriculumHasStudents(chart) ||
  db.curriculumCourses.some(cc => cc.curriculumId === chart.id) ||
  db.academicRules.some(rule => rule.curriculumId === chart.id);

// Admin: Update Curriculum
curriculumRouter.put('/:id', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const chart = db.curricula.find(c => c.id === req.params.id);
  if (!chart) return res.status(404).json({ success: false, error: 'چارت درسی یافت نشد.' });

  const { name, version, status, majorId, entryYearId } = req.body || {};
  if ((name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 150)) ||
      (version !== undefined && (typeof version !== 'string' || !version.trim() || version.length > 48)) ||
      (status !== undefined && !['draft', 'active', 'archived'].includes(status)) ||
      (majorId !== undefined && (typeof majorId !== 'string' || !majorId.trim())) ||
      (entryYearId !== undefined && (typeof entryYearId !== 'string' || !entryYearId.trim()))) {
    return res.status(400).json({ success: false, error: 'عنوان، نسخه، وضعیت یا حوزهٔ چارت معتبر نیست.' });
  }
  const nextMajor = majorId ?? chart.majorId;
  const nextYear = entryYearId ?? chart.entryYearId;
  const nextVersion = version?.trim() ?? chart.version;
  const moving = nextMajor !== chart.majorId || nextYear !== chart.entryYearId;
  const withSurvey = surveyUsesCurriculum(chart.id);

  if (!db.majors.some(m => m.id === nextMajor && m.degreeLevelId === chart.degreeLevelId && m.active !== false) ||
      !db.entryYears.some(y => y.id === nextYear && y.active !== false)) {
    return res.status(400).json({ success: false, error: 'رشته/مقطع یا سال ورودی انتخاب‌شده با چارت سازگار نیست.' });
  }
  if (moving && curriculumHasLinkedData(chart)) {
    return res.status(409).json({
      success: false,
      error: 'برای چارت دارای دانشجو، درس، قانون یا نیازسنجی نمی‌توان رشته و ورودی را جابه‌جا کرد. چارت تازه بسازید.',
    });
  }
  if (withSurvey && nextVersion !== chart.version) {
    return res.status(409).json({
      success: false, error: 'نسخهٔ چارت دارای سابقهٔ نیازسنجی ثابت است؛ برای نسخهٔ جدید، چارت تازه بسازید.',
    });
  }
  if (status === 'archived' && db.demandSurveys.some(s =>
    (s.curriculumId === chart.id || s.curriculumIds?.includes(chart.id)) &&
    (s.status === 'OPEN' || s.status === 'DRAFT'))) {
    return res.status(409).json({
      success: false, error: 'پیش از آرشیو چارت باید نیازسنجی‌های باز یا پیش‌نویس آن بسته شوند.',
    });
  }
  if (db.curricula.some(other => other.id !== chart.id &&
    other.campusId === chart.campusId &&
    other.degreeLevelId === chart.degreeLevelId &&
    other.majorId === nextMajor && other.entryYearId === nextYear &&
    other.version === nextVersion)) {
    return res.status(409).json({ success: false, error: 'چارتی با همین ورودی و نسخه از قبل موجود است.' });
  }

  if (name !== undefined) chart.name = name.trim();
  if (version !== undefined) chart.version = nextVersion;
  if (status !== undefined) chart.status = status;
  if (majorId !== undefined) chart.majorId = nextMajor;
  if (entryYearId !== undefined) chart.entryYearId = nextYear;
  db.save();
  return res.json({ success: true, data: chart });
});

// Admin: Delete Curriculum
curriculumRouter.delete('/:id', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const idx = db.curricula.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'چارت درسی یافت نشد.' });
  const chart = db.curricula[idx];

  // Preserve historical surveys (including the multi-chart format) and
  // already assigned student cohorts. Deletion is for empty, unused drafts only.
  if (surveyUsesCurriculum(chart.id) || curriculumHasStudents(chart)) {
    return res.status(409).json({
      success: false,
      error: 'چارت دارای دانشجو یا سابقهٔ نیازسنجی است. آن را حذف نکنید؛ پس از پایان نیازسنجی می‌توان بایگانی کرد.',
    });
  }
  if (chart.status !== 'draft') {
    return res.status(409).json({
      success: false,
      error: 'حذف مستقیم فقط برای چارت پیش‌نویسِ بدون دانشجو مجاز است. ابتدا وضعیت و وابستگی‌ها را بررسی کنید.',
    });
  }

  // Remove only chart-local assignments and rules. No global courses,
  // cross-chart requirements or student information may be deleted.
  db.curricula.splice(idx, 1);
  db.data.curriculumCourses = db.curriculumCourses.filter(cc => cc.curriculumId !== chart.id);
  db.data.academicRules = db.academicRules.filter(rule => rule.curriculumId !== chart.id);
  db.save();
  return res.json({ success: true, message: 'چارت پیش‌نویس و روابط اختصاصی آن حذف شدند.' });
});

// Admin: Assign Course to Curriculum
curriculumRouter.post('/:id/courses', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const curriculumId = req.params.id;
  const { courseId, trackId, suggestedSemester = 1, classification = 'MAJOR_REQUIRED', categoryOverride } = req.body;
  const curriculum = db.curricula.find(c => c.id === curriculumId);
  if (!curriculum || curriculum.status === 'archived') {
    return res.status(404).json({ success: false, error: 'چارت معتبر و فعال یافت نشد.' });
  }
  if (typeof courseId !== 'string' || !db.courses.some(c => c.id === courseId && c.active)) {
    return res.status(400).json({ success: false, error: 'درس فعال و معتبر انتخاب کنید.' });
  }
  if (trackId && (typeof trackId !== 'string' ||
      !db.tracks.some(t => t.id === trackId && t.majorId === curriculum.majorId && t.active))) {
    return res.status(400).json({ success: false, error: 'گرایش انتخابی متعلق به رشتهٔ این چارت نیست.' });
  }
  const semester = Number(suggestedSemester);
  if (!Number.isInteger(semester) || semester < 1 || semester > 16) {
    return res.status(400).json({ success: false, error: 'ترم پیشنهادی باید یک عدد معتبر باشد.' });
  }
  if (!['MAJOR_REQUIRED','MAJOR_ELECTIVE','TRACK_REQUIRED','TRACK_ELECTIVE'].includes(classification)) {
    return res.status(400).json({ success: false, error: 'نوع درس در چارت معتبر نیست.' });
  }

  const existing = db.curriculumCourses.find(
    (cc) => cc.curriculumId === curriculumId && cc.courseId === courseId && (cc.trackId || null) === (trackId || null)
  );
  if (existing) {
    return res.status(400).json({ success: false, error: 'این درس قبلاً به این چارت/گرایش اضافه شده است.' });
  }

  const newEntry: CurriculumCourse = {
    id: 'cc-' + randomUUID(),
    curriculumId,
    courseId,
    trackId: trackId || null,
    suggestedSemester: semester,
    classification,
    categoryOverride,
    active: true,
  };

  db.curriculumCourses.push(newEntry);
  db.save();
  res.json({ success: true, data: newEntry });
});

// Admin: Remove Course from Curriculum
curriculumRouter.delete('/:id/courses/:courseId', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const matches = db.curriculumCourses.filter(
    cc => cc.curriculumId === req.params.id && cc.courseId === req.params.courseId
  );
  if (!matches.length) return res.status(404).json({ success: false, error: 'درس در این چارت یافت نشد.' });
  const selectedTrack = typeof req.query.trackId === 'string' ? req.query.trackId : null;
  if (!selectedTrack && matches.length > 1) {
    return res.status(409).json({
      success: false, error: 'این درس برای بیش از یک گرایش ثبت شده؛ گرایش را با trackId مشخص کنید تا درس اشتباه حذف نشود.',
    });
  }
  const assignment = selectedTrack
    ? matches.find(cc => cc.trackId === selectedTrack)
    : matches[0];
  if (!assignment) return res.status(404).json({ success: false, error: 'این درس برای گرایش انتخاب‌شده ثبت نشده است.' });

  if (db.demandSurveys.some(s => s.curriculumId === req.params.id && s.courseIds.includes(req.params.courseId))) {
    return res.status(409).json({
      success: false,
      error: 'این درس در نیازسنجی ثبت شده است و حذف آن می‌تواند گزارش تاریخی مدیر گروه را تخریب کند.',
    });
  }
  db.data.curriculumCourses = db.curriculumCourses.filter(cc => cc.id !== assignment.id);
  // Keep shared prerequisite rules if the same course remains in another track.
  const stillAssigned = db.curriculumCourses.some(cc =>
    cc.curriculumId === req.params.id && cc.courseId === req.params.courseId
  );
  if (!stillAssigned) {
    db.data.academicRules = db.data.academicRules.filter(
      rule => !(rule.curriculumId === req.params.id &&
        (rule.targetCourseId === req.params.courseId ||
         extractSourceCourseIds(rule.expression).includes(req.params.courseId)))
    );
  }
  db.save();
  res.json({ success: true, message: 'انتساب درس به چارت/گرایش حذف شد.' });
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

// Dependency-cycle checks are scoped to one curriculum. Numerical thresholds
// do not contribute edges, and each traversal starts from the referenced course.
function hasCycle(target: string, expression: AcademicRule['expression'],
  rules: AcademicRule[], curriculumId: string): boolean {
  const reachesTarget = (courseId: string, visited: Set<string>): boolean => {
    if (courseId === target) return true;
    if (visited.has(courseId)) return false;
    visited.add(courseId);
    return rules.filter(rule => rule.curriculumId === curriculumId && rule.targetCourseId === courseId)
      .some(rule => extractSourceCourseIds(rule.expression)
        .some(source => reachesTarget(source, visited)));
  };
  return extractSourceCourseIds(expression).some(source => reachesTarget(source, new Set()));
}

function ruleReferencesValid(rule: AcademicRule): boolean {
  const chart = db.curricula.find(c=>c.id===rule.curriculumId);
  if (!chart || chart.status==='archived' ||
    (rule.majorId && rule.majorId!==chart.majorId) ||
    (rule.entryYearId && rule.entryYearId!==chart.entryYearId) ||
    (rule.trackId && !db.tracks.some(t=>t.id===rule.trackId &&
      t.majorId===chart.majorId && t.active!==false))) return false;
  const targetPresent = db.curriculumCourses.some(row=>row.curriculumId===chart.id &&
    row.courseId===rule.targetCourseId && row.active!==false);
  return targetPresent && extractSourceCourseIds(rule.expression).every(id=>
    id!==rule.targetCourseId && db.courses.some(c=>c.id===id && c.active!==false));
}

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

  if (!ruleReferencesValid(req.body as AcademicRule)) {
    return res.status(400).json({success:false,error:'درس هدف یا شروط با چارت مطابقت ندارند.'});
  }
  // Cycle Detection
  if (hasCycle(targetCourseId, expression, db.data.academicRules, curriculumId)) {
    return res.status(400).json({ success: false, error: 'تعریف این قانون باعث ایجاد حلقه (Circular Dependency) می‌شود و مجاز نیست.' });
  }

  const newRule = {
    id: `rule-${Date.now()}`,
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

// Admin: Update a rule in-place; do not require users to delete and recreate it.
curriculumRouter.put('/rules/:ruleId', authenticate, requirePermission('prerequisite.manage'),
  validate(createAcademicRuleSchema), (req, res) => {
    const index = db.data.academicRules.findIndex(rule => rule.id === req.params.ruleId);
    if (index === -1) return res.status(404).json({ success:false, error:'قانون یافت نشد.' });
    const original = db.data.academicRules[index];
    const next = req.body as AcademicRule;
    if (next.curriculumId !== original.curriculumId ||
      next.targetCourseId !== original.targetCourseId) {
      return res.status(400).json({success:false,error:'چارت و درس هدف در ویرایش قابل جابه‌جایی نیست.'});
    }
    if (!ruleReferencesValid(next)) {
      return res.status(400).json({success:false,error:'درس هدف یا شروط با چارت مطابقت ندارند.'});
    }
    const remaining = db.data.academicRules.filter(rule=>rule.id!==original.id);
    if (hasCycle(next.targetCourseId, next.expression, remaining, next.curriculumId)) {
      return res.status(400).json({success:false,error:'ویرایش موجب حلقهٔ وابستگی دروس می‌شود.'});
    }
    const updated = {...original, ...next, id:original.id};
    db.data.academicRules[index] = updated;
    db.save();
    return res.json({success:true,data:updated});
  });

// Admin: Delete Academic Rule
curriculumRouter.delete('/rules/:ruleId', authenticate, requirePermission('prerequisite.manage'), (req, res) => {
  const idx = db.data.academicRules.findIndex((r) => r.id === req.params.ruleId);
  if (idx === -1) return res.status(404).json({ success: false, error: 'قانون یافت نشد.' });
  db.data.academicRules.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'قانون حذف شد.' });
});