import type { CourseEligibilityResult } from '../types';

/** Advises about timetable conflicts. It does not confer academic eligibility. */
export function findOfferingTimeConflicts(
  candidate: Pick<CourseEligibilityResult, 'courseId' | 'courseName' | 'offeringId' | 'dayOfWeek' | 'startTime' | 'endTime' | 'examDate'>,
  selected: Pick<CourseEligibilityResult, 'courseId' | 'courseName' | 'offeringId' | 'dayOfWeek' | 'startTime' | 'endTime' | 'examDate'>[],
): string[] {
  const minutes = (value?: string): number | null => {
    if (!value) return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const h = Number(match[1]), m = Number(match[2]);
    return h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : null;
  };
  const warnings: string[] = [];
  for (const other of selected) {
    // A replaced section is not another class that the student attends.
    if (candidate.offeringId === other.offeringId || candidate.courseId === other.courseId) continue;
    if (candidate.dayOfWeek && candidate.dayOfWeek === other.dayOfWeek) {
      const begin = minutes(candidate.startTime), end = minutes(candidate.endTime);
      const otherBegin = minutes(other.startTime), otherEnd = minutes(other.endTime);
      if (begin !== null && end !== null && otherBegin !== null && otherEnd !== null &&
          begin < otherEnd && end > otherBegin) {
        warnings.push(`تداخل زمان کلاس با درس «${other.courseName}» (روز ${candidate.dayOfWeek}، ${other.startTime} تا ${other.endTime})`);
      }
    }
    if (candidate.examDate && other.examDate) {
      const date = candidate.examDate.split(' - ')[0].trim();
      const otherDate = other.examDate.split(' - ')[0].trim();
      if (date && date === otherDate) {
        warnings.push(candidate.examDate === other.examDate
          ? `تداخل دقیق زمان امتحان با درس «${other.courseName}» (${candidate.examDate})`
          : `امتحان این درس و «${other.courseName}» در یک روز (${date}) است؛ ساعت امتحان‌ها را بررسی کن.`);
      }
    }
  }
  return [...new Set(warnings)];
}
