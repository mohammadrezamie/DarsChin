import type { CourseOffering } from '../types';

export type ScheduleOffering = Pick<CourseOffering, 'id' | 'courseId' | 'dayOfWeek' | 'startTime' | 'endTime' | 'examDate'>;

export interface PlanConflict {
  kind: 'CLASS' | 'EXAM';
  offeringIds: [string, string];
  /** Students see class/exam names through their own authorised plan, never another account. */
  description: string;
}

const toLatin = (value: string): string => value
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));

const normalizeDay = (value: string): string =>
  value.replace(/\u200c/g, '').replace(/\s+/g, '').replace(/ي/g, 'ی').trim();

const knownDays = new Set([
  'شنبه', 'یکشنبه', 'دوشنبه', 'سهشنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه',
]);

export function clockMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(toLatin(value.trim()));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? 60 * hour + minute : null;
}

/** Missing or unverified timetables are NOT silently treated as confirmed overlaps. */
function scheduledSession(offering: ScheduleOffering) {
  const day = normalizeDay(offering.dayOfWeek || '');
  const start = clockMinutes(offering.startTime || '');
  const end = clockMinutes(offering.endTime || '');
  return knownDays.has(day) && start !== null && end !== null && end > start
    ? { day, start, end } : null;
}

/** Consistent public date-key normalization for UI warnings and server blocking. */
export function normalizedExamDay(raw?: string | null): string | null {
  const text = toLatin((raw || '').trim());
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(text);
  if (!match) return null;
  return match[1] + '/' + match[2].padStart(2, '0') + '/' + match[3].padStart(2, '0');
}

/** Only reject a known identical exam start; same-day different times remain warnings in the UI. */
function scheduledExam(offering: ScheduleOffering) {
  const text = toLatin((offering.examDate || '').trim()).replace(/\s+/g, ' ');
  const date = normalizedExamDay(text);
  const time = /(?:^|[\s\-–،])(\d{1,2}:\d{2})(?=$|[\s\-–،])/.exec(text)?.[1];
  const minute = time ? clockMinutes(time) : null;
  return date && minute !== null ? { date, minute } : null;
}

/**
 * All selected offerings are checked together, not merely the newly added one.
 * A whole-plan PUT and an individual group swap must obey the same invariant.
 */
export function detectPlanConflicts(offerings: ScheduleOffering[]): PlanConflict[] {
  const conflicts: PlanConflict[] = [];
  for (let first = 0; first < offerings.length; first++) {
    for (let second = first + 1; second < offerings.length; second++) {
      const a = offerings[first], b = offerings[second];
      if (a.courseId === b.courseId) continue; // duplicate sections are validated separately
      const aSession = scheduledSession(a), bSession = scheduledSession(b);
      if (aSession && bSession && aSession.day === bSession.day &&
          aSession.start < bSession.end && bSession.start < aSession.end) {
        conflicts.push({
          kind: 'CLASS', offeringIds: [a.id, b.id],
          description: 'دو کلاس انتخاب‌شده در یک روز و ساعت هم‌پوشانی دارند.',
        });
      }
      const aExam = scheduledExam(a), bExam = scheduledExam(b);
      if (aExam && bExam && aExam.date === bExam.date &&
          aExam.minute === bExam.minute) {
        conflicts.push({
          kind: 'EXAM', offeringIds: [a.id, b.id],
          description: 'دو امتحان انتخاب‌شده در یک تاریخ و ساعت یکسان شروع می‌شوند.',
        });
      }
    }
  }
  return conflicts;
}
