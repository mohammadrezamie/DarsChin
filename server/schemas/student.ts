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
  // Accept the student UI's ordered array and the persisted rank-map shape.
  coursePriorities: z.union([
    z.array(z.string().min(1)).max(150),
    z.record(z.string(), z.number().int().nonnegative()),
  ]).optional(),
  offeringPriorities: z.record(z.string(), z.array(z.string())).optional(),
});

export const planSelectSchema = z.object({
  offeringId: z.string().min(1, 'شناسه گروه درسی الزامی است'),
  action: z.enum(['add', 'remove']),
});

/** Convert the UI's ordered course list to the canonical ranked map in StudentPlan. */
export function normalizeCoursePriorities(value: string[] | Record<string, number> | undefined): Record<string, number> | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return Object.fromEntries([...new Set(value)].map((id, index) => [id, index]));
  return value;
}
