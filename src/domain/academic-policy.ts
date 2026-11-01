import { 
  AcademicPolicySettings, 
  AcademicLimitInfo, 
  StudentAcademicProfile, 
  Course, 
  CurriculumCourse, 
  StudentPassedCourse 
} from '../types';

export function calculateAcademicLimits(
  studentProfile: StudentAcademicProfile,
  allCourses: Course[],
  curriculumCourses: CurriculumCourse[],
  passedCourses: StudentPassedCourse[],
  policySettings: AcademicPolicySettings
): AcademicLimitInfo {
  const isGradeA = (studentProfile.previousTermGpa ?? 0) >= policySettings.gpaBonusThreshold;
  // TODO implement exact final semester detection
  const isFinalSemester = studentProfile.isFinalSemesterOverride === true; 
  const isSummer = studentProfile.currentTermId?.includes('-3') || false; // Usually term 3 is summer

  let normalMinUnits = policySettings.normalMinUnits;
  let normalMaxUnits = isGradeA ? policySettings.gpaBonusMaxUnits : policySettings.normalMaxUnits;

  let effectiveMinUnits = isSummer ? policySettings.summerMinUnits : normalMinUnits;
  let effectiveMaxUnits = isSummer ? policySettings.summerMaxUnits : normalMaxUnits;

  if (isFinalSemester) {
    effectiveMinUnits = 2; // IAU final semester logic
    effectiveMaxUnits = policySettings.finalSemesterMaxUnits;
  }

  // Calculate totals based on curriculum
  const totalCurriculumUnits = curriculumCourses.reduce((acc, cc) => {
    const c = allCourses.find(x => x.id === cc.courseId);
    return acc + (c?.units || 0);
  }, 0);

  const passedUnits = passedCourses
    .filter(p => p.status === 'PASSED')
    .reduce((acc, pc) => {
      const c = allCourses.find(x => x.id === pc.courseId);
      return acc + (c?.units || 0);
    }, 0);

  const remainingUnits = Math.max(0, totalCurriculumUnits - passedUnits);
  
  // Real final semester check logic (IAU)
  let calculatedIsFinalSemester = isFinalSemester;
  if (remainingUnits <= policySettings.finalSemesterThresholdUnits && policySettings.finalSemesterRuleEnabled) {
    calculatedIsFinalSemester = true;
    effectiveMinUnits = 2;
    effectiveMaxUnits = policySettings.finalSemesterMaxUnits;
  }

  return {
    normalMinUnits,
    normalMaxUnits,
    effectiveMinUnits,
    effectiveMaxUnits,
    isFinalSemester: calculatedIsFinalSemester,
    finalSemesterReason: calculatedIsFinalSemester ? (studentProfile.isFinalSemesterOverride ? studentProfile.finalSemesterNotes || 'Override' : 'Remaining units within threshold') : undefined,
    isGradeA,
    isSummer,
    totalCurriculumUnits,
    passedUnits,
    remainingUnits,
    remainingCoursesCount: curriculumCourses.length - passedCourses.filter(p => p.status === 'PASSED').length,
    policySettings,
    majorRequiredPassed: 0,
    majorRequiredRemaining: 0,
    trackRequiredPassed: 0,
    trackRequiredRemaining: 0,
    electivesPassed: 0,
    electivesRemaining: 0
  };
}
