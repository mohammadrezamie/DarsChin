import { describe, expect, it } from 'vitest';
import { getInitialSeedData } from '../server/db/seed';

describe('demo catalogue identity is internally consistent (not official academic policy)', () => {
  it('includes the demo university used by all demo campuses and curricula', () => {
    const seed = getInitialSeedData();
    const universityIds = new Set(seed.universities.map(x => x.id));
    expect(universityIds.has('univ-azad')).toBe(true);
    expect(seed.campuses.length).toBeGreaterThan(0);
    for (const campus of seed.campuses) {
      expect(universityIds.has(campus.universityId)).toBe(true);
    }
    for (const chart of seed.curricula) {
      expect(universityIds.has(chart.universityId)).toBe(true);
    }
  });

  it('never ships prerequisite targets or group/course references that are absent', () => {
    const seed = getInitialSeedData();
    const courseIds = new Set(seed.courses.map(x => x.id));
    const chartIds = new Set(seed.curricula.map(x => x.id));
    const campusIds = new Set(seed.campuses.map(x => x.id));
    const termIds = new Set(seed.academicTerms.map(x => x.id));
    for (const rule of seed.academicRules) {
      expect(chartIds.has(rule.curriculumId)).toBe(true);
      expect(courseIds.has(rule.targetCourseId)).toBe(true);
    }
    for (const linked of seed.curriculumCourses) {
      expect(chartIds.has(linked.curriculumId)).toBe(true);
      expect(courseIds.has(linked.courseId)).toBe(true);
    }
    for (const offering of seed.courseOfferings) {
      expect(courseIds.has(offering.courseId)).toBe(true);
      expect(campusIds.has(offering.campusId)).toBe(true);
      expect(termIds.has(offering.termId)).toBe(true);
    }
  });
});
