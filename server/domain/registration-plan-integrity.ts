import type { CourseOffering } from '../../src/types';

export interface RegistrationPlanReferences {
  selectedOfferingIds?: string[];
  offeringPriorities?: Record<string, string[]>;
  currentTermId: string;
  campusId?: string | null;
  offerings: CourseOffering[];
}

/**
 * Reject cross-course, cross-campus, and other-term registration references
 * before writing a whole student plan. Read-only loading of historical plans
 * is intentionally not migrated or rewritten here.
 */
export function validateRegistrationPlanReferences({
  selectedOfferingIds, offeringPriorities, currentTermId, campusId, offerings,
}: RegistrationPlanReferences): string | null {
  const byId = new Map(offerings.map(offering => [offering.id, offering]));
  const validOffering = (id: string) => {
    const offering = byId.get(id);
    return offering?.active === true &&
      offering.termId === currentTermId &&
      Boolean(campusId) && offering.campusId === campusId;
  };

  if (selectedOfferingIds) {
    if (new Set(selectedOfferingIds).size !== selectedOfferingIds.length) {
      return 'یک گروه در برنامه چند بار انتخاب شده است.';
    }
    const courses = new Set<string>();
    for (const id of selectedOfferingIds) {
      if (!validOffering(id)) return 'گروه اصلی باید فعال و متعلق به واحد دانشگاهی و نیمسال همین دانشجو باشد.';
      const courseId = byId.get(id)!.courseId;
      if (courses.has(courseId)) return 'از هر درس فقط یک گروه اصلی می‌توان در برنامه داشت؛ بقیه گروه‌ها باید رزرو باشند.';
      courses.add(courseId);
    }
  }

  if (offeringPriorities) {
    for (const [courseId, ids] of Object.entries(offeringPriorities)) {
      if (new Set(ids).size !== ids.length) return 'یک گروه رزرو یا اصلی چند بار در اولویت‌ها تکرار شده است.';
      for (const id of ids) {
        const offering = byId.get(id);
        if (!validOffering(id) || offering?.courseId !== courseId) {
          return 'اولویت گروه‌ها باید فقط شامل گروه‌های معتبر همان درس، نیمسال و واحد دانشگاهی باشد.';
        }
      }
    }
  }
  return null;
}
