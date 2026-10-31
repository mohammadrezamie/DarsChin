import type { CourseAttemptStatus, StudentPassedCourse } from '../types';

/** Only actual passes earn credit. Legacy missing status is treated as pass,
 * provided the grade supports it; no other status can grant credit.
 */
export function isSuccessfulCourseAttempt(attempt: Pick<StudentPassedCourse, 'status' | 'grade'>): boolean {
  return (attempt.status === 'PASSED' || attempt.status == null) &&
    (attempt.grade === undefined || (Number.isFinite(attempt.grade) && attempt.grade >= 10));
}
export const COURSE_ATTEMPT_LABELS: Record<CourseAttemptStatus, string> = {
  PASSED: 'پاس‌شده',
  FAILED: 'مردود',
  ABSENT: 'غیبت (نوع غیبت در سابقهٔ قدیمی مشخص نیست)',
  EXCUSED_EXAM_ABSENCE: 'غیبت موجه در جلسهٔ امتحان',
  CLASS_ABSENCE_DROP: 'حذف به‌دلیل غیبت غیرموجه کلاسی توسط استاد',
};
export function courseAttemptLabel(status?: CourseAttemptStatus): string {
  return status ? (COURSE_ATTEMPT_LABELS[status] || 'نیازمند بررسی') : 'پاس‌شده (سابقهٔ قدیمی)';
}
