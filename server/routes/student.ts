// ============================================================================
// DARSCHYN (درس‌چین) - Student Academic Profile & Passed Courses Routes
// ============================================================================

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { StudentAcademicProfile, StudentPassedCourse, StudentPlan } from '../../src/types';
import { evaluateStudentEligibility } from '../../src/domain/eligibility-engine';
import { detectPlanConflicts } from '../../src/domain/plan-conflicts';
import { validate } from '../middleware/validate';
import { updateProfileSchema, addPassedCourseSchema, batchPassedCoursesSchema, updatePlanSchema, planSelectSchema, updateWishlistSchema, updateJourneySchema } from '../schemas/student';

export const studentRouter = Router();

// Get student academic profile
studentRouter.get('/profile', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  let profile = db.studentProfiles.find((p) => p.userId === userId);

  if (!profile) {
    // Create initial profile if doesn't exist
    const defaultUniv = db.universities[0];
    const defaultCampus = db.campuses[0];
    const defaultDeg = db.degreeLevels[0];
    const defaultMaj = db.majors[0];
    const defaultYear = db.entryYears.find((y) => y.year === 1403) || db.entryYears[0];
    const defaultTerm = db.academicTerms.find((t) => t.isCurrent) || db.academicTerms[0];

    profile = {
      userId,
      universityId: defaultUniv?.id || '',
      campusId: defaultCampus?.id || '',
      degreeLevelId: defaultDeg?.id || '',
      majorId: defaultMaj?.id || '',
      entryYearId: defaultYear?.id || '',
      isTrackSelected: false,
      selectedTrackId: null,
      desiredTrackIds: db.tracks.filter((t) => t.majorId === defaultMaj?.id).map((t) => t.id),
      currentTermId: defaultTerm?.id || '',
      updatedAt: new Date().toISOString(),
    };
    db.studentProfiles.push(profile);
    try {
      db.save();
    } catch {
      db.data.studentProfiles = db.studentProfiles.filter(row => row.userId !== userId);
      return res.status(500).json({ success: false, error: 'ایجاد پروندهٔ تحصیلی ذخیره نشد.' });
    }
  }

  // Never fall back to the first unrelated university/entry-year chart.
  // Academic recommendations and demand must share the student's exact scope.
  const matchingCurriculum = db.curricula.find(
    (c) =>
      c.status === 'active' &&
      c.universityId === profile!.universityId &&
      c.campusId === profile!.campusId &&
      c.degreeLevelId === profile!.degreeLevelId &&
      c.majorId === profile!.majorId &&
      c.entryYearId === profile!.entryYearId
  ) || null;

  res.json({
    success: true,
    data: {
      profile,
      curriculum: matchingCurriculum,
    },
  });
});

// Update student academic profile
studentRouter.put('/profile', authenticate, validate(updateProfileSchema), (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const {
    universityId,
    campusId,
    degreeLevelId,
    majorId,
    entryYearId,
    isTrackSelected,
    selectedTrackId,
    desiredTrackIds,
    currentTermId,
    previousTermGpa,
  } = req.body;

  let idx = db.studentProfiles.findIndex((p) => p.userId === userId);
  const updatedProfile: StudentAcademicProfile = {
    userId,
    universityId: universityId || db.universities[0]?.id || '',
    campusId: campusId || db.campuses[0]?.id || '',
    degreeLevelId: degreeLevelId || db.degreeLevels[0]?.id || '',
    majorId: majorId || db.majors[0]?.id || '',
    entryYearId: entryYearId || db.entryYears[0]?.id || '',
    isTrackSelected: Boolean(isTrackSelected),
    selectedTrackId: isTrackSelected ? selectedTrackId : null,
    desiredTrackIds: Array.isArray(desiredTrackIds) ? desiredTrackIds : [],
    currentTermId: currentTermId || db.academicTerms.find((t) => t.isCurrent)?.id || '',
    // Student identifier was collected for demand planning; profile edits must preserve it.
    studentNumber: idx !== -1 ? db.studentProfiles[idx].studentNumber : undefined,
    previousTermGpa: previousTermGpa !== undefined ? Number(previousTermGpa) : null,
    updatedAt: new Date().toISOString(),
  };

  const previousProfile = idx !== -1 ? db.studentProfiles[idx] : undefined;
  if (idx !== -1) {
    db.studentProfiles[idx] = updatedProfile;
  } else {
    db.studentProfiles.push(updatedProfile);
  }

  try {
    db.save();
  } catch {
    if (previousProfile) db.studentProfiles[idx] = previousProfile;
    else db.data.studentProfiles = db.studentProfiles.filter(row => row.userId !== userId);
    return res.status(500).json({ success: false, error: 'تغییرات پروندهٔ تحصیلی ذخیره نشد.' });
  }
  res.json({ success: true, data: updatedProfile });
});

// --- Passed Courses ---
studentRouter.get('/passed-courses', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const userPassed = db.studentPassedCourses.filter((spc) => spc.userId === userId);

  // Populate course details and compute units
  let totalUnits = 0;
  const categorySummary: Record<string, number> = {};

  const countedPassed = new Set<string>();
  const enrichedList = userPassed.map((p) => {
    const course = db.courses.find((c) => c.id === p.courseId);
    const passed = p.status !== 'FAILED' && p.status !== 'ABSENT' && (p.grade === undefined || p.grade >= 10);
    if (course && passed && !countedPassed.has(p.courseId)) {
      countedPassed.add(p.courseId);
      totalUnits += course.units;
      categorySummary[course.category] = (categorySummary[course.category] || 0) + course.units;
    }
    return {
      ...p,
      course,
    };
  });

  res.json({
    success: true,
    data: {
      passedCourses: enrichedList,
      totalUnits,
      categorySummary,
    },
  });
});

studentRouter.post('/passed-courses', authenticate, validate(addPassedCourseSchema), (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { courseId, grade, termId, status } = req.body;

  if (!courseId) {
    return res.status(400).json({ success: false, error: 'شناسه درس مشخص نشده است.' });
  }

  if (!db.courses.some(course => course.id === courseId && course.active)) {
    return res.status(400).json({ success: false, error: 'این درس در کاتالوگ فعال وجود ندارد.' });
  }

  const existing = db.studentPassedCourses.find(
    (spc) => spc.userId === userId && spc.courseId === courseId &&
      spc.status !== 'FAILED' && spc.status !== 'ABSENT' &&
      (spc.grade === undefined || spc.grade >= 10)
  );
  if (existing) {
    return res.status(400).json({ success: false, error: 'این درس قبلاً به عنوان درس گذرانده‌شده ثبت شده است.' });
  }

  const newEntry: StudentPassedCourse = {
    id: 'spc-' + randomUUID(),
    userId,
    courseId,
    grade,
    status: status || (grade !== undefined && grade < 10 ? 'FAILED' : 'PASSED'),
    termId: termId || undefined,
    passedAt: new Date().toISOString(),
  };

  db.studentPassedCourses.push(newEntry);
  try {
    db.save();
  } catch {
    db.data.studentPassedCourses = db.studentPassedCourses.filter(row => row.id !== newEntry.id);
    return res.status(500).json({ success: false, error: 'سابقهٔ درس ذخیره نشد.' });
  }

  const course = db.courses.find((c) => c.id === courseId);
  res.json({ success: true, data: { ...newEntry, course } });
});

// Batch update passed courses
studentRouter.post('/passed-courses/batch', authenticate, validate(batchPassedCoursesSchema), (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { courseIds, replaceAll } = req.body;

  if (!Array.isArray(courseIds)) {
    return res.status(400).json({ success: false, error: 'لیست شناسه‌های دروس باید آرایه باشد.' });
  }

  // Validate every ID before mutating the account. Never lose historical
  // failures/absences when replacing the current PASSED checklist.
  if (courseIds.length > 500 || courseIds.some((id: unknown) =>
    typeof id !== 'string' || !db.courses.some(course => course.id === id && course.active))) {
    return res.status(400).json({ success: false, error: 'فهرست دروس حاوی درس نامعتبر یا بیش از حد مجاز است.' });
  }

  // Retain the full previous attempt history for rollback if persistence fails.
  const beforeBatch = db.studentPassedCourses.slice();
  if (replaceAll) {
    const retainedPassed = new Set(courseIds);
    for (let i = db.studentPassedCourses.length - 1; i >= 0; i--) {
      const record = db.studentPassedCourses[i];
      const isPassed = record.status !== 'FAILED' && record.status !== 'ABSENT' &&
        (record.grade === undefined || record.grade >= 10);
      // Preserve grade, term and original attempt ID for each retained success.
      if (record.userId === userId && isPassed && !retainedPassed.has(record.courseId)) {
        db.studentPassedCourses.splice(i, 1);
      }
    }
  }

  const existingCourseIds = new Set(
    db.studentPassedCourses.filter((spc) => spc.userId === userId &&
      spc.status !== 'FAILED' && spc.status !== 'ABSENT' &&
      (spc.grade === undefined || spc.grade >= 10)).map((spc) => spc.courseId)
  );

  let addedCount = 0;
  for (const cid of courseIds) {
    if (!existingCourseIds.has(cid)) {
      const course = db.courses.find((c) => c.id === cid);
      if (course) {
        db.studentPassedCourses.push({
          id: 'spc-' + randomUUID(),
          userId,
          courseId: cid,
          status: 'PASSED',
          passedAt: new Date().toISOString(),
        });
        existingCourseIds.add(cid);
        addedCount++;
      }
    }
  }

  try {
    db.save();
  } catch {
    db.data.studentPassedCourses = beforeBatch;
    return res.status(500).json({ success: false, error: 'فهرست دروس گذرانده ذخیره نشد.' });
  }
  res.json({ success: true, addedCount, totalPassed: existingCourseIds.size });
});

studentRouter.delete('/passed-courses/:id', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const idx = db.studentPassedCourses.findIndex(
    (spc) => spc.id === req.params.id && spc.userId === userId
  );
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'رکورد درس پاس‌شده یافت نشد.' });
  }

  const [removed] = db.studentPassedCourses.splice(idx, 1);
  try {
    db.save();
  } catch {
    db.studentPassedCourses.splice(idx, 0, removed);
    return res.status(500).json({ success: false, error: 'حذف سابقهٔ درس ذخیره نشد.' });
  }
  res.json({ success: true, message: 'درس با موفقیت از لیست دروس پاس‌شده حذف شد.' });
});

// The first-time wizard stores choices per account AND term. Wishlist courses are
// never counted as registered offerings, and cannot bypass academic eligibility.
function currentStudentTerm(userId: string): string | null {
  const profile = db.studentProfiles.find(row => row.userId === userId);
  const termId = profile?.currentTermId || db.academicTerms.find(term => term.isCurrent)?.id;
  return termId && db.academicTerms.some(term => term.id === termId) ? termId : null;
}
function curriculumForStudent(userId: string) {
  const profile = db.studentProfiles.find(row => row.userId === userId);
  if (!profile) return null;
  const matches = db.curricula.filter(c =>
    c.status === 'active' && c.universityId === profile.universityId &&
    c.campusId === profile.campusId && c.degreeLevelId === profile.degreeLevelId &&
    c.majorId === profile.majorId && c.entryYearId === profile.entryYearId);
  // Never choose the first arbitrary version when two active charts conflict.
  return matches.length === 1 ? { profile, chart: matches[0] } : null;
}
function blankStudentPlan(userId: string, termId: string): StudentPlan {
  return {
    id: `plan-${userId}-${termId}`, userId, termId,
    selectedOfferingIds: [], coursePriorities: {}, offeringPriorities: {},
    updatedAt: new Date().toISOString(),
  };
}
/**
 * Each student's planning writes must either persist as a unit or restore the
 * original in-memory object. Never leave uncommitted selections visible.
 */
function saveStudentPlan(userId: string, termId: string, change: (plan: StudentPlan) => void): StudentPlan | null {
  const old = db.studentPlans.find(row => row.userId === userId && row.termId === termId);
  const before = old ? structuredClone(old) : null;
  const plan = old ?? blankStudentPlan(userId, termId);
  if (!old) db.studentPlans.push(plan);
  change(plan);
  try {
    db.save();
    return plan;
  } catch {
    if (!old) db.data.studentPlans = db.studentPlans.filter(row => row !== plan);
    else {
      // Preserve the original object identity used in other in-process reads.
      for (const key of Object.keys(plan) as Array<keyof StudentPlan>) {
        if (!(key in before!)) delete (plan as unknown as Record<string, unknown>)[key];
      }
      Object.assign(plan, before!);
    }
    return null;
  }
}

studentRouter.get('/wishlist/catalog', authenticate, (req: AuthenticatedRequest, res) => {
  const scope = curriculumForStudent(req.user!.id);
  if (!scope) return res.status(409).json({ success: false, error: 'برای مشاهدهٔ سبد، ابتدا پرونده و چارت تحصیلی معتبر خود را تکمیل کنید.' });
  const passed = new Set(db.studentPassedCourses.filter(item => item.userId === req.user!.id &&
    item.status !== 'FAILED' && item.status !== 'ABSENT' &&
    (item.grade === undefined || item.grade >= 10)).map(item => item.courseId));
  const courses = db.curriculumCourses.filter(cc =>
    cc.curriculumId === scope.chart.id && cc.active !== false &&
    (!cc.trackId || !scope.profile.selectedTrackId || cc.trackId === scope.profile.selectedTrackId))
    .map(cc => {
      const course = db.courses.find(c => c.id === cc.courseId && c.active);
      return course && !passed.has(course.id)
        ? { id: course.id, name: course.name, code: course.code, units: course.units,
            category: course.category, suggestedSemester: cc.suggestedSemester } : null;
    })
    .filter((course): course is NonNullable<typeof course> => course !== null);
  const unique = [...new Map(courses.map(c => [c.id, c])).values()];
  unique.sort((a, b) => Number(a.suggestedSemester || 0) - Number(b.suggestedSemester || 0) ||
    a.name.localeCompare(b.name, 'fa'));
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ success: true, data: unique });
});

studentRouter.put('/wishlist', authenticate, validate(updateWishlistSchema), (req: AuthenticatedRequest, res) => {
  const scope = curriculumForStudent(req.user!.id);
  if (!scope) return res.status(409).json({ success: false, error: 'چارت آموزشی معتبر برای حساب پیدا نشد.' });
  const courseIds: string[] = req.body.courseIds;
  const eligibleCatalog = new Set(db.curriculumCourses.filter(cc =>
    cc.curriculumId === scope.chart.id && cc.active !== false &&
    (!cc.trackId || !scope.profile.selectedTrackId || cc.trackId === scope.profile.selectedTrackId) &&
    db.courses.some(course => course.id === cc.courseId && course.active)
  ).map(cc => cc.courseId));
  const passed = new Set(db.studentPassedCourses.filter(item => item.userId === req.user!.id &&
    item.status !== 'FAILED' && item.status !== 'ABSENT' &&
    (item.grade === undefined || item.grade >= 10)).map(item => item.courseId));
  if (courseIds.some(id => !eligibleCatalog.has(id) || passed.has(id))) {
    return res.status(400).json({ success: false, error: 'سبد فقط می‌تواند شامل درس‌های گذرانده‌نشدهٔ چارت همین حساب باشد.' });
  }
  const termId = currentStudentTerm(req.user!.id);
  if (!termId) return res.status(409).json({ success: false, error: 'نیمسال پروندهٔ تحصیلی معتبر نیست.' });
  const saved = saveStudentPlan(req.user!.id, termId, plan => {
    plan.wishlistCourseIds = [...courseIds];
    plan.updatedAt = new Date().toISOString();
  });
  if (!saved) return res.status(503).json({ success: false, error: 'ذخیرهٔ سبد درس‌ها انجام نشد؛ دوباره تلاش کنید.' });
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ success: true, data: { wishlistCourseIds: [...courseIds] } });
});

studentRouter.put('/journey', authenticate, validate(updateJourneySchema), (req: AuthenticatedRequest, res) => {
  const termId = currentStudentTerm(req.user!.id);
  if (!termId) return res.status(409).json({ success: false, error: 'نیمسال پروندهٔ تحصیلی معتبر نیست.' });
  const saved = saveStudentPlan(req.user!.id, termId, plan => {
    plan.journeyStep = req.body.step;
    plan.updatedAt = new Date().toISOString();
  });
  if (!saved) return res.status(503).json({ success: false, error: 'ذخیرهٔ مرحلهٔ راهنما انجام نشد؛ دوباره تلاش کنید.' });
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ success: true, data: { step: saved.journeyStep } });
});

// --- Student Course Planning & Authoritative Selection ---

// Get current saved plan
studentRouter.get('/plan', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const profile = db.studentProfiles.find((p) => p.userId === userId);
  const currentTermId = currentStudentTerm(userId);
  if (!profile || !currentTermId) {
    return res.status(409).json({ success: false, error: 'ابتدا پروندهٔ تحصیلی و نیمسال معتبر خود را تعیین کنید.' });
  }
  // GET is read-only; creating empty accounts/plans on a read is unnecessary.
  const plan = db.studentPlans.find((p) => p.userId === userId && p.termId === currentTermId) ??
    blankStudentPlan(userId, currentTermId);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ success: true, data: plan });
});

// Update whole plan (e.g. sync priorities or offerings)
studentRouter.put('/plan', authenticate, validate(updatePlanSchema), (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { selectedOfferingIds, coursePriorities, offeringPriorities } = req.body;
  const profile = db.studentProfiles.find(p => p.userId === userId);
  const termId = currentStudentTerm(userId);
  if (!profile || !termId) {
    return res.status(409).json({ success: false, error: 'ابتدا پروندهٔ تحصیلی و نیمسال معتبر خود را مشخص کنید.' });
  }

  if (Array.isArray(selectedOfferingIds) && selectedOfferingIds.length > 0) {
    // Reuse the exact cohort contract of the eligibility API, not the first
    // catalog chart from another campus, degree or entry year.
    const scope = curriculumForStudent(userId);
    if (!scope) {
      return res.status(409).json({ success: false, error: 'چارت فعال و یکتای این ورودی پیدا نشد؛ تنظیم آن باید بررسی شود.' });
    }
    const relevantOfferings = db.courseOfferings.filter(o =>
      o.termId === termId && o.campusId === profile.campusId && o.active
    );
    const report = evaluateStudentEligibility({
      studentProfile: profile,
      curriculum: scope.chart,
      curriculumCourses: db.curriculumCourses,
      allCourses: db.courses,
      tracks: db.tracks,
      academicRules: db.academicRules,
      allowFinalSemesterPrerequisiteOverride: profile.isFinalSemesterOverride === true &&
        db.academicSettings.finalSemesterRuleEnabled,
      passedCourses: db.studentPassedCourses.filter(row => row.userId === userId),
      currentOfferings: relevantOfferings,
      plannedOfferingIdsInSameTerm: selectedOfferingIds,
    });
    const byOffering = new Map(report.results.map(item => [item.offeringId, item]));
    const uniqueCourses = new Set<string>();
    const invalidIds = selectedOfferingIds.filter((id: string) => {
      const item = byOffering.get(id);
      if (!item || !item.canSelect || !item.isEligible || item.overallStatus !== 'AVAILABLE' ||
          uniqueCourses.has(item.courseId)) return true;
      uniqueCourses.add(item.courseId);
      return false;
    });
    if (invalidIds.length) {
      return res.status(400).json({
        success: false, error: 'برخی گروه‌ها متعلق به این واحد/چارت نیستند، منع آموزشی دارند یا برای یک درس تکراری‌اند.',
        invalidIds,
      });
    }
    const selectedOfferings = relevantOfferings.filter(offering =>
      selectedOfferingIds.includes(offering.id)
    );
    const collisions = detectPlanConflicts(selectedOfferings);
    if (collisions.length) {
      return res.status(409).json({
        success: false,
        error: 'برنامهٔ انتخاب‌شده تداخل قطعی ساعت کلاس یا شروع امتحان دارد؛ گروه جایگزین انتخاب کنید.',
        conflicts: collisions,
      });
    }
    // Bulk plan updates must not bypass the existing configured unit ceiling.
    // Only explicitly flagged extra-unit courses are excluded, never guessed
    // by Persian course names (Maaref policy awaits owner confirmation).
    const currentUnits = [...uniqueCourses].reduce((sum, courseId) => {
      const course = db.courses.find(row => row.id === courseId);
      return sum + (course && !course.isExtraUnit ? course.units : 0);
    }, 0);
    const maxUnits = db.calculateStudentAcademicLimits(userId).effectiveMaxUnits;
    if (currentUnits > maxUnits) {
      return res.status(400).json({
        success: false, error: `مجموع ${currentUnits} واحد از سقف تنظیم‌شدهٔ ${maxUnits} واحد بیشتر است.`,
      });
    }
  }

  const saved = saveStudentPlan(userId, termId, plan => {
    if (Array.isArray(selectedOfferingIds)) plan.selectedOfferingIds = [...selectedOfferingIds];
    if (coursePriorities !== undefined) plan.coursePriorities = structuredClone(coursePriorities);
    if (offeringPriorities !== undefined) plan.offeringPriorities = structuredClone(offeringPriorities);
    plan.updatedAt = new Date().toISOString();
  });
  if (!saved) return res.status(503).json({ success: false, error: 'ذخیرهٔ برنامه انجام نشد؛ دوباره تلاش کنید.' });
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ success: true, data: saved });
});
// Authoritative Add/Remove offering validation endpoint
studentRouter.post('/plan/select', authenticate, validate(planSelectSchema), (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { offeringId, action } = req.body; // action: 'add' | 'remove'

  if (!offeringId) {
    return res.status(400).json({ success: false, error: 'شناسه گروه درسی مشخص نشده است.' });
  }

  const profile = db.studentProfiles.find((p) => p.userId === userId);
  if (!profile) {
    return res.status(400).json({ success: false, error: 'پروفایل تحصیلی دانشجو یافت نشد.' });
  }

  const currentTermId = currentStudentTerm(userId);
  if (!currentTermId) {
    return res.status(409).json({ success: false, error: 'نیمسال معتبر در پروندهٔ شما ثبت نشده است.' });
  }
  // Never create a phantom plan before academic validation has completed.
  const plan = db.studentPlans.find(p => p.userId === userId && p.termId === currentTermId) ??
    blankStudentPlan(userId, currentTermId);

  if (action === 'remove') {
    // Removing a group that was never selected is idempotent and read-only.
    if (!plan.selectedOfferingIds.includes(offeringId)) {
      return res.json({ success: true, action: 'removed', selectedOfferingIds: plan.selectedOfferingIds });
    }
    const saved = saveStudentPlan(userId, currentTermId, draft => {
      draft.selectedOfferingIds = draft.selectedOfferingIds.filter(id => id !== offeringId);
      draft.updatedAt = new Date().toISOString();
    });
    if (!saved) return res.status(503).json({ success: false, error: 'حذف گروه در برنامه ذخیره نشد.' });
    return res.json({
      success: true,
      action: 'removed',
      selectedOfferingIds: saved.selectedOfferingIds,
    });
  }

  // Action: 'add' -> Strict Backend Eligibility & Limits Validation
  const targetOffering = db.courseOfferings.find((o) => o.id === offeringId);
  if (!targetOffering) {
    return res.status(404).json({ success: false, error: 'گروه درسی مورد نظر یافت نشد.' });
  }
  if (!targetOffering.active || targetOffering.termId !== currentTermId ||
      targetOffering.campusId !== profile.campusId) {
    return res.status(403).json({ success: false, error: 'گروه درسی خارج از نیمسال یا واحد دانشگاهی پروندهٔ شماست.' });
  }
  const scope = curriculumForStudent(userId);
  if (!scope) {
    return res.status(409).json({ success: false, error: 'چارت فعال و یکتای رشته و ورودی شما باید مشخص شود.' });
  }
  const curriculum = scope.chart;

  const relevantOfferings = db.courseOfferings.filter(
    o => o.termId === currentTermId && o.campusId === profile.campusId && o.active
  );
  const passedCourses = db.studentPassedCourses.filter((spc) => spc.userId === userId);

  const report = evaluateStudentEligibility({
    studentProfile: profile,
    curriculum,
    curriculumCourses: db.curriculumCourses,
    allCourses: db.courses,
    tracks: db.tracks,
    academicRules: db.academicRules,
    allowFinalSemesterPrerequisiteOverride: profile.isFinalSemesterOverride === true &&
      db.academicSettings.finalSemesterRuleEnabled,
    passedCourses,
    currentOfferings: relevantOfferings,
    plannedOfferingIdsInSameTerm: plan.selectedOfferingIds,
  });

  const offeringEval = report.results.find((r: any) => r.offeringId === offeringId);
  if (!offeringEval) {
    return res.status(400).json({
      success: false,
      error: 'امکان ارزیابی تطبیقی این درس وجود ندارد.',
    });
  }

  if (!offeringEval.canSelect || !offeringEval.isEligible || offeringEval.overallStatus !== 'AVAILABLE') {
    return res.status(400).json({
      success: false,
      error: `این درس غیرقابل اخذ است: ${offeringEval.primaryReason || 'پیش‌نیاز یا شرایط لازم احراز نشده است.'}`,
      details: {
        overallStatus: offeringEval.overallStatus,
        primaryReason: offeringEval.primaryReason,
        missingPrerequisites: offeringEval.missingPrerequisites,
        missingCorequisites: offeringEval.missingCorequisites,
      },
    });
  }

  // Academic Units Limit Check
  const academicLimits = db.calculateStudentAcademicLimits(userId);
  const targetCourse = db.courses.find((c) => c.id === targetOffering.courseId);
  const targetUnits = targetCourse?.units || 0;

  const currentSelectedOfferings = db.courseOfferings.filter((o) =>
    plan!.selectedOfferingIds.includes(o.id)
  );

  // Check if another section of the same course is currently selected
  const sameCourseExistingOffering = currentSelectedOfferings.find(
    (o) => o.courseId === targetOffering.courseId && o.id !== targetOffering.id
  );

  let currentUnits = currentSelectedOfferings.reduce((sum, o) => {
    const c = db.courses.find((crs) => crs.id === o.courseId);
    return sum + (c && !c.isExtraUnit ? c.units : 0);
  }, 0);

  // If swapping section of same course, subtract old section's units
  if (sameCourseExistingOffering) {
    const oldCourse = db.courses.find((crs) => crs.id === sameCourseExistingOffering.courseId);
    if (oldCourse && !oldCourse.isExtraUnit) {
      currentUnits -= oldCourse.units;
    }
  }

  const isExtra = targetCourse?.isExtraUnit === true;
  if (!isExtra && currentUnits + targetUnits > academicLimits.effectiveMaxUnits) {
    const limitLabel = academicLimits.isSummer
      ? 'ترم تابستان (۸ واحد)'
      : academicLimits.isFinalSemester
      ? 'ترم آخر (۲۴ واحد)'
      : academicLimits.isGradeA
      ? 'معدل الف (۲۴ واحد)'
      : `عادی (${academicLimits.effectiveMaxUnits} واحد)`;

    return res.status(400).json({
      success: false,
      error: `افزودن این درس (${targetUnits} واحد) باعث عبور از سقف مجاز انتخاب واحد ${limitLabel} می‌شود.`,
    });
  }

  // The final schedule excludes the previous section when swapping groups.
  // Validate against the entire resulting plan, not just the target group.
  const finalIds = [
    ...plan.selectedOfferingIds.filter(id => id !== sameCourseExistingOffering?.id),
    offeringId,
  ];
  const finalOfferings = relevantOfferings.filter(row => finalIds.includes(row.id));
  const collisions = detectPlanConflicts(finalOfferings);
  if (collisions.length) {
    return res.status(409).json({
      success: false,
      error: 'گروه انتخابی با کلاس یا امتحان برنامهٔ فعلی تداخل قطعی دارد؛ گروه جایگزین را بررسی کنید.',
      conflicts: collisions,
    });
  }

  // Group swaps and alternative priorities are one atomic student-owned write.
  const saved = saveStudentPlan(userId, currentTermId, draft => {
    if (sameCourseExistingOffering) {
      draft.selectedOfferingIds = draft.selectedOfferingIds.filter(
        id => id !== sameCourseExistingOffering.id
      );
    }
    if (!draft.selectedOfferingIds.includes(offeringId)) {
      draft.selectedOfferingIds.push(offeringId);
    }
    if (!draft.offeringPriorities) draft.offeringPriorities = {};
    const previous = draft.offeringPriorities[targetOffering.courseId] || [];
    draft.offeringPriorities[targetOffering.courseId] = [
      offeringId, ...previous.filter(id => id !== offeringId),
    ];
    draft.updatedAt = new Date().toISOString();
  });
  if (!saved) return res.status(503).json({ success: false, error: 'ثبت گروه یا جایگزین‌ها در برنامه ذخیره نشد.' });

  res.json({
    success: true,
    action: 'added',
    selectedOfferingIds: saved.selectedOfferingIds,
    plan: saved,
  });
});

