import { calculateAcademicLimits } from './academic-policy';
// ============================================================================
// DARSCHYN (درس‌چین) - Core Eligibility Engine (Deterministic Rule-Based)
// ============================================================================

import {
  Course,
  Curriculum,
  CurriculumCourse,
  AcademicRule,
  
  CourseOffering,
  StudentAcademicProfile,
  StudentPassedCourse,
  Track,
  EligibilityStatus,
  CourseEligibilityResult,
  TrackEligibilityBreakdown,
  EligibilityEvaluationReport,
} from '../types';

export interface EligibilityContext {
  studentProfile: StudentAcademicProfile;
  curriculum: Curriculum;
  curriculumCourses: CurriculumCourse[];
  allCourses: Course[];
  tracks: Track[];
  academicRules: AcademicRule[];
  
  passedCourses: StudentPassedCourse[];
  currentOfferings: CourseOffering[];
  plannedOfferingIdsInSameTerm?: string[]; // Course IDs or offering IDs student has picked for current term
}

/**
 * Evaluates the full academic eligibility of course offerings for a student.
 * Single source of truth for all eligibility calculations.
 */
export function evaluateStudentEligibility(
  context: EligibilityContext
): EligibilityEvaluationReport {
  const {
    studentProfile,
    curriculum,
    curriculumCourses,
    allCourses,
    tracks,
    academicRules,
    passedCourses,
    currentOfferings,
    plannedOfferingIdsInSameTerm = [],
  } = context;

  // Filter passed courses: only status PASSED or grade >= 10 count. Failed/Absent do NOT count.
  const passedCourseIdsSet = new Set(
    passedCourses
      .filter((pc) => {
        if (pc.status === 'FAILED' || pc.status === 'ABSENT') return false;
        if (pc.grade !== undefined && pc.grade < 10) return false;
        return true;
      })
      .map((pc) => pc.courseId)
  );

  const coursesMap = new Map<string, Course>(allCourses.map((c) => [c.id, c]));
  // Only unique, successfully completed catalogued courses count. A course cannot
  // be counted twice if the student's transcript has repeated/duplicate entries.
  const passedUnitCount = [...passedCourseIdsSet].reduce((total, id) => {
    const units = coursesMap.get(id)?.units;
    return total + (typeof units === 'number' && Number.isFinite(units) && units > 0 ? units : 0);
  }, 0);
  const tracksMap = new Map<string, Track>(tracks.map((t) => [t.id, t]));

  // Resolve planned course IDs from either course IDs or offering IDs in the current semester
  const plannedCourseIdsSet = new Set<string>();
  for (const id of plannedOfferingIdsInSameTerm) {
    plannedCourseIdsSet.add(id); // might be a direct course ID
    const matchedOffering = currentOfferings.find((o) => o.id === id);
    if (matchedOffering) {
      plannedCourseIdsSet.add(matchedOffering.courseId);
    }
  }

  // Find curriculum courses
  const curriculumCourseMap = new Map<string, CurriculumCourse[]>();
  for (const cc of curriculumCourses) {
    if (cc.curriculumId === curriculum.id) {
      const existing = curriculumCourseMap.get(cc.courseId) || [];
      existing.push(cc);
      curriculumCourseMap.set(cc.courseId, existing);
    }
  }

  // Determine active track context
  const isTrackOfficiallySelected = studentProfile.isTrackSelected && !!studentProfile.selectedTrackId;
  let targetTrackIds: string[] = isTrackOfficiallySelected
    ? [studentProfile.selectedTrackId!]
    : studentProfile.desiredTrackIds && studentProfile.desiredTrackIds.length > 0
    ? studentProfile.desiredTrackIds
    : tracks.filter((t) => t.majorId === studentProfile.majorId).map((t) => t.id);
  
  if (targetTrackIds.length === 0) {
    targetTrackIds = ['generic'];
  }

  const results: CourseEligibilityResult[] = [];
  let eligibleCount = 0;
  let blockedCount = 0;
  let alreadyPassedCount = 0;
  let needsReviewCount = 0;

  for (const offering of currentOfferings) {
    const course = coursesMap.get(offering.courseId);
    if (!course) {
      results.push({
        offeringId: offering.id,
        courseId: offering.courseId,
        courseCode: offering.rawCourseCode || 'نامشخص',
        rawCourseCode: offering.rawCourseCode,
        courseName: offering.rawCourseName || 'درس تعریف نشده',
        units: 0,
        category: 'سایر',
        groupCode: offering.groupCode,
        instructor: offering.instructor,
        dayOfWeek: offering.dayOfWeek,
        startTime: offering.startTime,
        endTime: offering.endTime,
        capacity: offering.capacity,
        enrolledCount: offering.enrolledCount,
        enrolledCountKnown: offering.enrolledCountKnown,
        examDate: offering.examDate,
        overallStatus: 'NEEDS_REVIEW',
        isEligible: false,
        canSelect: false,
        primaryReason: 'شناسه این درس در پایگاه داده دروس تعریف نشده است.',
        allReasons: ['شناسه این درس در پایگاه داده دروس تعریف نشده است.'],
        missingPrerequisites: [],
        missingCorequisites: [],
      });
      needsReviewCount++;
      continue;
    }

    // 1. Check if already passed
    if (passedCourseIdsSet.has(course.id)) {
      results.push({
        offeringId: offering.id,
        courseId: course.id,
        courseCode: course.code,
        rawCourseCode: offering.rawCourseCode,
        courseName: course.name,
        units: course.units,
        isExtraUnit: course.isExtraUnit === true,
      
        category: course.category,
        groupCode: offering.groupCode,
        instructor: offering.instructor,
        dayOfWeek: offering.dayOfWeek,
        startTime: offering.startTime,
        endTime: offering.endTime,
        capacity: offering.capacity,
        enrolledCount: offering.enrolledCount,
        enrolledCountKnown: offering.enrolledCountKnown,
        examDate: offering.examDate,
        overallStatus: 'ALREADY_PASSED',
        isEligible: false,
        canSelect: false,
        primaryReason: 'شما قبلاً این درس را با موفقیت گذرانده‌اید و نیازی به اخذ مجدد آن نیست.',
        allReasons: ['درس قبلاً با نمره قبولی پاس شده است.'],
        missingPrerequisites: [],
        missingCorequisites: [],
      });
      alreadyPassedCount++;
      continue;
    }

    // 2. Check if course belongs to curriculum
    const currCourseEntries = curriculumCourseMap.get(course.id);
    if (!currCourseEntries || currCourseEntries.length === 0) {
      results.push({
        offeringId: offering.id,
        courseId: course.id,
        courseCode: course.code,
        rawCourseCode: offering.rawCourseCode,
        courseName: course.name,
        units: course.units,
        isExtraUnit: course.isExtraUnit === true,
        category: course.category,
        groupCode: offering.groupCode,
        instructor: offering.instructor,
        dayOfWeek: offering.dayOfWeek,
        startTime: offering.startTime,
        endTime: offering.endTime,
        capacity: offering.capacity,
        enrolledCount: offering.enrolledCount,
        enrolledCountKnown: offering.enrolledCountKnown,
        examDate: offering.examDate,
        overallStatus: 'NOT_IN_CURRICULUM',
        isEligible: false,
        canSelect: false,
        primaryReason: `این درس در چارت مصوب رشته و سال ورود شما تعریف نشده است.`,
        allReasons: [`درس متعلق به چارت تحصیلی ${curriculum.name} نیست.`],
        missingPrerequisites: [],
        missingCorequisites: [],
      });
      blockedCount++;
      continue;
    }

    // 3. Multi-track breakdown evaluation
    const trackBreakdowns: TrackEligibilityBreakdown[] = [];

    for (const trackId of targetTrackIds) {
      const trackObj = tracksMap.get(trackId);
      const trackName = trackObj ? trackObj.name : 'گرایش عمومی';

      // Check if course is valid for this track
      const validForTrack = currCourseEntries.some(
        (cce) => cce.trackId === null || cce.trackId === undefined || cce.trackId === trackId
      );

      if (!validForTrack) {
        trackBreakdowns.push({
          trackId,
          trackName,
          status: 'NOT_IN_CURRICULUM',
          isEligible: false,
          reasons: [`این درس در گرایش «${trackName}» ارائه نمی‌شود.`],
          missingPrerequisites: [],
          missingCorequisites: [],
        });
        continue;
      }

      // Check Prerequisites for this track
      // Fetch rules for this track/course
      const applicableRules = academicRules.filter(
        (r) =>
          r.curriculumId === curriculum.id &&
          r.targetCourseId === course.id &&
          (r.trackId === null || r.trackId === undefined || r.trackId === trackId)
      );

      
      const missingPrereqs: Array<{ id: string; name: string; code: string }> = [];
      const prereqReasons: string[] = [];
      const missingCoreqs: Array<{ id: string; name: string; code: string }> = [];
      const coreqReasons: string[] = [];

      // Helper to evaluate an AcademicRuleNode
      const evaluateRuleNode = (
        node: any,
        isCorequisite: boolean,
        isContextualRetake: boolean
      ): { passed: boolean; missing: Array<{ id: string; name: string; code: string }>; reasons: string[] } => {
        if (!node) return { passed: false, missing: [], reasons: ['شرط تحصیلی تعریف نشده؛ بررسی مدیر گروه لازم است.'] };
        if (node.type === 'MIN_PASSED_UNITS') {
          const minimum = node.minUnits;
          if (!Number.isInteger(minimum) || minimum <= 0) {
            return { passed: false, missing: [], reasons: ['حداقل واحد گذرانده‌شده در قانون معتبر نیست.'] };
          }
          return passedUnitCount >= minimum
            ? { passed: true, missing: [], reasons: [] }
            : { passed: false, missing: [], reasons: [
              `برای «${course.name}» حداقل ${minimum} واحد گذرانده‌شده لازم است؛ ${passedUnitCount} واحد معتبر در پرونده ثبت شده است.`
            ] };
        }
        if (node.type === 'COURSE') {
          const reqCourse = coursesMap.get(node.courseId);
          if (!reqCourse) return { passed: false, missing: [], reasons: ['درسِ شرط در چارت شناسایی نشد؛ بررسی مدیر گروه لازم است.'] };

          const isPassed = passedCourseIdsSet.has(reqCourse.id);
          const isPlannedInSameTerm = plannedCourseIdsSet.has(reqCourse.id);
          const wasFailed = passedCourses.some(p => p.courseId === reqCourse.id && (p.status === 'FAILED' || (p.grade !== undefined && p.grade < 10)));

          // Final Semester Rule Bypass
          const { isFinalSemester } = calculateAcademicLimits(
            studentProfile,
            allCourses,
            curriculumCourses,
            passedCourses,
            { finalSemesterRuleEnabled: true, finalSemesterThresholdUnits: 24, normalMinUnits: 12, normalMaxUnits: 20, gpaBonusThreshold: 17, gpaBonusMaxUnits: 24, summerMinUnits: 1, summerMaxUnits: 8, finalSemesterMaxUnits: 24 } as any
          );
          if (isFinalSemester) {
             return { passed: true, missing: [], reasons: [] };
          }

          if (isCorequisite) {
            // Corequisite logic
            if (isPassed || isPlannedInSameTerm) return { passed: true, missing: [], reasons: [] };
            return { passed: false, missing: [{ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code }], reasons: [`برای اخذ درس ${course.name}، درس «${reqCourse.name}» باید در همین ترم اخذ شود یا قبلاً پاس شده باشد.`] };
          }
          
          if (isContextualRetake || wasFailed) {
            // IAU Failed Prerequisite Exception (acts as corequisite)
            if (isPassed || isPlannedInSameTerm) return { passed: true, missing: [], reasons: [] };
            return {
              passed: false,
              missing: [{ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code }],
              reasons: [`برای درس ${course.name}، چون پیش‌نیاز (${reqCourse.name}) قبلاً مردود شده، مجاز به اخذ همزمان می‌باشید اما در برنامه شما انتخاب نشده است.`],
            };
          }

          console.log('Eval:', {courseId: reqCourse.id, isPassed, isFinalSemester, wasFailed, isContextualRetake, isCorequisite}); // Normal Prerequisite
          if (isPassed) return { passed: true, missing: [], reasons: [] };
          return {
            passed: false,
            missing: [{ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code }],
            reasons: [`برای اخذ درس ${course.name}، درس «${reqCourse.name}» باید قبلاً پاس شده باشد.`],
          };
        } else if (node.type === 'GROUP') {
          if (!node.operands || node.operands.length === 0) return { passed: true, missing: [], reasons: [] };
          
          if (node.operator === 'OR') {
            const results = node.operands.map((op: any) => evaluateRuleNode(op, isCorequisite, isContextualRetake));
            if (results.some((r: any) => r.passed)) return { passed: true, missing: [], reasons: [] };
            
            // If failed OR, combine all missing
            const allMissing = results.flatMap((r: any) => r.missing);
            return {
              passed: false,
              missing: allMissing,
              reasons: [`حداقل یکی از شروط زیر باید برآورده شود: (${results.map((r: any) => r.reasons.join(' و ')).join(' یا ')})`],
            };
          } else {
            // AND
            const results = node.operands.map((op: any) => evaluateRuleNode(op, isCorequisite, isContextualRetake));
            const failedResults = results.filter((r: any) => !r.passed);
            if (failedResults.length === 0) return { passed: true, missing: [], reasons: [] };
            
            return {
              passed: false,
              missing: failedResults.flatMap((r: any) => r.missing),
              reasons: failedResults.flatMap((r: any) => r.reasons),
            };
          }
        }
        return { passed: false, missing: [], reasons: ['نوع شرط آموزشی ناشناخته است؛ بررسی مدیر گروه لازم است.'] };
      };

      for (const rule of applicableRules) {
        const isCoreq = rule.relationshipType === 'COREQUISITE';
        const isRetake = rule.relationshipType === 'CONTEXTUAL_RETAKE_RULE';
        const res = evaluateRuleNode(rule.expression, isCoreq, isRetake);
        
        if (!res.passed) {
          if (isCoreq || (isRetake && res.reasons[0]?.includes('همین ترم'))) {
            missingCoreqs.push(...res.missing);
            coreqReasons.push(...res.reasons);
          } else {
            missingPrereqs.push(...res.missing);
            prereqReasons.push(...res.reasons);
          }
        }
      }

      // Track Status Decision
      let trackStatus: EligibilityStatus = 'AVAILABLE';
      const allTrackReasons: string[] = [];

      if (prereqReasons.length > 0) {
        trackStatus = 'BLOCKED_PREREQUISITE';
        allTrackReasons.push(...prereqReasons);
      } else if (coreqReasons.length > 0) {
        trackStatus = 'BLOCKED_COREQUISITE';
        allTrackReasons.push(...coreqReasons);
      } else {
        allTrackReasons.push('تمامی پیش‌نیازها و شرایط تحصیلی احراز شده و درس قابل اخذ است.');
      }

      trackBreakdowns.push({
        trackId,
        trackName,
        status: trackStatus,
        isEligible: trackStatus === 'AVAILABLE',
        reasons: allTrackReasons,
        missingPrerequisites: missingPrereqs,
        missingCorequisites: missingCoreqs,
      });
    }

    // Determine Overall Status
    let overallStatus: EligibilityStatus = 'AVAILABLE';
    let isEligible = false;
    let primaryReason = '';
    const allReasons: string[] = [];
    const allMissingPrereqs: Array<{ id: string; name: string; code: string }> = [];
    const allMissingCoreqs: Array<{ id: string; name: string; code: string }> = [];

    if (isTrackOfficiallySelected) {
      const singleBreakdown = trackBreakdowns[0];
      if (singleBreakdown) {
        overallStatus = singleBreakdown.status;
        isEligible = singleBreakdown.isEligible;
        primaryReason = singleBreakdown.reasons[0] || '';
        allReasons.push(...singleBreakdown.reasons);
        allMissingPrereqs.push(...singleBreakdown.missingPrerequisites);
        allMissingCoreqs.push(...singleBreakdown.missingCorequisites);
      }
    } else {
      // Undeclared student: evaluate across all chosen tracks
      const eligibleTracks = trackBreakdowns.filter((tb) => tb.isEligible);
      const blockedPrereqTracks = trackBreakdowns.filter((tb) => tb.status === 'BLOCKED_PREREQUISITE');
      const blockedCoreqTracks = trackBreakdowns.filter((tb) => tb.status === 'BLOCKED_COREQUISITE');

      if (eligibleTracks.length === trackBreakdowns.length) {
        overallStatus = 'AVAILABLE';
        isEligible = true;
        primaryReason = `در تمامی ${trackBreakdowns.length} گرایش مدنظر شما، تمامی پیش‌نیازها رعایت شده و درس کاملاً قابل اخذ است.`;
      } else if (eligibleTracks.length > 0) {
        overallStatus = 'AVAILABLE';
        isEligible = true;
        const eligibleNames = eligibleTracks.map((t) => `«${t.trackName}»`).join(' و ');
        const ineligibleNames = trackBreakdowns
          .filter((t) => !t.isEligible)
          .map((t) => `«${t.trackName}»`)
          .join(' و ');
        primaryReason = `قابل اخذ در گرایش‌های ${eligibleNames} (اما در گرایش‌های ${ineligibleNames} به دلیل پیش‌نیاز قفل است).`;
      } else if (blockedPrereqTracks.length > 0) {
        overallStatus = 'BLOCKED_PREREQUISITE';
        isEligible = false;
        primaryReason = blockedPrereqTracks[0].reasons[0] || 'پیش‌نیازهای درس پاس نشده است.';
      } else if (blockedCoreqTracks.length > 0) {
        overallStatus = 'BLOCKED_COREQUISITE';
        isEligible = false;
        primaryReason = blockedCoreqTracks[0].reasons[0] || 'هم‌نیازهای درس پاس یا انتخاب نشده است.';
      } else {
        overallStatus = 'NOT_IN_CURRICULUM';
        isEligible = false;
        primaryReason = 'این درس در گرایش‌های انتخابی شما در چارت قرار ندارد.';
      }

      for (const tb of trackBreakdowns) {
        for (const r of tb.reasons) {
          allReasons.push(`[${tb.trackName}]: ${r}`);
        }
        for (const mp of tb.missingPrerequisites) {
          if (!allMissingPrereqs.some((x) => x.id === mp.id)) allMissingPrereqs.push(mp);
        }
        for (const mc of tb.missingCorequisites) {
          if (!allMissingCoreqs.some((x) => x.id === mc.id)) allMissingCoreqs.push(mc);
        }
      }
    }

    const firstCurrCourse = currCourseEntries[0];
    const canSelect = isEligible && overallStatus === 'AVAILABLE';

    if (canSelect) {
      eligibleCount++;
    } else {
      blockedCount++;
    }

    results.push({
      offeringId: offering.id,
      courseId: course.id,
      courseCode: course.code,
        rawCourseCode: offering.rawCourseCode,
      courseName: course.name,
      units: course.units,
        isExtraUnit: course.isExtraUnit === true,
      category: firstCurrCourse?.categoryOverride || course.category,
      groupCode: offering.groupCode,
      instructor: offering.instructor,
      dayOfWeek: offering.dayOfWeek,
      startTime: offering.startTime,
      endTime: offering.endTime,
      capacity: offering.capacity,
      enrolledCount: offering.enrolledCount,
        enrolledCountKnown: offering.enrolledCountKnown,
      examDate: offering.examDate,
      overallStatus,
      isEligible: canSelect,
      canSelect,
      primaryReason,
      allReasons,
      missingPrerequisites: allMissingPrereqs,
      missingCorequisites: allMissingCoreqs,
      suggestedSemester: firstCurrCourse?.suggestedSemester,
      classification: firstCurrCourse?.classification,
      trackBreakdowns: !isTrackOfficiallySelected ? trackBreakdowns : undefined,
      curriculumContext: {
        curriculumId: curriculum.id,
        curriculumName: curriculum.name,
        classification: firstCurrCourse?.classification,
        suggestedSemester: firstCurrCourse?.suggestedSemester,
      },
    });
  }

  return {
    studentId: studentProfile.userId,
    termId: studentProfile.currentTermId || '',
    curriculumId: curriculum.id,
    totalOfferingsEvaluated: currentOfferings.length,
    eligibleCount,
    blockedCount,
    alreadyPassedCount,
    needsReviewCount,
    results,
    evaluatedAt: new Date().toISOString(),
  };
}
