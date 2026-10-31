import type { CourseEligibilityResult } from '../types';

type LectureTime = Pick<CourseEligibilityResult, 'dayOfWeek' | 'startTime' | 'endTime'>;

function clockMinutes(value?: string): number | null {
  if (!value) return null;
  const match = /^(\\d{1,2}):(\\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]), m = Number(match[2]);
  return h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : null;
}

/** Shared, format-independent overlap test for the dashboard, timetable and selection warning.
 * Unknown/malformed or zero-length times are not advertised as confirmed conflicts.
 */
export function lectureTimesOverlap(a: LectureTime, b: LectureTime): boolean {
  if (!a.dayOfWeek || a.dayOfWeek !== b.dayOfWeek) return false;
  const aStart = clockMinutes(a.startTime), aEnd = clockMinutes(a.endTime);
  const bStart = clockMinutes(b.startTime), bEnd = clockMinutes(b.endTime);
  return aStart !== null && aEnd !== null && bStart !== null && bEnd !== null &&
    aStart < aEnd && bStart < bEnd && aStart < bEnd && bStart < aEnd;
}

/** Advises about timetable conflicts. It does not confer academic eligibility. */
export function findOfferingTimeConflicts(
  candidate: Pick<CourseEligibilityResult, 'courseId' | 'courseName' | 'offeringId' | 'dayOfWeek' | 'startTime' | 'endTime' | 'examDate'>,
  selected: Pick<CourseEligibilityResult, 'courseId' | 'courseName' | 'offeringId' | 'dayOfWeek' | 'startTime' | 'endTime' | 'examDate'>[],
): string[] {
  const warnings: string[] = [];
  for (const other of selected) {
    // A replaced section is not another class that the student attends.
    if (candidate.offeringId === other.offeringId || candidate.courseId === other.courseId) continue;
    if (lectureTimesOverlap(candidate, other)) {
      warnings.push(`تداخل زمان کلاس با درس «${other.courseName}» (روز ${candidate.dayOfWeek}، ${other.startTime} تا ${other.endTime})`);
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
