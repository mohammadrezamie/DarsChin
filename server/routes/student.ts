// ============================================================================
// DARSCHYN (درس‌چین) - Student Academic Profile & Passed Courses Routes
// ============================================================================

import { Router } from 'express';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { StudentAcademicProfile, StudentPassedCourse } from '../../src/types';
import { evaluateStudentEligibility } from '../../src/domain/eligibility-engine';
import { evaluateScheduleQuality, preservesSelectedCourses } from '../../src/domain/schedule-quality';
import { validate } from '../middleware/validate';
import { updateProfileSchema, addPassedCourseSchema, batchPassedCoursesSchema, updatePlanSchema, planSelectSchema } from '../schemas/student';

export const studentRouter = Router();

// Academic decisions must never borrow the first chart from another campus
// or cohort. Prefer one exact active chart, consistent with GET /profile.
const findStudentCurriculum = (profile: StudentAcademicProfile) =>
  db.curricula.find(c =>
    c.status === 'active' &&
    c.universityId === profile.universityId &&
    c.campusId === profile.campusId &&
    c.degreeLevelId === profile.degreeLevelId &&
    c.majorId === profile.majorId &&
    c.entryYearId === profile.entryYearId
  ) || null;

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
  const matchingCurriculum = findStudentCurriculum(profile!);

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

  const enrichedList = userPassed.map((p) => {
    const course = db.courses.find((c) => c.id === p.courseId);
    if (course) {
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
  const { courseId, grade, termId } = req.body;

  if (!courseId) {
    return res.status(400).json({ success: false, error: 'شناسه درس مشخص نشده است.' });
  }

  const existing = db.studentPassedCourses.find(
    (spc) => spc.userId === userId && spc.courseId === courseId
  );
  if (existing) {
    return res.status(400).json({ success: false, error: 'این درس قبلاً به عنوان درس گذرانده‌شده ثبت شده است.' });
  }

  const newEntry: StudentPassedCourse = {
    id: `spc-${Date.now()}`,
    userId,
    courseId,
    grade: grade !== undefined && grade !== '' ? Number(grade) : undefined,
    status: (grade !== undefined && grade !== '' && Number(grade) < 10) ? 'FAILED' : 'PASSED',
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

  if (replaceAll) {
    for (let i = db.studentPassedCourses.length - 1; i >= 0; i--) {
      if (db.studentPassedCourses[i].userId === userId) {
        db.studentPassedCourses.splice(i, 1);
      }
    }
  }

  const existingCourseIds = new Set(
    db.studentPassedCourses.filter((spc) => spc.userId === userId).map((spc) => spc.courseId)
  );

  let addedCount = 0;
  for (const cid of courseIds) {
    if (!existingCourseIds.has(cid)) {
      const course = db.courses.find((c) => c.id === cid);
      if (course) {
        db.studentPassedCourses.push({
          id: `spc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          userId,
          courseId: cid,
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

  res.json({ success: true, data: plan });
});

// Update whole plan (e.g. sync priorities or offerings)
studentRouter.put('/plan', authenticate, validate(updatePlanSchema), (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { selectedOfferingIds, coursePriorities, offeringPriorities, qualitySuggestion } = req.body;
  const profile = db.studentProfiles.find((p) => p.userId === userId);
  const currentTermId = profile?.currentTermId || db.academicTerms.find((t) => t.isCurrent)?.id || 'term-1405-1';

  if (Array.isArray(selectedOfferingIds) && selectedOfferingIds.length > 0) {
    if (!profile) {
      return res.status(400).json({ success: false, error: 'پروفایل تحصیلی یافت نشد.' });
    }
    const curriculum = findStudentCurriculum(profile);
    if(!curriculum){
      return res.status(409).json({success:false,
        error:'برای دانشگاه، واحد، مقطع، رشته و ورودی شما چارت فعال معتبری پیدا نشد؛ اطلاعات پروفایل یا چارت را بررسی کنید.'});
    }
    const relevantOfferings = db.courseOfferings.filter(o =>
      o.termId === currentTermId && o.campusId === profile.campusId && o.active !== false);
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
      plannedOfferingIdsInSameTerm: [], // Evaluate independently
    });

    const invalidOfferings = selectedOfferingIds.filter(id => {
      const evalItem = report.results.find((r: any) => r.offeringId === id);
      return !evalItem || !evalItem.canSelect || !evalItem.isEligible || evalItem.overallStatus !== 'AVAILABLE';
    });
    
    if (invalidOfferings.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'برخی از دروس انتخابی دارای منع آیین‌نامه‌ای هستند و قابل ثبت نیستند.',
        invalidIds: invalidOfferings
      });
    }

    // Strictly validate *atomic suggested schedule* saves, without changing the
    // existing manual plan editor's ability to display imperfect draft plans.
    if(qualitySuggestion===true){
      const existing=db.studentPlans.find(p=>p.userId===userId&&p.termId===currentTermId);
      const previous=existing?.selectedOfferingIds||[];
      if(!preservesSelectedCourses(previous,selectedOfferingIds,
        db.courseOfferings.map(o=>({offeringId:o.id,courseId:o.courseId})))){
        return res.status(409).json({
          success:false,error:'پیشنهاد باید فقط گروه‌های همین دروس فعلی را جابه‌جا کند؛ برنامه تغییر نکرد.',
        });
      }
      const quality=evaluateScheduleQuality(report.results,selectedOfferingIds);
      if(quality.activeDays===null){
        return res.status(409).json({
          success:false,error:'گروه‌های پیشنهادشده ساعت معتبر یا ترکیب بدون تداخل ندارند؛ برنامه تغییر نکرد.',
        });
      }
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

  db.save();
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
  const isNewPlan = !plan;
  if (!plan) {
    // Keep a new plan in memory until the selected group passes ALL checks.
    // Otherwise an invalid/unauthorized add leaves an empty persisted record.
    plan = {
      id: `plan-${userId}-${currentTermId}`,
      userId,
      termId: currentTermId,
      selectedOfferingIds: [],
      coursePriorities: {},
      offeringPriorities: {},
      updatedAt: new Date().toISOString(),
    };
  }

  if (action === 'remove') {
    if (isNewPlan) {
      return res.json({success:true,action:'removed',selectedOfferingIds:[]});
    }
    plan.selectedOfferingIds = plan.selectedOfferingIds.filter((id) => id !== offeringId);
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

  const curriculum = findStudentCurriculum(profile);
  if(!curriculum) {
    return res.status(409).json({success:false,
      error:'چارت فعال مربوط به دانشگاه، واحد، مقطع، رشته و ورودی شما یافت نشد.'});
  }

  const relevantOfferings = db.courseOfferings.filter(
    o => o.termId === currentTermId && o.campusId === profile.campusId && o.active !== false
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
    if (c?.name.includes('وصایا') || c?.name.includes('انس')) return sum;
    return sum + (c?.units || 0);
  }, 0);

  // If swapping section of same course, subtract old section's units
  if (sameCourseExistingOffering) {
    const oldCourse = db.courses.find((crs) => crs.id === sameCourseExistingOffering.courseId);
    if (!oldCourse?.name.includes('وصایا') && !oldCourse?.name.includes('انس')) {
      currentUnits -= oldCourse?.units || 0;
    }
  }

  const isExtra = targetCourse?.name.includes('وصایا') || targetCourse?.name.includes('انس');
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
    ...currentCourseOfferings.filter((id) => id !== offeringId),
  ];
  plan.offeringPriorities[targetOffering.courseId] = updatedCourseOfferings;

  plan.updatedAt = new Date().toISOString();
  if(isNewPlan) db.studentPlans.push(plan);
  db.save();

  res.json({
    success: true,
    action: 'added',
    selectedOfferingIds: plan.selectedOfferingIds,
    plan,
  });
});

