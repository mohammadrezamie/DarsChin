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

/** شمارش واقعی فقط استاد اولِ مجاز برای دروس منتخب فعلی. */
export function currentPrimaryCoverage(
  chosenCourseIds: readonly string[],
  selectedOfferingIds: readonly string[],
  evaluations: readonly import('../types').CourseEligibilityResult[],
): { total: number; ready: number; pending: number } {
  const chosen = new Set(chosenCourseIds);
  const selected = new Set(selectedOfferingIds);
  const ready = new Set<string>();
  for (const item of evaluations) {
    if (chosen.has(item.courseId) && selected.has(item.offeringId) && canPrioritizeOffering(item)) ready.add(item.courseId);
  }
  return { total: chosen.size, ready: ready.size, pending: chosen.size - ready.size };
}
