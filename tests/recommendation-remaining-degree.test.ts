import { describe, expect, it } from 'vitest';
import { getInitialSeedData } from '../server/db/seed';
import { generateCourseRecommendations } from '../src/domain/recommendation-engine';
import type { AcademicRule, Course, CourseEligibilityResult, CurriculumCourse } from '../src/types';

const chartId = 'synthetic-full-path-chart';
const ids = ['A','B','C','D','X','Y'];

function context() {
  const seed = getInitialSeedData();
  const curriculum = { ...seed.curricula[0], id: chartId };
  const allCourses: Course[] = ids.map(id => ({
    id, code: id, name: 'درس ' + id, units: 3, category: 'اصلی', active: true,
  }));
  const curriculumCourses: CurriculumCourse[] = ids.map((id,i) => ({
    id: 'cc-' + id, courseId: id, curriculumId: chartId, classification: 'MAJOR_REQUIRED',
    suggestedSemester: i + 1, active: true,
  }));
  const rule = (id: string, source: string, target: string): AcademicRule => ({
    id, curriculumId: chartId, targetCourseId: target,
    relationshipType: 'PREREQUISITE', expression: { type: 'COURSE', courseId: source },
  });
  const academicRules = [
    rule('ab', 'A', 'B'), rule('bc', 'B', 'C'), rule('cd', 'C', 'D'), rule('xy', 'X', 'Y'),
  ];
  const result = (courseId: string): CourseEligibilityResult => ({
    offeringId: 'off-' + courseId, courseId, courseCode: courseId,
    courseName: 'درس ' + courseId, units: 3, category: 'اصلی',
    groupCode: '01', instructor: 'Synthetic instructor',
    dayOfWeek: 'شنبه', startTime: '08:00', endTime: '10:00',
    capacity: 30, enrolledCount: 0,
    overallStatus: 'AVAILABLE', canSelect: true, isEligible: true,
    primaryReason: '', allReasons: [], missingPrerequisites: [], missingCorequisites: [],
  });
  return { curriculum, allCourses, curriculumCourses, academicRules, eligibilityResults: [result('A'), result('X')] };
}

describe('real remaining-degree recommendation priority', () => {
  it('follows the full downstream path, not just the immediately next semester', () => {
    const recs = generateCourseRecommendations({ ...context(), passedCourseIds: [] });
    const gateway = recs.find(r => r.courseId === 'A')!;
    const short = recs.find(r => r.courseId === 'X')!;
    expect(gateway.unlockedFutureCoursesCount).toBe(3);
    expect(gateway.unlockedCourseNames).toEqual(['درس B','درس C','درس D']);
    expect(gateway.score).toBeGreaterThan(short.score);
  });

  it('subtracts truly passed future courses from priority without losing the whole-path chain', () => {
    const recs = generateCourseRecommendations({ ...context(), passedCourseIds: ['B', 'C'] });
    const gateway = recs.find(r => r.courseId === 'A')!;
    expect(gateway.unlockedFutureCoursesCount).toBe(1);
    expect(gateway.unlockedCourseNames).toEqual(['درس D']);
    expect(gateway.reasons.join(' ')).toContain('1 درس آینده');
    expect(gateway.reasons.join(' ')).not.toContain('3 درس آینده');

    const cleared = generateCourseRecommendations({ ...context(), passedCourseIds: ['B','C','D'] })
      .find(r => r.courseId === 'A')!;
    expect(cleared.unlockedFutureCoursesCount).toBe(0);
    expect(cleared.score).toBeLessThan(gateway.score);
  });

  it('does not invent a third-semester student position when no verified semester estimate exists', () => {
    const recs = generateCourseRecommendations({ ...context(), passedCourseIds: [] });
    for (const rec of recs) {
      expect(rec.reasons.join(' ')).not.toContain('دقیقاً متناسب با ترم');
      expect(rec.reasons.join(' ')).not.toContain('عقب‌افتاده از ترم‌های گذشته');
    }
    expect(recs.every(r => r.score >= 0 && r.score <= 100)).toBe(true);
  });
});
