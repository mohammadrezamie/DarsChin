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
