import { z } from 'zod';

export const updateProfileSchema = z.object({
  universityId: z.string().optional(),
  campusId: z.string().optional(),
  provinceId: z.string().nullable().optional(),
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
  status: z.enum(['PASSED', 'FAILED', 'ABSENT', 'EXCUSED_EXAM_ABSENCE', 'CLASS_ABSENCE_DROP']).optional(),
  termId: z.string().trim().min(1).max(80).optional(),
}).superRefine((attempt, ctx) => {
  const status = attempt.status || (attempt.grade !== undefined && attempt.grade < 10 ? 'FAILED' : 'PASSED');
  if (['ABSENT', 'EXCUSED_EXAM_ABSENCE', 'CLASS_ABSENCE_DROP'].includes(status) && attempt.grade !== undefined) {
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

export const updatePlanSchema = z.object({
  selectedOfferingIds: z.array(z.string().min(1)).max(500).refine(
    ids => new Set(ids).size === ids.length, 'گروه تکراری در برنامه وجود دارد.'
  ).optional(),
  // Historical plans store priority ranks as a map; the current planner sends an ordered array.
  coursePriorities: z.union([
    z.array(z.string().min(1)).max(500).refine(
      ids => new Set(ids).size === ids.length, 'درس تکراری در ترتیب اولویت وجود دارد.'
    ),
    z.record(z.string(), z.number().int().nonnegative()),
  ]).optional(),
  offeringPriorities: z.record(z.string(), z.array(z.string().min(1)).max(50)
    .refine(ids => new Set(ids).size === ids.length, 'گروه تکراری در جایگزین‌ها وجود دارد.')).optional(),
});

export const registrationProgressSchema = z.object({
  offeringId: z.string().min(1).max(150),
  registered: z.boolean(),
}).strict();

export const planSelectSchema = z.object({
  offeringId: z.string().min(1, 'شناسه گروه درسی الزامی است'),
  action: z.enum(['add', 'remove']),
});

/** Interest basket is deliberately separate from final academic enrollment. */
export const updateWishlistSchema = z.object({ courseIds: z.array(z.string().min(1).max(150)).max(200).refine(items => new Set(items).size === items.length, 'درس تکراری در سبد قرار دارد.') }).strict();
export const updateJourneySchema = z.object({ step: z.number().int().min(0).max(6) }).strict();
