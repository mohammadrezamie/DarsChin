export type RegistrationStage = 'courses' | 'preferences';

/** بازگشت به مرحلهٔ محفوظ: تا وقتی درسی انتخاب نشده، مرحلهٔ استاد باز نمی‌شود. */
export function initialRegistrationStage(step: number, selectedCount: number): RegistrationStage {
  return step >= 5 && selectedCount > 0 ? 'preferences' : 'courses';
}
