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
  const targetTrackIds: string[] = isTrackOfficiallySelected
    ? [studentProfile.selectedTrackId!]
    : studentProfile.desiredTrackIds && studentProfile.desiredTrackIds.length > 0
    ? studentProfile.desiredTrackIds
    : tracks.filter((t) => t.majorId === studentProfile.majorId).map((t) => t.id);

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
        courseName: course.name,
        units: course.units,
        category: course.category,
        groupCode: offering.groupCode,
        instructor: offering.instructor,
        dayOfWeek: offering.dayOfWeek,
        startTime: offering.startTime,
        endTime: offering.endTime,
        capacity: offering.capacity,
        enrolledCount: offering.enrolledCount,
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
        courseName: course.name,
        units: course.units,
        category: course.category,
        groupCode: offering.groupCode,
        instructor: offering.instructor,
        dayOfWeek: offering.dayOfWeek,
        startTime: offering.startTime,
        endTime: offering.endTime,
        capacity: offering.capacity,
        enrolledCount: offering.enrolledCount,
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

      const prereqRules = applicableRules.filter((r) => r.relationshipType === 'PREREQUISITE');
      const coreqRules = applicableRules.filter((r) => r.relationshipType === 'COREQUISITE');
      const retakeRules = applicableRules.filter((r) => r.relationshipType === 'CONTEXTUAL_RETAKE_RULE');

      const missingPrereqs: Array<{ id: string; name: string; code: string }> = [];
      const prereqReasons: string[] = [];
      const missingCoreqs: Array<{ id: string; name: string; code: string }> = [];
      const coreqReasons: string[] = [];

      // 1. Evaluate PREREQUISITES
      const andRules = prereqRules.filter((r) => r.conditionType === 'AND');
      const orGroups = new Map<string, typeof prereqRules>();
      for (const r of prereqRules) {
        if (r.conditionType === 'OR') {
          const grp = r.ruleGroup || 'default_or';
          const list = orGroups.get(grp) || [];
          list.push(r);
          orGroups.set(grp, list);
        }
      }

      for (const ar of andRules) {
        const reqCourse = coursesMap.get(ar.sourceCourseId);
        if (!reqCourse) continue;
        const isPassed = passedCourses.some((p) => p.courseId === reqCourse.id && p.status === 'PASSED');
        if (!isPassed) {
          missingPrereqs.push({ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code });
          prereqReasons.push(`برای اخذ درس ${course.name}، درس «${reqCourse.name}» باید قبلاً پاس شده باشد.`);
        }
      }

      for (const [groupName, rules] of orGroups.entries()) {
        const anyPassed = rules.some((r) => passedCourses.some((p) => p.courseId === r.sourceCourseId && p.status === 'PASSED'));
        if (!anyPassed && rules.length > 0) {
          const requiredNames = rules
            .map((r) => coursesMap.get(r.sourceCourseId)?.name || 'نامشخص')
            .join(' یا ');
          prereqReasons.push(`برای اخذ این درس باید حداقل یکی از دروس ( ${requiredNames} ) قبلاً پاس شده باشد.`);
          for (const r of rules) {
            const c = coursesMap.get(r.sourceCourseId);
            if (c) missingPrereqs.push({ id: c.id, name: c.name, code: c.code });
          }
        }
      }

      // 2. Evaluate FAILED/ABSENT CONTEXTUAL RETAKE RULES
      for (const rr of retakeRules) {
        const reqCourse = coursesMap.get(rr.sourceCourseId);
        if (!reqCourse) continue;

        const isPassed = passedCourses.some((p) => p.courseId === reqCourse.id && p.status === 'PASSED');
        if (isPassed) continue; // It is passed, condition satisfied

        const failedOrAbsent = passedCourses.some(
          (p) => p.courseId === reqCourse.id && (p.status === 'FAILED' || p.status === 'ABSENT')
        );

        if (failedOrAbsent) {
          const isPlannedInSameTerm = plannedCourseIdsSet.has(reqCourse.id);
          if (!isPlannedInSameTerm) {
            missingCoreqs.push({ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code });
            coreqReasons.push(
              `«${reqCourse.name}» در سابقه شما مردود/غیبت ثبت شده است و طبق قانون این چارت، برای اخذ این درس باید آن را در همین ترم مجدداً اخذ کنید.`
            );
          }
        } else {
          // Hasn't taken it at all -> blocked like a normal prerequisite
          missingPrereqs.push({ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code });
          prereqReasons.push(`برای اخذ درس ${course.name}، درس «${reqCourse.name}» باید قبلاً پاس شده باشد.`);
        }
      }

      // 3. Evaluate COREQUISITES
      for (const cr of coreqRules) {
        const reqCourse = coursesMap.get(cr.sourceCourseId);
        if (!reqCourse) continue;

        const isPassed = passedCourses.some((p) => p.courseId === reqCourse.id && p.status === 'PASSED');
        const isPlannedInSameTerm = plannedCourseIdsSet.has(reqCourse.id);

        if (!isPassed && !isPlannedInSameTerm) {
          missingCoreqs.push({ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code });
          coreqReasons.push(`درس «${reqCourse.name}» باید در همین ترم همراه این درس اخذ شود (یا قبلاً پاس شده باشد).`);
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
      courseName: course.name,
      units: course.units,
      category: firstCurrCourse?.categoryOverride || course.category,
      groupCode: offering.groupCode,
      instructor: offering.instructor,
      dayOfWeek: offering.dayOfWeek,
      startTime: offering.startTime,
      endTime: offering.endTime,
      capacity: offering.capacity,
      enrolledCount: offering.enrolledCount,
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
