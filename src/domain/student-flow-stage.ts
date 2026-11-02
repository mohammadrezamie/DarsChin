export type RegistrationStage = 'courses' | 'preferences';

/** بازگشت به مرحلهٔ محفوظ: تا وقتی درسی انتخاب نشده، مرحلهٔ استاد باز نمی‌شود. */
export function initialRegistrationStage(step: number, selectedCount: number): RegistrationStage {
  return step >= 5 && selectedCount > 0 ? 'preferences' : 'courses';
}

/** اولویتِ نمایش استادها از همان ترتیب مشترک صف ثبت گرفته می‌شود. */
export function orderedChosenCourses(chosen: readonly string[], priority: readonly string[]): string[] {
  const active = new Set(chosen);
  return [...new Set([...priority.filter(id => active.has(id)), ...chosen])];
}

/** انتخاب‌های یک برنامهٔ قدیمی نباید بدون درخواست دوبارهٔ دانشجو وارد صف جدید شوند. */
export function activeRegistrationOfferingIds(
  selectedOfferingIds: readonly string[],
  evaluations: readonly import('../types').CourseEligibilityResult[],
  chosenCourseIds?: readonly string[],
): string[] {
  if (!chosenCourseIds) return [...selectedOfferingIds];
  const included = new Set(chosenCourseIds);
  const courseByOffering = new Map(evaluations.map(row => [row.offeringId, row.courseId]));
  return selectedOfferingIds.filter(id => included.has(courseByOffering.get(id) || ''));
}

/** هماهنگ با تصمیم نهایی موتور صلاحیت؛ canSelect به‌تنهایی کافی نیست. */
export function canPrioritizeOffering(
  row: Pick<import('../types').CourseEligibilityResult,'canSelect'|'isEligible'|'overallStatus'>,
): boolean {
  return row.canSelect === true && row.isEligible === true && row.overallStatus === 'AVAILABLE';
}
