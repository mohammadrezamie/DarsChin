// ============================================================================
// DARSCHYN (درس‌چین) - Course Eligibility Evaluation & Recommendations Routes
// ============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { evaluateStudentEligibility } from '../../src/domain/eligibility-engine';
import { generateCourseRecommendations } from '../../src/domain/recommendation-engine';

export const eligibilityRouter = Router();

// Academic profiles and student evaluations are private, never cache them.
eligibilityRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const evaluateInputSchema = z.object({
  // Keep the current optional payload shape for existing mobile/web clients.
  plannedCourseIds: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
});

// Evaluate student eligibility for current offerings
eligibilityRouter.post('/evaluate', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const input = evaluateInputSchema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ success: false, error: 'درخواست ارزیابی دروس معتبر نیست.' });
    }
    const userId = req.user!.id;
    const plannedCourseIds = input.data.plannedCourseIds ?? [];

    // Get student profile
    const profile = db.studentProfiles.find((p) => p.userId === userId);
    if (!profile) {
      return res.status(400).json({
        success: false,
        error: 'پروفایل تحصیلی دانشجو هنوز تکمیل نشده است. لطفاً ابتدا اطلاعات تحصیلی خود را ثبت نمایید.',
      });
    }

    // Find student's curriculum
    // Never silently substitute another student's curriculum. A published
    // academic chart belongs to one complete campus/degree/major/entry cohort.
    const curricula = db.curricula.filter((c) =>
      c.status === 'active' &&
      c.universityId === profile.universityId &&
      c.campusId === profile.campusId &&
      c.degreeLevelId === profile.degreeLevelId &&
      c.majorId === profile.majorId &&
      c.entryYearId === profile.entryYearId
    );

    if (curricula.length !== 1) {
      return res.status(curricula.length > 1 ? 409 : 400).json({
        success: false,
        error: curricula.length > 1
          ? 'برای پروندهٔ شما چند چارت فعال تعریف شده است؛ ابتدا مدیر باید نسخهٔ معتبر را مشخص کند.'
          : 'برای ترکیب واحد، مقطع، رشته و سال ورود شما چارت فعال و تأییدشده‌ای وجود ندارد.',
      });
    }
    const curriculum = curricula[0];

    // Filter relevant offerings for the term and campus
    const currentTermId = profile.currentTermId || db.academicTerms.find((t) => t.isCurrent)?.id;
    if (!currentTermId || !db.academicTerms.some((term) => term.id === currentTermId)) {
      return res.status(400).json({ success: false, error: 'نیمسال معتبر برای پروندهٔ شما ثبت نشده است.' });
    }
    const relevantOfferings = db.courseOfferings.filter(
      (o) => o.termId === currentTermId && o.campusId === profile.campusId && o.active
    );


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
      passedCourseIds: passedCourses
        .filter((row) => row.status !== 'FAILED' && row.status !== 'ABSENT' &&
          (row.grade === undefined || row.grade >= 10))
        .map((row) => row.courseId),
    });

    // Calculate real-time academic limits & final semester eligibility
    const academicLimits = db.calculateStudentAcademicLimits(userId);

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
    // Never return engine stack, academic record values or filesystem details.
    return res.status(500).json({ success: false, error: 'ارزیابی دروس با خطای داخلی مواجه شد.' });
  }
});
