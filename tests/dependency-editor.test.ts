import { describe, expect, it } from 'vitest';
import type { AcademicRule } from '../src/types';
import { assessDependencyDraft } from '../src/domain/dependency-editor';

const ids = ['a', 'b', 'c', 'd', 'e'];
const rule = (source: string, target: string, curriculumId = 'chart'): AcademicRule => ({
  id: 'rule-' + source + target,
  curriculumId,
  targetCourseId: target,
  relationshipType: 'PREREQUISITE',
  expression: { type: 'COURSE', courseId: source },
});

describe('visual admin dependency editor: safe draft links', () => {
  it('accepts long transitive prerequisite chains across all terms', () => {
    const rules = [rule('a', 'b'), rule('b', 'c'), rule('c', 'd')];
    expect(assessDependencyDraft('chart', ids, rules, 'd', 'e', 'PREREQUISITE').valid).toBe(true);
  });

  it('rejects indirect cycles, not only direct inverse links', () => {
    const rules = [rule('a', 'b'), rule('b', 'c'), rule('c', 'd')];
    const result = assessDependencyDraft('chart', ids, rules, 'd', 'a', 'PREREQUISITE');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('چرخه');
  });

  it('rejects a self-link, a missing source and an off-chart target', () => {
    expect(assessDependencyDraft('chart', ids, [], 'a', 'a', 'COREQUISITE').valid).toBe(false);
    expect(assessDependencyDraft('chart', ids, [], '', 'a', 'PREREQUISITE').valid).toBe(false);
    expect(assessDependencyDraft('chart', ids, [], 'a', 'off-chart', 'PREREQUISITE').valid).toBe(false);
  });

  it('rejects repeated rules, including an edge embedded in an OR group', () => {
    const direct = assessDependencyDraft('chart', ids, [rule('a', 'b')], 'a', 'b', 'PREREQUISITE');
    expect(direct.valid).toBe(false);
    const group: AcademicRule = {
      id: 'group', curriculumId: 'chart', targetCourseId: 'b', relationshipType: 'PREREQUISITE',
      expression: { type: 'GROUP', operator: 'OR', operands: [
        { type: 'COURSE', courseId: 'a' }, { type: 'COURSE', courseId: 'c' },
      ] },
    };
    const complex = assessDependencyDraft('chart', ids, [group], 'a', 'b', 'PREREQUISITE');
    expect(complex.valid).toBe(false);
    expect(complex.error).toContain('ترکیبی');
  });

  it('allows reciprocal co-requisites but never lets them affect prerequisite cycles', () => {
    const co: AcademicRule = {
      id: 'co', curriculumId: 'chart', targetCourseId: 'a', relationshipType: 'COREQUISITE',
      expression: { type: 'COURSE', courseId: 'b' },
    };
    expect(assessDependencyDraft('chart', ids, [co], 'a', 'b', 'COREQUISITE').valid).toBe(true);
    expect(assessDependencyDraft('chart', ids, [co], 'a', 'b', 'PREREQUISITE').valid).toBe(true);
  });

  it('isolates curricula before checking duplicates and cycle paths', () => {
    expect(assessDependencyDraft('chart', ids, [rule('a', 'b', 'other')], 'a', 'b', 'PREREQUISITE').valid).toBe(true);
  });

  it('blocks new links while the chart already contains broken prerequisites', () => {
    const broken = rule('off-chart', 'b');
    const outcome = assessDependencyDraft('chart', ids, [broken], 'a', 'c', 'PREREQUISITE');
    expect(outcome.valid).toBe(false);
    expect(outcome.error).toContain('خطاهای روابط فعلی');
  });
});
