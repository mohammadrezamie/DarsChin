/** قرارداد مستقل پیش‌نویس برنامهٔ پیشنهادی؛ هیچ قاعدهٔ اخذ یا سنواتی را فعال نمی‌کند. */
export type StudyPeriod = { id: string; kind: 'regular' | 'summer' | 'other'; label: string };
export type StudyPlanItem =
  | { id: string; kind: 'course'; courseId: string; periodId: string }
  | { id: string; kind: 'choice'; poolId: string; periodId: string; label: string };

export interface StudyPlanDraft {
  curriculumId: string;
  periods: readonly StudyPeriod[];
  items: readonly StudyPlanItem[];
}

export interface StudyPlanContext {
  curriculumId: string;
  courseIds: readonly string[];
  choicePoolIds: readonly string[];
}

export type StudyPlanValidation =
  | { status: 'absent' }
  | { status: 'valid'; unplannedCourseIds: string[] }
  | { status: 'invalid'; issues: string[] };

/** نبود برنامه یا پوشش ناقص مجاز است؛ اعتبارسنجی صرفاً ساختاری و متعلق به همان چارت است.
 * دوره‌ها به ترتیب ورودی هستند. تعداد آن‌ها از سند و انتخاب مدیر می‌آید، نه مقطع فرضی.
 * عضویت در context باید توسط سرور و بر اساس نسخه/گرایش مجاز تعیین شود.
 */
export function validateStudyPlanDraft(
  context: StudyPlanContext,
  draft: StudyPlanDraft | null,
): StudyPlanValidation {
  if (draft === null) return { status: 'absent' };
  const issues: string[] = [];
  if (!context.curriculumId || draft.curriculumId !== context.curriculumId) {
    issues.push('برنامه متعلق به چارت انتخاب‌شده نیست.');
  }
  const periodIds = new Set<string>();
  for (const period of draft.periods) {
    if (!period.id.trim() || !period.label.trim() || periodIds.has(period.id) ||
        !['regular', 'summer', 'other'].includes(period.kind)) {
      issues.push('شناسه، عنوان یا نوع دورهٔ پیشنهادی نامعتبر است.');
    }
    periodIds.add(period.id);
  }
  const courseIds = new Set(context.courseIds);
  const poolIds = new Set(context.choicePoolIds);
  const itemIds = new Set<string>();
  const planned = new Set<string>();
  for (const item of draft.items) {
    if (!item.id.trim() || itemIds.has(item.id)) issues.push('شناسهٔ ردیف برنامه نامعتبر یا تکراری است.');
    itemIds.add(item.id);
    if (!periodIds.has(item.periodId)) issues.push('دورهٔ ردیف در برنامه تعریف نشده است.');
    if (item.kind === 'course') {
      if (!courseIds.has(item.courseId) || planned.has(item.courseId)) {
        issues.push('درس خارج از محدودهٔ چارت یا تکراری است.');
      }
      planned.add(item.courseId);
    } else if (item.kind === 'choice') {
      if (!poolIds.has(item.poolId) || !item.label.trim()) {
        issues.push('گروه انتخاب یا عنوان جای‌نگهدار معتبر نیست.');
      }
    } else {
      issues.push('نوع ردیف برنامه معتبر نیست.');
    }
  }
  return issues.length ? { status: 'invalid', issues } : {
    status: 'valid',
    unplannedCourseIds: [...courseIds].filter(id => !planned.has(id)),
  };
}
