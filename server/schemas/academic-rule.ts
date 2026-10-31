import { z } from 'zod';
import type { AcademicRuleNode } from '../../src/types';

// Reject partially empty or ambiguously-shaped trees at the API boundary.
// The former schema accepted GROUP without operator/operands and COURSE without
// courseId; a single filled operand could hide incomplete AND/OR siblings.
const academicRuleNodeSchema: z.ZodType<AcademicRuleNode> = z.lazy(() => z.discriminatedUnion('type', [
  z.object({
    type: z.literal('COURSE'),
    courseId: z.string().trim().min(1, 'یک درس برای هر شرط لازم است'),
  }).strict(),
  z.object({
    type: z.literal('GROUP'),
    operator: z.enum(['AND', 'OR']),
    operands: z.array(academicRuleNodeSchema).min(2, 'هر گروه «و/یا» حداقل دو شرط نیاز دارد')
      .max(30, 'تعداد شرط‌های یک گروه بیش از حد مجاز است'),
  }).strict(),
]));

export const createAcademicRuleSchema = z.object({
  curriculumId: z.string().min(1, 'Curriculum ID is required'),
  targetCourseId: z.string().min(1, 'Target Course ID is required'),
  relationshipType: z.enum(['PREREQUISITE', 'COREQUISITE', 'CONTEXTUAL_RETAKE_RULE']),
  expression: academicRuleNodeSchema,
  entryYearId: z.string().nullable().optional(),
  majorId: z.string().nullable().optional(),
  trackId: z.string().nullable().optional(),
  notes: z.string().optional(),
});
