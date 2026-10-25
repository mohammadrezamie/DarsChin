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

// Admin: Update Curriculum
curriculumRouter.put('/:id', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const idx = db.curricula.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'چارت درسی یافت نشد.' });

  const { name, version, status, majorId, entryYearId } = req.body;
  // Existing surveys are historical records tied to a specific chart and cohort.
  // Never silently reassign that chart to another cohort or major.
  if (db.demandSurveys.some(s => s.curriculumId === req.params.id) &&
      ((majorId && majorId !== db.curricula[idx].majorId) ||
       (entryYearId && entryYearId !== db.curricula[idx].entryYearId) ||
       (status === 'archived' && db.demandSurveys.some(s =>
         s.curriculumId === req.params.id && (s.status === 'OPEN' || s.status === 'DRAFT'))))) {
    return res.status(409).json({ success: false, error: 'این چارت در نیازسنجی استفاده شده؛ تغییر حوزه یا آرشیو پیش از بستن نیازسنجی‌ها مجاز نیست.' });
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

  if (db.demandSurveys.some(s => s.curriculumId === req.params.id)) {
    return res.status(409).json({
      success: false,
      error: 'چارت دارای نیازسنجی و سابقهٔ تقاضاست. به‌جای حذف، بعد از بستن نیازسنجی آن را آرشیو کنید.',
    });
  }
  // Only unused charts can be removed; never cascade through survey history.
  db.curricula.splice(idx, 1);
  
  // Cascade delete curriculum courses and rules
  db.data.curriculumCourses = db.curriculumCourses.filter(c => c.curriculumId !== req.params.id);
  db.data.academicRules = db.data.academicRules = db.data.academicRules.filter(c => c.curriculumId !== req.params.id);
  db.data.academicRules = db.data.academicRules = db.data.academicRules.filter(c => c.curriculumId !== req.params.id);
  
  db.save();
  res.json({ success: true, message: 'چارت با موفقیت حذف شد.' });
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

// Helper for cycle detection
function hasCycle(targetCourseId, expression, allRules, visited = new Set()) {
  if (visited.has(targetCourseId)) return true;
  visited.add(targetCourseId);
  
  const sourceCourseIds = extractSourceCourseIds(expression);
  for (const sourceId of sourceCourseIds) {
    if (sourceId === targetCourseId) return true; // Direct self-reference
    
    // Check downstream
    const sourceRules = allRules.filter(r => r.targetCourseId === sourceId);
    for (const sr of sourceRules) {
      if (hasCycle(targetCourseId, sr.expression, allRules, new Set(visited))) {
        return true;
      }
    }
  }
  return false;
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

  // Cycle Detection
  if (hasCycle(targetCourseId, expression, db.data.academicRules)) {
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

// Admin: Delete Academic Rule
curriculumRouter.delete('/rules/:ruleId', authenticate, requirePermission('prerequisite.manage'), (req, res) => {
  const idx = db.data.academicRules.findIndex((r) => r.id === req.params.ruleId);
  if (idx === -1) return res.status(404).json({ success: false, error: 'قانون یافت نشد.' });
  db.data.academicRules.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'قانون حذف شد.' });
});