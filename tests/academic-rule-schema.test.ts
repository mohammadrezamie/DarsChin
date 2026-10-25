import { describe, expect, it } from 'vitest';
import { createAcademicRuleSchema, isBoundedAcademicRuleTree } from '../server/schemas/academic-rule';

const base = {
  curriculumId: 'draft-curriculum', targetCourseId: 'course-b',
  relationshipType: 'PREREQUISITE', expression: { type: 'COURSE', courseId: 'course-a' },
};

describe('bounded academic relation expression contract', () => {
  it('accepts direct prerequisites and explicit nested AND/OR relationships', () => {
    expect(createAcademicRuleSchema.safeParse(base).success).toBe(true);
    const group = {
      type: 'GROUP', operator: 'AND',
      operands: [
        { type: 'COURSE', courseId: 'course-a' },
        { type: 'GROUP', operator: 'OR', operands: [
          { type: 'COURSE', courseId: 'course-c' },
          { type: 'COURSE', courseId: 'course-d' },
        ] },
      ],
    };
    expect(createAcademicRuleSchema.safeParse({ ...base, expression: group }).success).toBe(true);
  });

  it('refuses the old flat form and incomplete group expressions', () => {
    for (const expression of [
      { type: 'COURSE', courseId: '' },
      { type: 'GROUP', operator: 'AND', operands: [] },
      { type: 'GROUP', operator: 'XOR', operands: [] },
      { type: 'GROUP', operator: 'OR', operands: [{ type: 'COURSE', courseId: 'one' }] },
      { type: 'COURSE', courseId: 'one', sourceCourseId: 'other' },
    ]) {
      expect(createAcademicRuleSchema.safeParse({ ...base, expression }).success).toBe(false);
    }
    expect(createAcademicRuleSchema.safeParse({
      ...base, sourceCourseId: 'course-a', expression: undefined,
    }).success).toBe(false);
  });

  it('rejects deep trees even when each group node is locally valid', () => {
    let node: unknown = { type: 'COURSE', courseId: 'leaf' };
    for (let i = 0; i < 8; i++) {
      node = { type: 'GROUP', operator: 'AND', operands: [node, { type: 'COURSE', courseId: 'other' }] };
    }
    expect(isBoundedAcademicRuleTree(node)).toBe(false);
    expect(createAcademicRuleSchema.safeParse({ ...base, expression: node }).success).toBe(false);
  });
});
