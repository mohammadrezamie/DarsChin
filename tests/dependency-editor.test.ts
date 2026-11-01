import { describe, expect, it } from 'vitest';
import type { AcademicRule } from '../src/types';
import { assessDependencyDraft, findRemovableDirectDependency } from '../src/domain/dependency-editor';

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


describe('safe visual graph unlink', () => {
  it('resolves one ordinary standalone prerequisite rule', () => {
    const direct = rule('a', 'b');
    expect(findRemovableDirectDependency([direct], 'chart', 'a', 'b', 'PREREQUISITE')?.id).toBe(direct.id);
  });

  it('never deletes an OR/AND group when a drawn edge is selected', () => {
    const mixed: AcademicRule = {
      id: 'compound', curriculumId: 'chart', targetCourseId: 'b',
      relationshipType: 'PREREQUISITE',
      expression: { type: 'GROUP', operator: 'OR', operands: [
        { type: 'COURSE', courseId: 'a' },
        { type: 'GROUP', operator: 'AND', operands: [{ type: 'COURSE', courseId: 'c' }] },
      ] },
    };
    expect(findRemovableDirectDependency([mixed], 'chart', 'a', 'b', 'PREREQUISITE')).toBeNull();
    expect(findRemovableDirectDependency([mixed], 'chart', 'c', 'b', 'PREREQUISITE')).toBeNull();
  });

  it('never guesses which rule to delete when scoped rules share an edge', () => {
    const a = rule('a', 'b');
    const b = { ...a, id: 'scoped', trackId: 'track-1' };
    expect(findRemovableDirectDependency([a, b], 'chart', 'a', 'b', 'PREREQUISITE')).toBeNull();
  });

  it('keeps corequisites, different directions and different curricula separate', () => {
    const direct = rule('a', 'b');
    const other = rule('a', 'b', 'other');
    expect(findRemovableDirectDependency([direct, other], 'chart', 'a', 'b', 'COREQUISITE')).toBeNull();
    expect(findRemovableDirectDependency([direct, other], 'chart', 'b', 'a', 'PREREQUISITE')).toBeNull();
    expect(findRemovableDirectDependency([direct, other], 'other', 'a', 'b', 'PREREQUISITE')?.id).toBe(other.id);
  });
});
