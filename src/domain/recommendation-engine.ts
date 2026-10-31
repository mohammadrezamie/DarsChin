// ============================================================================
// DARSCHYN (درس‌چین) - Rule-Based Transparent Course Recommendation Engine
// ============================================================================

import { analyzeCurriculumDependencies } from './course-dependency-insights';
import { analyzeRemainingGraduationPaths } from './remaining-graduation-path';
import {
  Course,
  Curriculum,
  CurriculumCourse,
  AcademicRule,
  CourseEligibilityResult,
  CourseRecommendation,
  StudentAcademicProfile,
} from '../types';

export interface RecommendationContext {
  curriculum: Curriculum;
  curriculumCourses: CurriculumCourse[];
  allCourses: Course[];
  academicRules: AcademicRule[];
  eligibilityResults: CourseEligibilityResult[];
  approximateStudentSemester?: number; // set only when actually known
  /** Genuine completed courses from this student's transcript, not a guessed term. */
  completedCourseIds?: readonly string[];
  studentProfile?: Pick<StudentAcademicProfile,
    'majorId' | 'entryYearId' | 'isTrackSelected' | 'selectedTrackId' | 'desiredTrackIds'>;
}

/**
 * Generates transparent, scored recommendations for eligible courses.
 */
export function generateCourseRecommendations(
  context: RecommendationContext
): CourseRecommendation[] {
  const {
    curriculum,
    curriculumCourses,
    allCourses,
    academicRules,
    eligibilityResults,
    approximateStudentSemester,
    completedCourseIds = [],
    studentProfile,
  } = context;

  const relevantTrackIds = new Set(studentProfile
    ? studentProfile.isTrackSelected
      ? (studentProfile.selectedTrackId ? [studentProfile.selectedTrackId] : [])
      : (studentProfile.desiredTrackIds || [])
    : []);
  const scopedRules = academicRules.filter(rule =>
    rule.curriculumId === curriculum.id &&
    (!studentProfile || (
      (!rule.majorId || rule.majorId === studentProfile.majorId) &&
      (!rule.entryYearId || rule.entryYearId === studentProfile.entryYearId) &&
      (!rule.trackId || relevantTrackIds.has(rule.trackId))
    ))
  );

  const coursesMap = new Map<string, Course>(allCourses.map((c) => [c.id, c]));
  const currCourseMap = new Map<string, CurriculumCourse>();
  for (const cc of curriculumCourses) {
    if (cc.curriculumId === curriculum.id && cc.active !== false &&
        (!studentProfile || !cc.trackId || relevantTrackIds.has(cc.trackId))) {
      currCourseMap.set(cc.courseId, cc);
    }
  }

  // Reuse the SAME full-curriculum DAG analysis as the private admin map.
  // No term+1 truncation; OR branches remain possible paths, not a promise.
  const chartGraph = analyzeCurriculumDependencies(curriculum.id, [...currCourseMap.keys()], scopedRules);
  const insightsByCourse = new Map(
    chartGraph.valid ? chartGraph.insights.map(item => [item.courseId, item] as const) : [],
  );
  const completed = new Set(completedCourseIds);
  const prerequisiteEdges = chartGraph.valid
    ? chartGraph.edges.filter(edge => edge.kind === 'PREREQUISITE') : [];
  const remainingPaths = analyzeRemainingGraduationPaths(chartGraph, completed);

  // Filter only eligible courses (strictly canSelect === true and overallStatus === 'AVAILABLE')
  const eligibleResults = eligibilityResults.filter(
    (r) => r.canSelect && r.isEligible && r.overallStatus === 'AVAILABLE'
  );

  // Avoid duplicate course cards if multiple groups exist
  const uniqueCourseMap = new Map<string, CourseEligibilityResult>();
  for (const res of eligibleResults) {
    if (!uniqueCourseMap.has(res.courseId)) {
      uniqueCourseMap.set(res.courseId, res);
    }
  }

  const recommendations: CourseRecommendation[] = [];

  for (const [courseId, res] of uniqueCourseMap.entries()) {
    const course = coursesMap.get(courseId);
    const currCourse = currCourseMap.get(courseId);
    if (!course) continue;

    const suggestedSem = currCourse?.suggestedSemester || res.suggestedSemester || 1;
    const classification = currCourse ? currCourse.classification : res.classification;
    const isRequired = classification === 'MAJOR_REQUIRED' || classification === 'TRACK_REQUIRED';

    // Compute ALL downstream courses in this student's scoped curriculum.
    // Already-passed courses may remain links in the chain, but are not future
    // academic work and must not inflate the count.
    const insight = insightsByCourse.get(courseId);
    const remainingPath = remainingPaths.get(courseId);
    const mandatoryFutureIds = remainingPath?.noChoiceFutureCourseIds ?? [];
    const choiceOnlyFutureIds = remainingPath?.choiceOnlyFutureCourseIds ?? [];
    // Keep the existing public total for backwards compatibility, but do NOT
    // score the optional OR-only descendants like compulsory bottlenecks.
    const unlockedCourseIds = [...mandatoryFutureIds, ...choiceOnlyFutureIds].sort();
    const unlockedCourseNames = unlockedCourseIds
      .map(id => coursesMap.get(id)?.name).filter((name): name is string => !!name);
    const directDependents = prerequisiteEdges.filter(edge => edge.from === courseId &&
      !completed.has(edge.to) && currCourseMap.has(edge.to));
    const mandatoryRequiredCount = mandatoryFutureIds.filter(id => {
      const category = currCourseMap.get(id)?.classification;
      return category === 'MAJOR_REQUIRED' || category === 'TRACK_REQUIRED';
    }).length;

    let score = 50; // relative planning preference, NOT authorization
    const reasons: string[] = [];

    // Structural impact increases with both unique reachable courses and the
    // longest path. Diamond descendants count once. The previous flat +25
    // bonus for every 3+ descendants hid genuine multi-semester bottlenecks.
    if (unlockedCourseIds.length > 0) {
      const depth = insight?.longestChain ?? 0;
      const remainingDepth = remainingPath?.longestRemainingChain ?? 0;
      const noChoiceDepth = remainingPath?.longestNoChoiceRemainingChain ?? 0;
      const mandatoryBonus = mandatoryFutureIds.length
        ? 15 + 4 * (mandatoryFutureIds.length - 1) + 3 * Math.max(0, noChoiceDepth - 1)
        : 0;
      // OR paths might be satisfied by a different course, so they get only
      // small informational weight, never the full structural urgency bonus.
      const choiceBonus = Math.min(mandatoryFutureIds.length ? 6 : 12,
        choiceOnlyFutureIds.length * 3 + (mandatoryFutureIds.length ? 0 : Math.max(0, remainingDepth - 1)));
      const bonus = Math.min(35, mandatoryBonus + choiceBonus + Math.min(4, mandatoryRequiredCount * 2));
      score += bonus;
      reasons.push(`در زنجیرهٔ چارت تا انتهای دوره، ${unlockedCourseIds.length.toLocaleString('fa-IR')} درس باقیمانده در مسیر این درس است؛ ${directDependents.length.toLocaleString('fa-IR')} ارتباط مستقیم، عمق ${depth.toLocaleString('fa-IR')} (ساختاری) و ${remainingDepth.toLocaleString('fa-IR')} گام باقیمانده`);
      if (mandatoryFutureIds.length > 0) {
        reasons.push(`${mandatoryFutureIds.length.toLocaleString('fa-IR')} درس در مسیرهای بدون شرط «یا» و ${mandatoryRequiredCount.toLocaleString('fa-IR')} مورد از آن‌ها در گروه دروس الزامی چارت هستند؛ این اعداد مجوز اخذ قطعی نیستند.`);
      }
      if (choiceOnlyFutureIds.length > 0) {
        reasons.push(`${choiceOnlyFutureIds.length.toLocaleString('fa-IR')} درس فقط از مسیرهای دارای شرط «یا» قابل دستیابی است؛ این مسیرها اختیاری/احتمالی‌اند و الزام قطعی نیستند.`);
      }
    } else if (!chartGraph.valid) {
      reasons.push('تحلیل اهمیت زنجیره‌ای به دلیل ناسازگاری قواعد چارت معتبر نیست؛ نیازمند بررسی مدیر.');
    }

    // 2. Required vs Elective
    if (isRequired) {
      score += 15;
      reasons.push('درس الزامی و تخصصی چارت تحصیلی');
    } else {
      score += 5;
      reasons.push('درس اختیاری / عمومی');
    }

    // 3. Semester Alignment
    // Only award semester alignment points when the student's actual semester
    // has been supplied. A default "third semester" invents personalization.
    if (typeof approximateStudentSemester === 'number' &&
        Number.isInteger(approximateStudentSemester) && approximateStudentSemester > 0) {
      const semDifference = Math.abs(suggestedSem - approximateStudentSemester);
      if (semDifference === 0) {
        score += 15;
        reasons.push(`مطابق ترم ${suggestedSem} در دادهٔ پروندهٔ تحصیلی`);
      } else if (suggestedSem < approximateStudentSemester) {
        score += 10;
        reasons.push(`درس پیشنهادی برای ترم ${suggestedSem} در چارت؛ از ترم فعلی عقب‌تر است`);
      } else {
        score += 2;
      }
    }

    // Determine Priority Tag
    let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (score >= 80) {
      priority = 'HIGH';
    } else if (score < 60) {
      priority = 'LOW';
    }

    recommendations.push({
      courseId: course.id,
      offeringId: res.offeringId,
      courseCode: course.code,
      courseName: course.name,
      units: course.units,
      category: res.category,
      score: Math.min(score, 100),
      suggestedSemester: suggestedSem,
      unlockedFutureCoursesCount: unlockedCourseIds.length,
      noChoiceFutureCoursesCount: mandatoryFutureIds.length,
      choiceOnlyFutureCoursesCount: choiceOnlyFutureIds.length,
      longestRemainingPrerequisiteChain: remainingPath?.longestRemainingChain ?? 0,
      longestNoChoiceRemainingChain: remainingPath?.longestNoChoiceRemainingChain ?? 0,
      longestPrerequisiteChain: insight?.longestChain ?? 0,
      unlockedCourseNames,
      reasons,
      priority,
    });
  }

  // Sort descending by score
  // Scores cap at 100: keep the deeper and wider graduation bottleneck first
  // even when two equally required courses both reach that cap.
  recommendations.sort((a, b) =>
    b.score - a.score ||
    (b.noChoiceFutureCoursesCount ?? 0) - (a.noChoiceFutureCoursesCount ?? 0) ||
    (b.longestNoChoiceRemainingChain ?? 0) - (a.longestNoChoiceRemainingChain ?? 0) ||
    b.unlockedFutureCoursesCount - a.unlockedFutureCoursesCount ||
    (b.longestPrerequisiteChain ?? 0) - (a.longestPrerequisiteChain ?? 0) ||
    a.courseId.localeCompare(b.courseId));

  return recommendations;
}
