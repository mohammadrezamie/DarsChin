import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createsPrerequisiteCycle } from '../src/domain/prerequisite-graph';
import type { AcademicRule } from '../src/types';

const makeRule = (target: string, source: string, curriculumId = 'c1', relationshipType: 'PREREQUISITE'|'COREQUISITE' = 'PREREQUISITE'): AcademicRule => ({
  id: target + source, curriculumId, targetCourseId: target, relationshipType,
  expression: { type: 'COURSE', courseId: source },
});

describe('admin prerequisites and curriculum workflow', () => {
  it('accepts a straightforward dependency but blocks true cycles and self-links', () => {
    const rules = [makeRule('b', 'a'), makeRule('c', 'b')];
    expect(createsPrerequisiteCycle('c1', 'd', { type: 'COURSE', courseId: 'c' }, rules)).toBe(false);
    expect(createsPrerequisiteCycle('c1', 'a', { type: 'COURSE', courseId: 'c' }, rules)).toBe(true);
    expect(createsPrerequisiteCycle('c1', 'b', { type: 'COURSE', courseId: 'b' }, rules)).toBe(true);
  });

  it('ignores unrelated cohorts and structural corequisite reciprocity in the prerequisite DAG', () => {
    const rules = [makeRule('b', 'a', 'c2'), makeRule('b', 'a', 'c1', 'COREQUISITE')];
    expect(createsPrerequisiteCycle('c1', 'a', { type: 'COURSE', courseId: 'b' }, rules)).toBe(false);
  });

  it('sends the academic-rule AST the API expects and uses the actual full-curriculum response fields', () => {
    const ui = readFileSync(resolve(process.cwd(), 'src/components/AdminCurriculumBuilder.tsx'), 'utf8');
    const api = readFileSync(resolve(process.cwd(), 'server/routes/curriculum.ts'), 'utf8');
    expect(ui).toContain("expression: { type: 'COURSE', courseId: addRuleForm.sourceCourseId }");
    expect(ui).toContain('curriculumFull.prerequisites');
    expect(ui).toContain('curriculumFull.corequisites');
    expect(ui).not.toContain('curriculumFull.prereqs.filter');
    expect(ui).not.toContain('curriculumFull.coreqs.filter');
    expect(ui).not.toContain('addRuleForm.conditionType');
    expect(api).toContain("status = 'draft'");
    expect(api).toContain("status !== 'draft'");
    expect(api).toContain('validCampus');
    expect(api).toContain('createsPrerequisiteCycle');
  });

  it('does not advertise unverified chart publication as approved to an admin', () => {
    const ui = readFileSync(resolve(process.cwd(), 'src/components/AdminCurriculumBuilder.tsx'), 'utf8');
    expect(ui).toContain('تعریف چارت جدید (فقط پیش‌نویس)');
    expect(ui).toContain('این چارت در نسخه آزمایشی');
  });
});
