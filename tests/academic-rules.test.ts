import { describe, test, expect } from 'vitest';
import { db } from '../server/db/database';
import { generateCourseRecommendations } from '../src/domain/recommendation-engine';
import { evaluateStudentEligibility } from '../src/domain/eligibility-engine';

describe('Academic Rules Engine - Prerequisite & Corequisite Evaluation', () => {
  test('Evaluate mixed AND/OR prerequisite expression', async () => {
    // 1. Setup mock courses
    const courses = [
      { id: 'c-1', code: 'C1', name: 'Course 1', units: 3, category: 'GENERAL', active: true },
      { id: 'c-2', code: 'C2', name: 'Course 2', units: 3, category: 'GENERAL', active: true },
      { id: 'c-3', code: 'C3', name: 'Course 3', units: 3, category: 'GENERAL', active: true },
      { id: 'c-4', code: 'C4', name: 'Course 4', units: 3, category: 'GENERAL', active: true },
      { id: 'target-1', code: 'T1', name: 'Target 1', units: 3, category: 'GENERAL', active: true },
    ];
    
    // 2. Setup rule: (C1 AND C2) OR (C3 AND C4)
    const expression = {
      type: 'GROUP',
      operator: 'OR',
      operands: [
        {
          type: 'GROUP',
          operator: 'AND',
          operands: [
            { type: 'COURSE', courseId: 'c-1' },
            { type: 'COURSE', courseId: 'c-2' }
          ]
        },
        {
          type: 'GROUP',
          operator: 'AND',
          operands: [
            { type: 'COURSE', courseId: 'c-3' },
            { type: 'COURSE', courseId: 'c-4' }
          ]
        }
      ]
    };

    const academicRules = [{
      id: 'rule-test-1',
      curriculumId: 'curr-1',
      targetCourseId: 'target-1',
      relationshipType: 'PREREQUISITE',
      expression,
    }];

    const curriculum = { id: 'curr-1', name: 'Test Curr', universityId: 'u1', majorId: 'm1' };
    const currCourses = courses.map(c => ({ id: `cc-${c.id}`, curriculumId: 'curr-1', courseId: c.id, classification: 'MAJOR_REQUIRED', active: true }));

    // Case A: Passed C1 and C2 (Should be eligible)
    const passedCoursesA = [
      { id: 'p1', userId: 'user1', courseId: 'c-1', status: 'PASSED', passedAt: '2023' },
      { id: 'p2', userId: 'user1', courseId: 'c-2', status: 'PASSED', passedAt: '2023' },
    ];
    
    const resultA = evaluateStudentEligibility({
      studentProfile: { userId: 'user1', majorId: 'm1' } as any,
      
      curriculum: curriculum as any,
      curriculumCourses: currCourses as any,
      allCourses: courses as any,
      passedCourses: passedCoursesA as any,
      
      currentOfferings: [{ id: 'off-1', courseId: 'target-1', capacity: 10, enrolledCount: 0, active: true }] as any,
      academicRules: academicRules as any,
      tracks: [{id: 't1', majorId: 'm1', name: 'General Track', code: 'T1', active: true}] as any,
      
    });
    
    expect(resultA.results[0].isEligible).toBe(true);

    // Case B: Passed C1 and C3 (Should be INELIGIBLE because neither AND group is fully satisfied)
    const passedCoursesB = [
      { id: 'p1', userId: 'user1', courseId: 'c-1', status: 'PASSED', passedAt: '2023' },
      { id: 'p3', userId: 'user1', courseId: 'c-3', status: 'PASSED', passedAt: '2023' },
    ];
    
    const resultB = evaluateStudentEligibility({
      studentProfile: { userId: 'user1', majorId: 'm1' } as any,
      
      curriculum: curriculum as any,
      curriculumCourses: currCourses as any,
      allCourses: courses as any,
      passedCourses: passedCoursesB as any,
      
      currentOfferings: [{ id: 'off-1', courseId: 'target-1', capacity: 10, enrolledCount: 0, active: true }] as any,
      academicRules: academicRules as any,
      tracks: [{id: 't1', majorId: 'm1', name: 'General Track', code: 'T1', active: true}] as any,
      
    });
    
    console.log(JSON.stringify(resultB.results[0], null, 2));
    expect(resultB.results[0].isEligible).toBe(false);
    expect(resultB.results[0].overallStatus).toBe('BLOCKED_PREREQUISITE');
    
    // Check that missing prerequisites list correctly aggregates both branches when failed
    expect(resultB.results[0].missingPrerequisites.length).toBeGreaterThan(0);
  });
});
