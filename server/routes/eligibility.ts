// ============================================================================
// DARSCHYN (درس‌چین) - Course Eligibility Evaluation & Recommendations Routes
// ============================================================================

import { Router } from 'express';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { evaluateStudentEligibility } from '../../src/domain/eligibility-engine';
import { generateCourseRecommendations } from '../../src/domain/recommendation-engine';

export const eligibilityRouter = Router();

// Evaluate student eligibility for current offerings
eligibilityRouter.post('/evaluate', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { plannedCourseIds = [] } = req.body || {};
    if (!Array.isArray(plannedCourseIds) || plannedCourseIds.length > 500 ||
        plannedCourseIds.some((id: unknown) => typeof id !== 'string' || !id.trim()) ||
        new Set(plannedCourseIds).size !== plannedCourseIds.length) {
      return res.status(400).json({ success: false, error: 'فهرست گروه‌های انتخابی برای تحلیل معتبر نیست.' });
    }

    // Get student profile
    const profile = db.studentProfiles.find((p) => p.userId === userId);
    if (!profile) {
      return res.status(400).json({
        success: false,
        error: 'پروفایل تحصیلی دانشجو هنوز تکمیل نشده است. لطفاً ابتدا اطلاعات تحصیلی خود را ثبت نمایید.',
      });
    }

    // Find student's curriculum
    const curriculum = db.curricula.find(c =>
      c.status === 'active' &&
      c.universityId === profile.universityId &&
      c.campusId === profile.campusId &&
      c.degreeLevelId === profile.degreeLevelId &&
      c.majorId === profile.majorId &&
      c.entryYearId === profile.entryYearId
    );

    if (!curriculum) {
      return res.status(400).json({
        success: false,
        error: 'هیچ چارت درسی مصوبی برای رشته و سال ورود شما یافت نشد.',
      });
    }

    // Scope the entire analysis, including its inputs, to this student's
    // campus and current term. Other campuses are not interchangeable.
    const currentTermId = profile.currentTermId || db.academicTerms.find(t => t.isCurrent)?.id;
    if (!currentTermId || !db.academicTerms.some(t => t.id === currentTermId)) {
      return res.status(409).json({ success: false, error: 'نیمسال تحصیلی فعلی در پرونده مشخص نیست.' });
    }
    const relevantOfferings = db.courseOfferings.filter(o =>
      o.termId === currentTermId && o.campusId === profile.campusId && o.active === true
    );
    // Existing clients submit either an offering ID or a course ID. Permit
    // both ONLY when at least one active offering for that course exists in
    // this student's exact campus and term; reject all foreign IDs.
    const allowedPlanIds = new Set(relevantOfferings.flatMap(o => [o.id, o.courseId]));
    if (plannedCourseIds.some((id: string) => !allowedPlanIds.has(id))) {
      return res.status(400).json({
        success: false,
        error: 'فهرست تحلیل فقط می‌تواند شامل درس‌ها یا گروه‌های همین پردیس و نیمسال باشد.',
      });
    }
    

    // Get student passed courses
    const passedCourses = db.studentPassedCourses.filter((spc) => spc.userId === userId);

    // Execute Deterministic Eligibility Engine
    const report = evaluateStudentEligibility({
      studentProfile: profile,
      curriculum,
      curriculumCourses: db.curriculumCourses,
      allCourses: db.courses,
      tracks: db.tracks,
      academicRules: db.academicRules,
      
      passedCourses,
      currentOfferings: relevantOfferings,
      plannedOfferingIdsInSameTerm: plannedCourseIds,
    });

    // Also compute recommendations for eligible courses
    const recommendations = generateCourseRecommendations({
      curriculum,
      curriculumCourses: db.curriculumCourses,
      allCourses: db.courses,
      academicRules: db.academicRules,
      eligibilityResults: report.results,
      studentProfile: profile,
      // Do not invent a third-semester standing for every student.
    });

    // Calculate real-time academic limits & final semester eligibility
    const academicLimits = db.calculateStudentAcademicLimits(userId);

    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({
      success: true,
      data: {
        report,
        recommendations,
        academicLimits,
        context: {
          profile,
          curriculum,
          academicLimits,
          term: db.academicTerms.find((t) => t.id === currentTermId),
          campus: db.campuses.find((c) => c.id === profile.campusId),
          major: db.majors.find((m) => m.id === profile.majorId),
          tracks: db.tracks.filter((t) => t.majorId === profile.majorId),
        },
      },
    });
  } catch {
    // Academic records and implementation details must not be echoed to clients.
    return res.status(500).json({ success: false, error: 'تحلیل دروس به خطا خورد؛ دوباره تلاش کنید.' });
  }
});
