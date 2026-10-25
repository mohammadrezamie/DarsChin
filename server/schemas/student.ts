import { z } from 'zod';

const academicId = z.string().trim().min(1).max(160);
export const updateProfileSchema = z.object({
  universityId: academicId.optional(),
  provinceId: z.union([academicId,z.literal('')]).nullable().optional(),
  campusId: academicId.optional(),
  degreeLevelId: academicId.optional(),
  majorId: academicId.optional(),
  entryYearId: academicId.optional(),
  isTrackSelected: z.boolean().optional(),
  selectedTrackId: academicId.nullable().optional(),
  desiredTrackIds: z.array(academicId).max(100).optional(),
  currentTermId: academicId.optional(),
  previousTermGpa: z.number().min(0).max(20).nullable().optional(),
});

export const addPassedCourseSchema = z.object({
  courseId: academicId,
  grade: z.union([
    z.number().finite().min(0).max(20),
    z.string().trim().refine(value=>
      value==='' || (/^\\d{1,2}(?:\\.\\d{1,2})?$/.test(value) &&
        Number(value)>=0 && Number(value)<=20),
      'نمره باید عددی بین صفر تا بیست باشد.'),
  ]).optional(),
  termId: academicId.optional(),
});

export const batchPassedCoursesSchema = z.object({
  courseIds: z.array(academicId).max(250),
  replaceAll: z.boolean().optional(),
});

export const updatePlanSchema = z.object({
  selectedOfferingIds: z.array(z.string().min(1).max(160)).max(100).optional(),
  // Historical plans store priority ranks as a map; the current planner sends an ordered array.
  coursePriorities: z.union([
    z.array(z.string().min(1)).max(500),
    z.record(z.string(), z.number().int().nonnegative()),
  ]).optional(),
  offeringPriorities: z.record(z.string(), z.array(z.string())).optional(),
  /** Only for atomic, verified, same-course group rearrangements. */
  qualitySuggestion: z.boolean().optional(),
}).refine(
  data => !data.qualitySuggestion || Boolean(data.selectedOfferingIds?.length),
  {message:'برای اعمال چیدمان پیشنهادی باید گروه‌های انتخابی مشخص باشند.',path:['selectedOfferingIds']},
);

export const planSelectSchema = z.object({
  offeringId: z.string().min(1, 'شناسه گروه درسی الزامی است'),
  action: z.enum(['add', 'remove']),
});
