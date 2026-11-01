// ============================================================================
// DARSCHYN (درس‌چین) - Curriculum Management & Rule Engine CRUD
// ============================================================================

import { Router } from 'express';
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

  if (!universityId || !campusId || !degreeLevelId || !majorId || !entryYearId || !name) {
    return res.status(400).json({ success: false, error: 'لطفاً تمام اطلاعات اصلی چارت را وارد کنید.' });
  }

  const newCurriculum: Curriculum = {
    id: `curr-${Date.now()}`,
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

  // Soft delete or hard delete? Let's hard delete for MVP.
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

  if (!courseId) return res.status(400).json({ success: false, error: 'شناسه درس الزامی است.' });

  const existing = db.curriculumCourses.find(
    (cc) => cc.curriculumId === curriculumId && cc.courseId === courseId && cc.trackId === (trackId || null)
  );
  if (existing) {
    return res.status(400).json({ success: false, error: 'این درس قبلاً به این چارت/گرایش اضافه شده است.' });
  }

  const newEntry: CurriculumCourse = {
    id: `cc-${Date.now()}`,
    curriculumId,
    courseId,
    suggestedSemester: Number(suggestedSemester),
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
  const idx = db.curriculumCourses.findIndex(
    (cc) => cc.curriculumId === req.params.id && cc.courseId === req.params.courseId
  );
  if (idx === -1) return res.status(404).json({ success: false, error: 'درس در این چارت یافت نشد.' });

  db.curriculumCourses.splice(idx, 1);
  // Also clean up rules pointing to or from this course in this curriculum
  db.data.academicRules = db.data.academicRules.filter(
    (r) => !(r.curriculumId === req.params.id && (r.targetCourseId === req.params.courseId || r.expression.courseId === req.params.courseId))
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