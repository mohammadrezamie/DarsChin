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
  coursePriorities: z.record(z.string(), z.array(z.string())).optional(),
  offeringPriorities: z.record(z.string(), z.array(z.string())).optional(),
});

export const planSelectSchema = z.object({
  offeringId: z.string().min(1, 'شناسه گروه درسی الزامی است'),
  action: z.enum(['add', 'remove']),
});
