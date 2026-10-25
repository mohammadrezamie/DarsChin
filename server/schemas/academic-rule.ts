import { z } from 'zod';

/**
 * Condition tree used by prerequisite/corequisite administration.
 * Strict leaf variants prevent silent acceptance of unsupported requirements.
 */
const identifier = z.string().trim().min(1).max(120);
const courseNode = z.object({
  type: z.literal('COURSE'),
  courseId: identifier,
}).strict();
const unitsNode = z.object({
  type: z.literal('MIN_PASSED_UNITS'),
  minUnits: z.number().int().min(1).max(999),
}).strict();

export const academicRuleNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    courseNode,
    unitsNode,
    z.object({
      type: z.literal('GROUP'),
      operator: z.enum(['AND','OR']),
      operands: z.array(academicRuleNodeSchema).min(1).max(100),
    }).strict(),
  ]),
);

function validateDepthAndCount(expression: unknown): boolean {
  let count = 0;
  const traverse = (node: any, depth: number): boolean => {
    if (!node || typeof node !== 'object' || depth > 6 || ++count > 150) return false;
    if (node.type !== 'GROUP') return true;
    return Array.isArray(node.operands) &&
      node.operands.every((child: unknown) => traverse(child, depth + 1));
  };
  return traverse(expression, 0);
}

export const createAcademicRuleSchema = z.object({
  curriculumId: identifier,
  targetCourseId: identifier,
  relationshipType: z.enum(['PREREQUISITE', 'COREQUISITE', 'CONTEXTUAL_RETAKE_RULE']),
  expression: academicRuleNodeSchema,
  entryYearId: identifier.nullable().optional(),
  majorId: identifier.nullable().optional(),
  trackId: identifier.nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict().refine(x => validateDepthAndCount(x.expression), {
  path: ['expression'], message: 'ساختار شرط بیش از حد پیچیده یا تو در تو است.',
});
