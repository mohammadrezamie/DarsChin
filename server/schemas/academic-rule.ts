import { z } from 'zod';

const academicRuleNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.enum(['COURSE', 'GROUP']),
    courseId: z.string().optional(),
    operator: z.enum(['AND', 'OR']).optional(),
    operands: z.array(academicRuleNodeSchema).optional(),
  })
);

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
