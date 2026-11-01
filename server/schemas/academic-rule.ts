import { z } from 'zod';

const academicRuleNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('COURSE'), courseId: z.string().trim().min(1) }).strict(),
    z.object({
      type: z.literal('GROUP'),
      operator: z.enum(['AND', 'OR']),
      operands: z.array(academicRuleNodeSchema).min(2).max(16),
    }).strict(),
  ])
);

/** Reject deeply nested user-supplied trees before storing or evaluating them. */
export function isBoundedAcademicRuleTree(node: unknown): boolean {
  let nodes = 0;
  const walk = (value: unknown, depth: number): boolean => {
    nodes++;
    if (depth > 6 || nodes > 64 || !value || typeof value !== 'object') return false;
    const item = value as { type?: string; operands?: unknown };
    if (item.type === 'COURSE') return true;
    if (item.type !== 'GROUP' || !Array.isArray(item.operands)) return false;
    return item.operands.every(child => walk(child, depth + 1));
  };
  return walk(node, 0);
}

export const createAcademicRuleSchema = z.object({
  curriculumId: z.string().min(1, 'Curriculum ID is required'),
  targetCourseId: z.string().min(1, 'Target Course ID is required'),
  relationshipType: z.enum(['PREREQUISITE', 'COREQUISITE', 'CONTEXTUAL_RETAKE_RULE']),
  expression: academicRuleNodeSchema.refine(isBoundedAcademicRuleTree, 'ساختار رابطه بیش از حد پیچیده است.'),
  entryYearId: z.string().nullable().optional(),
  majorId: z.string().nullable().optional(),
  trackId: z.string().nullable().optional(),
  notes: z.string().optional(),
});
