// ============================================================================
// DARSCHYN (درس‌چین) - Rule-Based Transparent Course Recommendation Engine
// ============================================================================

import { extractSourceCourseIds } from '../utils/academic';
import { downstreamCourseIds } from './course-demand';
import {
  Course,
  Curriculum,
  CurriculumCourse,
  AcademicRule,
  CourseEligibilityResult,
  CourseRecommendation,
} from '../types';

export interface RecommendationContext {
  curriculum: Curriculum;
  curriculumCourses: CurriculumCourse[];
  allCourses: Course[];
  academicRules: AcademicRule[];
  eligibilityResults: CourseEligibilityResult[];
  approximateStudentSemester?: number; // e.g. 3
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
  } = context;

  const coursesMap = new Map<string, Course>(allCourses.map((c) => [c.id, c]));
  const currCourseMap = new Map<string, CurriculumCourse>();
  for (const cc of curriculumCourses) {
    if (cc.curriculumId === curriculum.id) {
      currCourseMap.set(cc.courseId, cc);
    }
  }

  // Build dependency graph: courseId -> array of dependent target courseIds
  const dependencyGraph = new Map<string, string[]>();
  for (const rule of academicRules) {
    if (rule.curriculumId === curriculum.id && rule.relationshipType === 'PREREQUISITE') {
      const sourceCourseIds = extractSourceCourseIds(rule.expression);
      for (const sourceId of sourceCourseIds) {
        const dependents = dependencyGraph.get(sourceId) || [];
        if (!dependents.includes(rule.targetCourseId)) {
          dependents.push(rule.targetCourseId);
        }
        dependencyGraph.set(sourceId, dependents);
      }
    }
  }

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

    // Calculate future unlocked courses
    const directDependents = dependencyGraph.get(courseId) || [];
    const unlockedCourseIds = downstreamCourseIds(courseId, curriculum.id, academicRules)
      .filter(id => currCourseMap.has(id) && id !== courseId);
    const unlockedCourseNames = unlockedCourseIds
      .map((id) => coursesMap.get(id)?.name)
      .filter((name): name is string => !!name);

    let score = 50; // base score
    const reasons: string[] = [];

    // 1. Critical path / Unlocked future courses
    if (unlockedCourseIds.length >= 3) {
      score += 25;
      reasons.push(`طبق نمودار پیش‌نیازهای ثبت‌شده، در مسیر ${unlockedCourseIds.length} درس آینده قرار دارد (${directDependents.length} وابستگی مستقیم)`);
    } else if (unlockedCourseIds.length > 0) {
      score += 15;
      reasons.push(`در مسیر پیش‌نیازی ${unlockedCourseIds.length} درس آینده قرار دارد؛ اولویت‌بندی پیشنهادی است، نه مجوز`);
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
      unlockedCourseNames,
      reasons,
      priority,
    });
  }

  // Sort descending by score
  recommendations.sort((a, b) => b.score - a.score);

  return recommendations;
}
