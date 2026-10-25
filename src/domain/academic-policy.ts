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

  // This compatibility helper is not the authoritative DB scope resolver.
  // Still, never infer completed units from duplicate, failed or unrelated
  // transcript rows; never infer a final semester from an empty curriculum.
  const rows=curriculumCourses.filter(cc=>cc.active!==false &&
    (!cc.trackId || (studentProfile.isTrackSelected &&
      cc.trackId===studentProfile.selectedTrackId)));
  const courseIds=new Set(rows.map(cc=>cc.courseId));
  const knownById=new Map(allCourses.map(course=>[course.id,course]));
  const totalCurriculumUnits=[...courseIds].reduce((sum,id)=>
    sum+(knownById.get(id)?.units||0),0);
  const passedIds=new Set(passedCourses.filter(p=>
    p.status!=='FAILED' && p.status!=='ABSENT' &&
    (p.grade===undefined || (Number.isFinite(p.grade) && p.grade>=10)))
    .map(p=>p.courseId));
  const countedPassed=[...courseIds].filter(id=>passedIds.has(id));
  const passedUnits=countedPassed.reduce((sum,id)=>sum+(knownById.get(id)?.units||0),0);
  const remainingUnits=Math.max(0,totalCurriculumUnits-passedUnits);

  let calculatedIsFinalSemester=totalCurriculumUnits>0 && isFinalSemester;
  const hasUnknownTrackRequirements=!studentProfile.isTrackSelected &&
    curriculumCourses.some(cc=>cc.active!==false && !!cc.trackId);
  if(studentProfile.isFinalSemesterOverride===false){
    calculatedIsFinalSemester=false;
  }else if(studentProfile.isFinalSemesterOverride!==true && totalCurriculumUnits>0 &&
    remainingUnits>0 && !hasUnknownTrackRequirements &&
    remainingUnits<=policySettings.finalSemesterThresholdUnits &&
    policySettings.finalSemesterRuleEnabled) {
    calculatedIsFinalSemester=true;
  }
  if(calculatedIsFinalSemester && !isSummer){
    effectiveMinUnits=2;
    effectiveMaxUnits=policySettings.finalSemesterMaxUnits;
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
    remainingCoursesCount: [...courseIds].filter(id=>!passedIds.has(id)).length,
    policySettings,
    majorRequiredPassed: 0,
    majorRequiredRemaining: 0,
    trackRequiredPassed: 0,
    trackRequiredRemaining: 0,
    electivesPassed: 0,
    electivesRemaining: 0
  };
}
