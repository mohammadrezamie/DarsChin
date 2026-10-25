import { describe, test, expect, beforeAll } from 'vitest';
import { evaluateStudentEligibility } from '../src/domain/eligibility-engine';
import { calculateAcademicLimits } from '../src/domain/academic-policy';
import { Course, StudentAcademicProfile, CurriculumCourse, StudentPassedCourse, CourseOffering, AcademicPolicySettings, AcademicRule } from '../src/types';

describe('IAU Academic Policy & Rules Engine', () => {
  

    const curriculumCourses: CurriculumCourse[] = [
    { id: 'cc1', curriculumId: 'curr1', courseId: 'math1', classification: 'MAJOR_REQUIRED', termCode: 1 },
    { id: 'cc2', curriculumId: 'curr1', courseId: 'math2', classification: 'MAJOR_REQUIRED', termCode: 2 },
    { id: 'cc3', curriculumId: 'curr1', courseId: 'physics1', classification: 'MAJOR_REQUIRED', termCode: 1 },
    { id: 'cc4', curriculumId: 'curr1', courseId: 'extra1', classification: 'MAJOR_ELECTIVE', termCode: 3 },
    { id: 'cc5', curriculumId: 'curr1', courseId: 'project', classification: 'MAJOR_REQUIRED', termCode: 8 },
    // Fill up to 30 units
    ...Array.from({ length: 10 }).map((_, i) => ({ id: `cfill${i}`, curriculumId: 'curr1', courseId: `dummy${i}`, classification: 'MAJOR_REQUIRED', termCode: 4 } as any))
  ];
  
  const allCourses: Course[] = [
    { id: 'math1', code: 'M1', name: 'Math 1', units: 3, category: 'پایه', active: true },
    { id: 'math2', code: 'M2', name: 'Math 2', units: 3, category: 'پایه', active: true },
    { id: 'physics1', code: 'P1', name: 'Physics 1', units: 3, category: 'پایه', active: true },
    { id: 'extra1', code: 'E1', name: 'وصایای امام', units: 2, category: 'عمومی', active: true, isExtraUnit: true },
    { id: 'project', code: 'PROJ', name: 'پروژه', units: 3, category: 'تخصصی', active: true },
    ...Array.from({ length: 10 }).map((_, i) => ({ id: `dummy${i}`, code: `D${i}`, name: `Dummy ${i}`, units: 3, category: 'تخصصی', active: true } as any))
  ];


  const rules: AcademicRule[] = [
    {
      id: 'r1', curriculumId: 'curr1', targetCourseId: 'math2', relationshipType: 'PREREQUISITE',
      expression: { type: 'COURSE', courseId: 'math1' },
      
    }
  ];

  const profileTemplate: StudentAcademicProfile = {
    userId: 'u1', universityId: 'univ1', campusId: 'camp1', degreeLevelId: 'd1', majorId: 'm1', entryYearId: 'e1',
    isTrackSelected: false, desiredTrackIds: [], updatedAt: ''
  };

  const curriculum: any = { id: 'curr1' };

  const offerings: CourseOffering[] = [
    { id: 'off-m2', courseId: 'math2', termId: 't1', groupCode: '01', dayOfWeek: 'شنبه', startTime: '08:00', endTime: '10:00', capacity: 30, enrolledCount: 0, instructor: 'Dr. Test', active: true, source: 'manual', campusId: 'camp1' }
  ];

  test('Missing prerequisite keeps dependent locked', () => {
    const passedCourses: StudentPassedCourse[] = [];
    const res = evaluateStudentEligibility({
      studentProfile: profileTemplate, curriculum, curriculumCourses, allCourses, tracks: [],
      academicRules: rules, passedCourses, currentOfferings: offerings
    });
    
    console.log(JSON.stringify(res.results[0], null, 2));
    expect(res.results[0].overallStatus).toBe('BLOCKED_PREREQUISITE');
    expect(res.results[0].isEligible).toBe(false);
  });

  test('Passed prerequisite unlocks dependent', () => {
    const passedCourses: StudentPassedCourse[] = [
      { id: 'p1', userId: 'u1', courseId: 'math1', status: 'PASSED', passedAt: '' }
    ];
    const res = evaluateStudentEligibility({
      studentProfile: profileTemplate, curriculum, curriculumCourses, allCourses, tracks: [],
      academicRules: rules, passedCourses, currentOfferings: offerings
    });
    
    expect(res.results[0].overallStatus).toBe('AVAILABLE');
    expect(res.results[0].isEligible).toBe(true);
  });

  test('Failed prerequisite (grade < 10) triggers IAU same-term exception (conditionally allowed if selected)', () => {
    const passedCourses: StudentPassedCourse[] = [
      { id: 'p1', userId: 'u1', courseId: 'math1', status: 'FAILED', grade: 9, passedAt: '' }
    ];
    // If we evaluate without planning it in the same term, it is still locked (missing corequisite essentially).
    const res = evaluateStudentEligibility({
      studentProfile: profileTemplate, curriculum, curriculumCourses, allCourses, tracks: [],
      academicRules: rules, passedCourses, currentOfferings: offerings
    });
    
    expect(res.results[0].overallStatus).toBe('BLOCKED_PREREQUISITE');
    expect(res.results[0].allReasons[0]).toContain('قبلاً مردود شده');
    
    // Now if they select both in same term
    const resBoth = evaluateStudentEligibility({
      studentProfile: profileTemplate, curriculum, curriculumCourses, allCourses, tracks: [],
      academicRules: rules, passedCourses, currentOfferings: offerings, plannedOfferingIdsInSameTerm: ['math1']
    });
    
    expect(resBoth.results[0].overallStatus).toBe('AVAILABLE');
    expect(resBoth.results[0].isEligible).toBe(true);
  });

  test('Final semester ignores prerequisites', () => {
    const passedCourses: StudentPassedCourse[] = [];
    // Student is overriding to final semester
    const finalProfile = { ...profileTemplate, isFinalSemesterOverride: true };
    const res = evaluateStudentEligibility({
      studentProfile: finalProfile, curriculum, curriculumCourses, allCourses, tracks: [],
      academicRules: rules, passedCourses, currentOfferings: offerings
    });
    
    // Prerequisite for Math 2 is Math 1, but we are in final semester so it's ignored!
    expect(res.results[0].overallStatus).toBe('AVAILABLE');
  });

  test('Calculate Academic Limits (Normal, Grade A, Final Semester, Extra Units)', () => {
    const settings: AcademicPolicySettings = {
      normalMinUnits: 12, normalMaxUnits: 20, gpaBonusThreshold: 17, gpaBonusMaxUnits: 24,
      summerMinUnits: 1, summerMaxUnits: 8, finalSemesterMaxUnits: 24, finalSemesterThresholdUnits: 24, finalSemesterRuleEnabled: true
    };
    
    // Normal student
    const resNormal = calculateAcademicLimits(profileTemplate, allCourses, curriculumCourses, [], settings);
    expect(resNormal.effectiveMinUnits).toBe(12);
    expect(resNormal.effectiveMaxUnits).toBe(20);

    // Al-Student (GPA >= 17)
    const alProfile = { ...profileTemplate, previousTermGpa: 17.5 };
    const resAl = calculateAcademicLimits(alProfile, allCourses, curriculumCourses, [], settings);
    expect(resAl.effectiveMinUnits).toBe(12);
    expect(resAl.effectiveMaxUnits).toBe(24); // Gets 24

    // Final Semester
    const resFinal = calculateAcademicLimits({ ...profileTemplate, isFinalSemesterOverride: true }, allCourses, curriculumCourses, [], settings);
    expect(resFinal.effectiveMinUnits).toBe(2);
    expect(resFinal.effectiveMaxUnits).toBe(24);
  });
  test('credit threshold only counts unique truly passed units, not failed or duplicate courses', () => {
    const thresholdRule: AcademicRule = {
      id:'test-units',curriculumId:'curr1',targetCourseId:'math2',
      relationshipType:'PREREQUISITE',expression:{type:'MIN_PASSED_UNITS',minUnits:6},
    };
    const onePass: StudentPassedCourse[] = [
      {id:'passed-physics',userId:'u1',courseId:'physics1',status:'PASSED',grade:15,passedAt:''},
      {id:'duplicate-physics',userId:'u1',courseId:'physics1',status:'PASSED',grade:15,passedAt:''},
      {id:'failed-math',userId:'u1',courseId:'math1',status:'FAILED',grade:8,passedAt:''},
    ];
    const data = (passed: StudentPassedCourse[]) => evaluateStudentEligibility({
      studentProfile:profileTemplate,curriculum,curriculumCourses,allCourses,
      tracks:[],academicRules:[thresholdRule],passedCourses:passed,currentOfferings:offerings,
    }).results[0];
    const blocked=data(onePass);
    expect(blocked.overallStatus).toBe('BLOCKED_PREREQUISITE');
    expect(blocked.allReasons.join(' ')).toContain('حداقل 6 واحد');
    const allowed=data([...onePass,{id:'passed-math',userId:'u1',courseId:'math1',
      status:'PASSED',grade:18,passedAt:''}]);
    expect(allowed.overallStatus).toBe('AVAILABLE');
  });

});
