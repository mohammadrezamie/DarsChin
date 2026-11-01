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

// Course attempts are historical facts. A failed/absent prerequisite must not
// become PASSED merely because a downstream course has been completed.
const studentGrade = z.union([
  z.number(),
  z.string().trim().regex(/^(?:20(?:\.0+)?|1?\d(?:\.\d+)?)$/, 'نمره باید بین صفر و بیست باشد.'),
]).transform(value => Number(value)).pipe(z.number().finite().min(0).max(20));

export const addPassedCourseSchema = z.object({
  courseId: z.string().min(1, 'شناسه درس الزامی است'),
  grade: studentGrade.optional(),
  status: z.enum(['PASSED', 'FAILED', 'ABSENT']).optional(),
  termId: z.string().optional(),
}).superRefine((attempt, ctx) => {
  const status = attempt.status || (attempt.grade !== undefined && attempt.grade < 10 ? 'FAILED' : 'PASSED');
  if (status === 'ABSENT' && attempt.grade !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['grade'], message: 'برای غیبت نمره ثبت نکنید.' });
  }
  if (status === 'PASSED' && attempt.grade !== undefined && attempt.grade < 10) {
    ctx.addIssue({ code: 'custom', path: ['status'], message: 'نمرهٔ کمتر از ۱۰ با وضعیت قبولی سازگار نیست.' });
  }
  if (status === 'FAILED' && attempt.grade !== undefined && attempt.grade >= 10) {
    ctx.addIssue({ code: 'custom', path: ['status'], message: 'نمرهٔ ۱۰ یا بیشتر با وضعیت مردودی سازگار نیست.' });
  }
});

export const batchPassedCoursesSchema = z.object({
  courseIds: z.array(z.string()),
  replaceAll: z.boolean().optional(),
});

const uniquePlanIds = (items: string[]) => new Set(items).size === items.length;
const planId = z.string().trim().min(1).max(150);
const rankedCourseIds = z.array(planId).max(200)
  .refine(uniquePlanIds, 'اولویت یک درس نمی‌تواند تکراری باشد.');
const rankedCourseMap = z.record(planId, z.number().int().min(0).max(200))
  .refine(entries => Object.keys(entries).length <= 200, 'تعداد اولویت‌های درس بیش از حد است.');
const rankedOfferingMap = z.record(planId, z.array(planId).max(30)
  .refine(uniquePlanIds, 'یک گروه جایگزین نمی‌تواند تکرار شود.'))
  .refine(entries => Object.keys(entries).length <= 150, 'تعداد درس‌های دارای گروه جایگزین بیش از حد است.');

export const updatePlanSchema = z.object({
  selectedOfferingIds: z.array(planId).max(120)
    .refine(uniquePlanIds, 'یک گروه درسی نمی‌تواند چند بار انتخاب شود.').optional(),
  // Historical plans store priority ranks as a map; the current planner sends an ordered array.
  coursePriorities: z.union([rankedCourseIds, rankedCourseMap]).optional(),
  offeringPriorities: rankedOfferingMap.optional(),
});

export const planSelectSchema = z.object({
  offeringId: z.string().min(1, 'شناسه گروه درسی الزامی است'),
  action: z.enum(['add', 'remove']),
});

/** Interest basket is deliberately separate from final academic enrollment. */
export const updateWishlistSchema = z.object({ courseIds: z.array(z.string().min(1).max(150)).max(200).refine(items => new Set(items).size === items.length, 'درس تکراری در سبد قرار دارد.') }).strict();
export const updateJourneySchema = z.object({ step: z.number().int().min(0).max(6) }).strict();
