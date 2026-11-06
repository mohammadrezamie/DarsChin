/** تنها منابع تأییدشدهٔ ساخت چارت؛ انتخاب خودکار اولین گزینه ممنوع است. */
export interface AcademicScopeEntity {
  id: string;
  name?: string;
  year?: number;
  universityId?: string;
  degreeLevelId?: string;
  active?: boolean;
}
export interface CurriculumScopeMeta {
  universities: AcademicScopeEntity[];
  campuses: AcademicScopeEntity[];
  degreeLevels: AcademicScopeEntity[];
  majors: AcademicScopeEntity[];
  entryYears: AcademicScopeEntity[];
}
export interface CurriculumScopeSelection {
  universityId: string;
  campusId: string;
  degreeLevelId: string;
  majorId: string;
  entryYearId: string;
}
export const emptyCurriculumScope = (): CurriculumScopeSelection => ({
  universityId: '', campusId: '', degreeLevelId: '', majorId: '', entryYearId: '',
});

/** فقط گزینه‌های واقعی و فعال در دامنهٔ بالادستی نشان داده می‌شوند. */
export function curriculumScopeOptions(meta: CurriculumScopeMeta, scope: CurriculumScopeSelection) {
  const active = (values: AcademicScopeEntity[]) => values.filter(value => value.active !== false);
  return {
    universities: active(meta.universities),
    campuses: scope.universityId
      ? active(meta.campuses).filter(value => value.universityId === scope.universityId) : [],
    degreeLevels: active(meta.degreeLevels),
    majors: scope.degreeLevelId
      ? active(meta.majors).filter(value => value.degreeLevelId === scope.degreeLevelId) : [],
    entryYears: active(meta.entryYears),
  };
}

/** هر پنج تصمیم باید آگاهانه و سازگار انتخاب شده باشند؛ از اولین ردیف Seed استنتاج نشود. */
export function validateCurriculumScope(meta: CurriculumScopeMeta, scope: CurriculumScopeSelection): string | null {
  const options = curriculumScopeOptions(meta, scope);
  if (!scope.universityId || !options.universities.some(row => row.id === scope.universityId))
    return 'دانشگاه معتبر را انتخاب کن.';
  if (!scope.campusId || !options.campuses.some(row => row.id === scope.campusId))
    return 'واحد دانشگاهی متعلق به همین دانشگاه را انتخاب کن.';
  if (!scope.degreeLevelId || !options.degreeLevels.some(row => row.id === scope.degreeLevelId))
    return 'مقطع تحصیلی معتبر را انتخاب کن.';
  if (!scope.majorId || !options.majors.some(row => row.id === scope.majorId))
    return 'رشتهٔ متعلق به همین مقطع را انتخاب کن.';
  if (!scope.entryYearId || !options.entryYears.some(row => row.id === scope.entryYearId))
    return 'سال ورود معتبر را انتخاب کن.';
  return null;
}

/** تعویض والد، شناسهٔ فرزند سابق را برای ارسال به سرور باقی نمی‌گذارد. */
export function changeCurriculumScope(
  scope: CurriculumScopeSelection,
  field: keyof CurriculumScopeSelection,
  value: string,
): CurriculumScopeSelection {
  const next = { ...scope, [field]: value };
  if (field === 'universityId') next.campusId = '';
  if (field === 'degreeLevelId') next.majorId = '';
  return next;
}
