// ============================================================================
// DARSCHYN (درس‌چین) - Student Academic Profile & Passed Courses Routes
// ============================================================================

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { StudentAcademicProfile, StudentPassedCourse } from '../../src/types';
import { evaluateStudentEligibility } from '../../src/domain/eligibility-engine';
import { validate } from '../middleware/validate';
import { validateRegistrationPlanReferences, countRegistrationPlanUnits } from '../domain/registration-plan-integrity';
import { updateProfileSchema, addPassedCourseSchema, batchPassedCoursesSchema, updatePlanSchema, planSelectSchema, updateWishlistSchema, updateJourneySchema, registrationProgressSchema } from '../schemas/student';

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
    db.save();
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

  if (idx !== -1) {
    db.studentProfiles[idx] = updatedProfile;
  } else {
    db.studentProfiles.push(updatedProfile);
  }

  db.save();
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
  db.save();

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

  db.save();
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

  db.studentPassedCourses.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'درس با موفقیت از لیست دروس پاس‌شده حذف شد.' });
});

// The first-time wizard stores choices per account AND term. Wishlist courses are
// never counted as registered offerings, and cannot bypass academic eligibility.
function currentStudentTerm(userId: string) {
  const p = db.studentProfiles.find(row => row.userId === userId);
  return p?.currentTermId || db.academicTerms.find(term => term.isCurrent)?.id || 'term-1405-1';
}
function curriculumForStudent(userId: string) {
  const profile = db.studentProfiles.find(row => row.userId === userId);
  if (!profile) return null;
  const chart = db.curricula.find(c =>
    c.status === 'active' && c.universityId === profile.universityId &&
    c.campusId === profile.campusId && c.degreeLevelId === profile.degreeLevelId &&
    c.majorId === profile.majorId && c.entryYearId === profile.entryYearId);
  return chart ? { profile, chart } : null;
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
  let plan = db.studentPlans.find(p => p.userId === req.user!.id && p.termId === termId);
  if (!plan) {
    plan = { id: 'plan-' + req.user!.id + '-' + termId, userId: req.user!.id, termId,
      selectedOfferingIds: [], coursePriorities: {}, offeringPriorities: {},
      updatedAt: new Date().toISOString() };
    db.studentPlans.push(plan);
  }
  plan.wishlistCourseIds = courseIds;
  plan.updatedAt = new Date().toISOString();
  db.save();
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ success: true, data: { wishlistCourseIds: [...courseIds] } });
});

studentRouter.put('/journey', authenticate, validate(updateJourneySchema), (req: AuthenticatedRequest, res) => {
  const termId = currentStudentTerm(req.user!.id);
  let plan = db.studentPlans.find(p => p.userId === req.user!.id && p.termId === termId);
  if (!plan) {
    plan = { id: 'plan-' + req.user!.id + '-' + termId, userId: req.user!.id, termId,
      selectedOfferingIds: [], coursePriorities: {}, offeringPriorities: {},
      updatedAt: new Date().toISOString() };
    db.studentPlans.push(plan);
  }
  plan.journeyStep = req.body.step;
  plan.updatedAt = new Date().toISOString();
  db.save();
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ success: true, data: { step: plan.journeyStep } });
});

// --- Student Course Planning & Authoritative Selection ---

// Get current saved plan
studentRouter.get('/plan', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const profile = db.studentProfiles.find((p) => p.userId === userId);
  const currentTermId = profile?.currentTermId || db.academicTerms.find((t) => t.isCurrent)?.id || 'term-1405-1';

  let plan = db.studentPlans.find((p) => p.userId === userId && p.termId === currentTermId);
  if (!plan) {
    plan = {
      id: `plan-${userId}-${currentTermId}`,
      userId,
      termId: currentTermId,
      selectedOfferingIds: [],
      coursePriorities: {},
      offeringPriorities: {},
      updatedAt: new Date().toISOString(),
    };
    db.studentPlans.push(plan);
    db.save();
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ success: true, data: plan });
});

// A mark means "I manually registered this specific group"; it is never
// an official university confirmation. Keep it private to user and term.
studentRouter.put('/registration-progress', authenticate, validate(registrationProgressSchema), (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const termId = currentStudentTerm(userId);
  const plan = db.studentPlans.find(p => p.userId === userId && p.termId === termId);
  const { offeringId, registered } = req.body as { offeringId: string; registered: boolean };
  if (!plan || !plan.selectedOfferingIds.includes(offeringId)) {
    return res.status(409).json({ success: false, error: 'این گروه در برنامهٔ فعلی شما انتخاب نشده است؛ وضعیت ثبت نمی‌تواند تغییر کند.' });
  }
  const selected = new Set(plan.selectedOfferingIds);
  const previous = (plan.registeredOfferingIds || []).filter(id => selected.has(id));
  plan.registeredOfferingIds = registered
    ? [...new Set([...previous, offeringId])]
    : previous.filter(id => id !== offeringId);
  plan.updatedAt = new Date().toISOString();
  db.save();
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ success: true, data: { registeredOfferingIds: plan.registeredOfferingIds } });
});

// Update whole plan (e.g. sync priorities or offerings)
studentRouter.put('/plan', authenticate, validate(updatePlanSchema), (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { selectedOfferingIds, coursePriorities, offeringPriorities } = req.body;
  const profile = db.studentProfiles.find((p) => p.userId === userId);
  const currentTermId = profile?.currentTermId || db.academicTerms.find((t) => t.isCurrent)?.id || 'term-1405-1';

  const referenceError = validateRegistrationPlanReferences({
    selectedOfferingIds,
    offeringPriorities,
    currentTermId,
    campusId: profile?.campusId,
    offerings: db.courseOfferings,
  });
  if (referenceError) return res.status(400).json({ success: false, error: referenceError });

  if (Array.isArray(selectedOfferingIds) && selectedOfferingIds.length > 0) {
    if (!profile) {
      return res.status(400).json({ success: false, error: 'پروفایل تحصیلی یافت نشد.' });
    }
    const scope = curriculumForStudent(userId);
    if (!scope) {
      return res.status(409).json({ success: false, error: 'چارت فعال مرتبط با دانشگاه، واحد، مقطع، رشته و ورودی این حساب مشخص نیست.' });
    }
    const curriculum = scope.chart;
    const relevantOfferings = db.courseOfferings.filter((o) =>
      o.termId === currentTermId && o.campusId === profile.campusId && o.active);
    const passedCourses = db.studentPassedCourses.filter((spc) => spc.userId === userId);

    const report = evaluateStudentEligibility({
      studentProfile: profile,
      curriculum,
      curriculumCourses: db.curriculumCourses,
      allCourses: db.courses,
      tracks: db.tracks,
      academicRules: db.academicRules,
      passedCourses,
      currentOfferings: relevantOfferings,
      plannedOfferingIdsInSameTerm: selectedOfferingIds, // Evaluate the complete saved combination, including same-term corequisites
    });

    const invalidOfferings = selectedOfferingIds.filter(id => {
      const evalItem = report.results.find((r: any) => r.offeringId === id);
      return !evalItem || !evalItem.canSelect || !evalItem.isEligible || evalItem.overallStatus !== 'AVAILABLE';
    });
    
    if (invalidOfferings.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'برخی از دروس انتخابی دارای منع آیین‌نامه‌ای هستند و قابل ثبت نیستند.',
        invalidIds: invalidOfferings,
      });
    }

    const countedUnits = countRegistrationPlanUnits(selectedOfferingIds, db.courseOfferings, db.courses);
    const limit = db.calculateStudentAcademicLimits(userId).effectiveMaxUnits;
    if (!Number.isFinite(limit) || countedUnits > limit) {
      return res.status(400).json({
        success: false,
        error: 'تعداد واحدهای برنامه از سقف فعلی تنظیم‌شده برای این دانشجو بیشتر است.',
      });
    }
  }

  let plan = db.studentPlans.find((p) => p.userId === userId && p.termId === currentTermId);
  if (!plan) {
    plan = {
      id: `plan-${userId}-${currentTermId}`,
      userId,
      termId: currentTermId,
      selectedOfferingIds: Array.isArray(selectedOfferingIds) ? selectedOfferingIds : [],
      coursePriorities: coursePriorities || {},
      offeringPriorities: offeringPriorities || {},
      updatedAt: new Date().toISOString(),
    };
    db.studentPlans.push(plan);
  } else {
    if (Array.isArray(selectedOfferingIds)) plan.selectedOfferingIds = selectedOfferingIds;
    if (coursePriorities) plan.coursePriorities = coursePriorities;
    if (offeringPriorities) plan.offeringPriorities = offeringPriorities;
    plan.updatedAt = new Date().toISOString();
  }

  // Never transfer a "registered" mark onto a different main group.
  plan.registeredOfferingIds = (plan.registeredOfferingIds || [])
    .filter(id => plan.selectedOfferingIds.includes(id));
  db.save();
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ success: true, data: plan });
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

  const currentTermId = profile.currentTermId || db.academicTerms.find((t) => t.isCurrent)?.id || 'term-1405-1';
  let plan = db.studentPlans.find((p) => p.userId === userId && p.termId === currentTermId);
  if (!plan) {
    plan = {
      id: `plan-${userId}-${currentTermId}`,
      userId,
      termId: currentTermId,
      selectedOfferingIds: [],
      coursePriorities: {},
      offeringPriorities: {},
      updatedAt: new Date().toISOString(),
    };
    db.studentPlans.push(plan);
  }

  if (action === 'remove') {
    plan.selectedOfferingIds = plan.selectedOfferingIds.filter((id) => id !== offeringId);
    plan.registeredOfferingIds = (plan.registeredOfferingIds || [])
      .filter(id => plan.selectedOfferingIds.includes(id));
    plan.updatedAt = new Date().toISOString();
    db.save();
    return res.json({
      success: true,
      action: 'removed',
      selectedOfferingIds: plan.selectedOfferingIds,
    });
  }

  // Action: 'add' -> Strict Backend Eligibility & Limits Validation
  const targetOffering = db.courseOfferings.find((o) => o.id === offeringId);
  if (!targetOffering) {
    return res.status(404).json({ success: false, error: 'گروه درسی مورد نظر یافت نشد.' });
  }

  const scope = curriculumForStudent(userId);
  if (!scope) {
    return res.status(409).json({ success: false, error: 'چارت فعال مرتبط با دانشگاه، واحد، مقطع، رشته و ورودی این حساب مشخص نیست.' });
  }
  const curriculum = scope.chart;

  const relevantOfferings = db.courseOfferings.filter(
    (o) => o.termId === currentTermId && o.campusId === profile.campusId && o.active
  );
  const passedCourses = db.studentPassedCourses.filter((spc) => spc.userId === userId);

  const report = evaluateStudentEligibility({
    studentProfile: profile,
    curriculum,
    curriculumCourses: db.curriculumCourses,
    allCourses: db.courses,
    tracks: db.tracks,
    academicRules: db.academicRules,
    
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

  // The add endpoint and whole-plan endpoint enforce the SAME configured
  // limit. A name containing a religious-course keyword is never an exemption.
  const academicLimits = db.calculateStudentAcademicLimits(userId);
  const targetCourse = db.courses.find(c => c.id === targetOffering.courseId);
  const currentSelectedOfferings = db.courseOfferings.filter(o =>
    plan!.selectedOfferingIds.includes(o.id)
  );
  const sameCourseExistingOffering = currentSelectedOfferings.find(o =>
    o.courseId === targetOffering.courseId && o.id !== targetOffering.id
  );
  const candidateIds = [
    ...plan.selectedOfferingIds.filter(id => id !== sameCourseExistingOffering?.id),
    ...(!plan.selectedOfferingIds.includes(offeringId) ? [offeringId] : []),
  ];
  const candidateUnits = countRegistrationPlanUnits(candidateIds, db.courseOfferings, db.courses);
  if (!Number.isFinite(academicLimits.effectiveMaxUnits) ||
      candidateUnits > academicLimits.effectiveMaxUnits) {
    return res.status(400).json({
      success: false,
      error: `افزودن یا جایگزینی گروه «${targetCourse?.name || targetOffering.courseId}» از سقف تنظیم‌شدهٔ فعلی (${academicLimits.effectiveMaxUnits} واحد) عبور می‌کند.`,
    });
  }

  // If a different section of this course was already selected, replace it in selectedOfferingIds
  // and keep it as an alternative in offeringPriorities
  if (sameCourseExistingOffering) {
    plan.selectedOfferingIds = plan.selectedOfferingIds.filter(
      (id) => id !== sameCourseExistingOffering.id
    );
  }

  if (!plan.selectedOfferingIds.includes(offeringId)) {
    plan.selectedOfferingIds.push(offeringId);
  }

  // Update offeringPriorities for this course
  if (!plan.offeringPriorities) plan.offeringPriorities = {};
  const currentCourseOfferings = plan.offeringPriorities[targetOffering.courseId] || [];
  const updatedCourseOfferings = [
    offeringId,
    ...new Set([
      ...currentCourseOfferings.filter((id) => id !== offeringId),
      ...(sameCourseExistingOffering ? [sameCourseExistingOffering.id] : []),
    ]),
  ];
  plan.offeringPriorities[targetOffering.courseId] = updatedCourseOfferings;
  plan.registeredOfferingIds = (plan.registeredOfferingIds || [])
    .filter(id => plan.selectedOfferingIds.includes(id));
  plan.updatedAt = new Date().toISOString();
  db.save();

  res.json({
    success: true,
    action: 'added',
    selectedOfferingIds: plan.selectedOfferingIds,
    plan,
  });
});

