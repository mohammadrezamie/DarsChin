import { describe, it, expect } from 'vitest';
import { evaluateStudentEligibility } from '../src/domain/eligibility-engine';
import { getInitialSeedData } from '../server/db/seed';
import type { StudentAcademicProfile } from '../src/types';

describe('eligibility engine with isolated synthetic academic fixtures', () => {
  it('evaluates the seeded catalog without assuming any real student account exists', () => {
    const data = getInitialSeedData();
    const curriculum = data.curricula[0];
    expect(curriculum).toBeDefined();
    const profile: StudentAcademicProfile = {
      userId: 'synthetic-engine-student',
      universityId: curriculum.universityId,
      campusId: curriculum.campusId,
      degreeLevelId: curriculum.degreeLevelId,
      majorId: curriculum.majorId,
      entryYearId: curriculum.entryYearId,
      isTrackSelected: false,
      desiredTrackIds: [],
      updatedAt: new Date().toISOString(),
    };

    const result = evaluateStudentEligibility({
      studentProfile: profile,
      curriculum,
      curriculumCourses: data.curriculumCourses.filter(cc => cc.curriculumId === curriculum.id),
      allCourses: data.courses,
      tracks: data.tracks,
      academicRules: data.academicRules.filter(rule => rule.curriculumId === curriculum.id),
      passedCourses: [],
      currentOfferings: data.courseOfferings,
    });

    expect(result.totalOfferingsEvaluated).toBeGreaterThan(0);
    expect(result.eligibleCount + result.blockedCount + result.alreadyPassedCount)
      .toBeGreaterThanOrEqual(result.totalOfferingsEvaluated);
  });
});
