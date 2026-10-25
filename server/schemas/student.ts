import { z } from 'zod';

export const updateProfileSchema = z.object({
  universityId: z.string().optional(),
  campusId: z.string().optional(),
  degreeLevelId: z.string().optional(),
  majorId: z.string().optional(),
  entryYearId: z.string().optional(),
  isTrackSelected: z.boolean().optional(),
  selectedTrackId: z.string().nullable().optional(),
  desiredTrackIds: z.array(z.string()).optional(),
  currentTermId: z.string().optional(),
  previousTermGpa: z.number().min(0).max(20).nullable().optional(),
});

export const addPassedCourseSchema = z.object({
  courseId: z.string().min(1, 'شناسه درس الزامی است'),
  grade: z.union([z.string(), z.number()]).optional(),
  termId: z.string().optional(),
});

export const batchPassedCoursesSchema = z.object({
  courseIds: z.array(z.string()),
  replaceAll: z.boolean().optional(),
});

export const updatePlanSchema = z.object({
  selectedOfferingIds: z.array(z.string()).optional(),
  // Historical plans store priority ranks as a map; the current planner sends an ordered array.
  coursePriorities: z.union([
    z.array(z.string().min(1)).max(500),
    z.record(z.string(), z.number().int().nonnegative()),
  ]).optional(),
  offeringPriorities: z.record(z.string(), z.array(z.string())).optional(),
  /** Only for atomic, verified, same-course group rearrangements. */
  qualitySuggestion: z.boolean().optional(),
});

export const planSelectSchema = z.object({
  offeringId: z.string().min(1, 'شناسه گروه درسی الزامی است'),
  action: z.enum(['add', 'remove']),
});
