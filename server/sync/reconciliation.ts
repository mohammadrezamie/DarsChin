import crypto from 'crypto';
import type { Course, CourseOffering } from '../../src/types';
import { normalizeCode, normalizePersianText } from '../../src/domain/import-validator';

export interface SyncReconciliationResult {
  ok: boolean;
  offerings: CourseOffering[];
  acceptedRecords: number;
  duplicateRecords: number;
  errors: string[];
}

type UnknownRecord = Record<string, unknown>;

const WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
];

function objectValue(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function textValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function latinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function normalizeDay(value: string): string {
  const normalized = normalizePersianText(value).replace(/[‌\u200c]/g, ' ').replace(/\s+/g, ' ');
  return WEEKDAYS.find((day) => normalized.includes(normalizePersianText(day).replace(/\s+/g, ' '))) ?? '';
}

function validTime(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function timeMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function parseSchedule(record: UnknownRecord, courseClass: UnknownRecord): {
  day: string;
  startTime: string;
  endTime: string;
} {
  const schedule = textValue(courseClass.schedule ?? record.schedule);
  const daySource = textValue(courseClass.parsedScheduleDay ?? record.parsedScheduleDay) || schedule;
  const day = normalizeDay(daySource);
  const startCandidate = textValue(courseClass.parsedScheduleStart ?? record.parsedScheduleStart);
  const endCandidate = textValue(courseClass.parsedScheduleEnd ?? record.parsedScheduleEnd);
  const normalizedSchedule = latinDigits(schedule);
  const range = /(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/.exec(normalizedSchedule);
  const startTime = latinDigits(startCandidate) || range?.[1] || '';
  const endTime = latinDigits(endCandidate) || range?.[2] || '';

  if (!day || !validTime(startTime) || !validTime(endTime) || timeMinutes(startTime) >= timeMinutes(endTime)) {
    return { day: '', startTime: '', endTime: '' };
  }

  return {
    day,
    startTime: startTime.padStart(5, '0'),
    endTime: endTime.padStart(5, '0'),
  };
}

function findCourse(courseCode: string, courseName: string, courses: Course[]): Course | undefined {
  if (courseCode) {
    const code = normalizeCode(courseCode);
    const matches = courses.filter((course) => {
      const candidates = [
        course.code,
        ...(course.alternateCodes ?? []),
        ...(course.courseCodes ?? []).map((item) => item.code),
      ];
      return candidates.some((candidate) => normalizeCode(candidate) === code);
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return undefined;
  }

  if (!courseName) return undefined;
  const name = normalizePersianText(courseName);
  const matches = courses.filter((course) => normalizePersianText(course.name) === name);
  return matches.length === 1 ? matches[0] : undefined;
}

function strictInteger(value: unknown): number | undefined {
  const normalized = latinDigits(textValue(value));
  if (!/^\d+$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function normalizedRecord(
  raw: UnknownRecord,
  termId: string,
  campusId: string,
  courses: Course[],
): { offering?: CourseOffering; error?: string } {
  const course = objectValue(raw.course) ?? raw;
  const courseClass = objectValue(raw.courseClass) ?? raw;
  const courseCode = textValue(course.courseCode ?? raw.courseCode ?? course.code);
  const courseName = textValue(course.courseName ?? raw.courseName ?? course.name);
  const groupCode = textValue(courseClass.group ?? courseClass.groupCode ?? raw.group ?? raw.groupCode);
  const instructor = textValue(courseClass.instructor ?? raw.instructor ?? raw.teacher);
  const sourceRef = textValue(courseClass.courseClassRef ?? raw.courseClassRef);
  const offeringCode = textValue(courseClass.offeringCode ?? raw.offeringCode);
  const schedule = parseSchedule(raw, courseClass);
  const capacity = strictInteger(courseClass.capacity ?? raw.capacity);

  if (!courseCode && !courseName) return { error: 'کد و نام درس هر دو خالی‌اند.' };
  if (!groupCode) return { error: `گروه درس «${courseName || courseCode}» مشخص نیست.` };
  if (!instructor) return { error: `استاد درس «${courseName || courseCode}» مشخص نیست.` };
  if (!schedule.day || !schedule.startTime || !schedule.endTime) {
    return { error: `زمان‌بندی درس «${courseName || courseCode}» قابل تشخیص نیست؛ رکورد بدون زمان معتبر وارد نشد.` };
  }
  if (capacity === undefined || capacity <= 0) {
    return { error: `ظرفیت معتبر برای درس «${courseName || courseCode}» موجود نیست.` };
  }

  const matchedCourse = findCourse(courseCode, courseName, courses);
  if (!matchedCourse) {
    return { error: `تطبیق یکتایی برای درس «${courseName || courseCode}» پیدا نشد.` };
  }

  const normalizedCode = normalizeCode(courseCode || matchedCourse.code);
  const identityPart = sourceRef && sourceRef !== 'UNKNOWN' && sourceRef.length > 3
    ? `ref:${sourceRef}`
    : offeringCode
      ? `offering:${normalizedCode}:${offeringCode}`
      : groupCode && instructor && schedule.day && schedule.startTime && schedule.endTime
        ? `composite:${normalizedCode}:${groupCode}:${normalizePersianText(instructor)}:${schedule.day}:${schedule.startTime}:${schedule.endTime}`
        : '';

  if (!identityPart) return { error: `شناسهٔ پایدار برای ارائهٔ درس «${courseName || courseCode}» قابل ساخت نیست.` };

  const sourceIdentity = `educationalyar:${termId}:${campusId}:${identityPart}`;
  const id = `off-sync-${crypto.createHash('sha256').update(sourceIdentity).digest('hex').slice(0, 24)}`;
  const sourceExam = textValue(courseClass.exam ?? raw.exam);

  return {
    offering: {
      id,
      sourceIdentity,
      termId,
      campusId,
      courseId: matchedCourse.id,
      rawCourseCode: courseCode || matchedCourse.code,
      rawCourseName: courseName || matchedCourse.name,
      groupCode,
      instructor,
      dayOfWeek: schedule.day,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      capacity,
      // The current extension export does not expose a trustworthy enrolled count.
      // Keep the required legacy field at its neutral initial value and make the limitation explicit.
      enrolledCount: 0,
      examDate: sourceExam || undefined,
      notes: 'تعداد ثبت‌نام‌شدگان در خروجی منبع موجود نبود؛ این مقدار از آموزشیار تأیید نشده است.',
      source: 'extension',
      active: true,
    },
  };
}

/**
 * Reconciles a complete set of source records atomically. It never deactivates offerings
 * that are absent from a snapshot, because partial source coverage cannot prove removal.
 */
export function reconcileSyncRecords(input: {
  records: UnknownRecord[];
  termId: string;
  campusId: string;
  courses: Course[];
}): SyncReconciliationResult {
  const { records, termId, campusId, courses } = input;
  const errors: string[] = [];
  if (records.length === 0) {
    return {
      ok: false,
      offerings: [],
      acceptedRecords: 0,
      duplicateRecords: 0,
      errors: ['هیچ رکوردی برای تطبیق دریافت نشد.'],
    };
  }
  const byIdentity = new Map<string, CourseOffering>();
  let duplicateRecords = 0;

  records.forEach((record, index) => {
    const result = normalizedRecord(record, termId, campusId, courses);
    if (!result.offering) {
      errors.push(`رکورد ${index + 1}: ${result.error ?? 'ساختار رکورد نامعتبر است.'}`);
      return;
    }

    const existing = byIdentity.get(result.offering.sourceIdentity!);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(result.offering)) {
        errors.push(`رکورد ${index + 1}: یک شناسهٔ منبع با اطلاعات متناقض تکرار شده است.`);
      } else {
        duplicateRecords += 1;
      }
      return;
    }
    byIdentity.set(result.offering.sourceIdentity!, result.offering);
  });

  if (errors.length > 0) {
    return { ok: false, offerings: [], acceptedRecords: 0, duplicateRecords, errors };
  }

  return {
    ok: true,
    offerings: [...byIdentity.values()],
    acceptedRecords: byIdentity.size,
    duplicateRecords,
    errors: [],
  };
}
