import { describe, expect, it } from 'vitest';
import type { AcademicRule, AcademicRuleNode } from '../src/types';
import { analyzeCurriculumDependencies } from '../src/domain/course-dependency-impact';

const course = (id: string): AcademicRuleNode => ({ type: 'COURSE', courseId: id });
const rule = (
  source: AcademicRuleNode, target: string,
  kind: AcademicRule['relationshipType'] = 'PREREQUISITE',
  curriculumId = 'electrical-1403',
): AcademicRule => ({
  id: `${curriculumId}:${target}:${kind}`,
  curriculumId, targetCourseId: target, relationshipType: kind,
  expression: source,
});
const all = (ids: string[], rules: AcademicRule[]) =>
  analyzeCurriculumDependencies('electrical-1403', ids, rules);
const impact = (analysis: ReturnType<typeof all>, id: string) =>
  analysis.impacts.find(item => item.courseId === id)!;

describe('whole-program curriculum prerequisite importance', () => {
  it('looks through every semester rather than only direct dependents', () => {
    const output = all(['A','B','C','D','X','Y'], [
      rule(course('A'),'B'), rule(course('B'),'C'),
      rule(course('C'),'D'), rule(course('X'),'Y'),
    ]);
    expect(impact(output,'A')).toMatchObject({
      downstreamCount: 3, longestChain: 3, directDependents: 1,
    });
    expect(impact(output,'X')).toMatchObject({
      downstreamCount: 1, longestChain: 1,
    });
    expect(output.impacts[0].courseId).toBe('A');
  });

  it('deduplicates diamond-shaped downstream paths so importance is not inflated', () => {
    const output = all(['A','B','C','D','E'], [
      rule(course('A'),'B'),rule(course('A'),'C'),
      rule(course('B'),'D'),rule(course('C'),'D'),rule(course('D'),'E'),
    ]);
    expect(impact(output,'A').downstreamCourseIds).toEqual(['B','C','D','E']);
    expect(impact(output,'A')).toMatchObject({
      downstreamCount: 4, longestChain: 3, directDependents: 2,
    });
  });

  it('handles a prerequisite of a heavily connected course', () => {
    const output = all(['root','hub','p','q','r','s','z'], [
      rule(course('root'),'hub'),
      ...['p','q','r','s','z'].map(child => rule(course('hub'),child)),
    ]);
    expect(impact(output,'root').downstreamCount).toBe(6);
    expect(impact(output,'hub').downstreamCount).toBe(5);
    expect(output.impacts[0].courseId).toBe('root');
  });

  it('does not count corequisites as forced prerequisite chains, even when mutual', () => {
    const output = all(['A','B','C'], [
      rule(course('A'),'B','COREQUISITE'),
      rule(course('B'),'A','COREQUISITE'),
      rule(course('B'),'C'),
    ]);
    expect(output.links).toHaveLength(3);
    expect(impact(output,'A').downstreamCount).toBe(0);
    expect(impact(output,'B').downstreamCount).toBe(1);
    expect(output.links.filter(e=>e.kind==='COREQUISITE')).toHaveLength(2);
  });

  it('indicates OR branches are potential paths, not certain course requirements', () => {
    const output = all(['A','B','C','D'], [
      rule({type:'GROUP',operator:'OR',operands:[course('A'),course('B')]},'C'),
      rule(course('C'),'D'),
    ]);
    expect(output.hasAlternativeRules).toBe(true);
    expect(output.links.filter(l=>l.target==='C')).toHaveLength(2);
    expect(output.links.filter(l=>l.target==='C').every(l=>l.conditional)).toBe(true);
    expect(impact(output,'A').downstreamCount).toBe(2);
    expect(impact(output,'B').downstreamCount).toBe(2);
  });

  it('never mixes rules from another curriculum or unrelated contextual-retake rules', () => {
    const output = all(['A','B','C'], [
      rule(course('A'),'B'),
      rule(course('B'),'C','PREREQUISITE','another-curriculum'),
      rule(course('B'),'C','CONTEXTUAL_RETAKE_RULE'),
    ]);
    expect(impact(output,'A').downstreamCount).toBe(1);
    expect(output.links).toHaveLength(1);
  });

  it('rejects malformed graph edges to another curriculum instead of showing fake ranks', () => {
    expect(() => all(['A','B'],[rule(course('missing'),'B')])).toThrow('خارج از این چارت');
    expect(() => all(['A','B'],[rule(course('A'),'missing')])).toThrow('خارج از چارت');
  });

  it('rejects prerequisite cycles and self links while allowing corequisite cycles', () => {
    expect(() => all(['A','B'],[
      rule(course('A'),'B'),rule(course('B'),'A'),
    ])).toThrow('حلقه');
    expect(() => all(['A'],[rule(course('A'),'A')])).toThrow('حلقه');
    expect(() => all(['A','B'],[
      rule(course('A'),'B','COREQUISITE'),rule(course('B'),'A','COREQUISITE'),
    ])).not.toThrow();
  });

  it('keeps isolated classes visible with a zero score and no dependency chain', () => {
    const output = all(['isolated'],[]);
    expect(output.impacts).toEqual([{
      courseId:'isolated',downstreamCount:0,longestChain:0,
      directDependents:0,downstreamCourseIds:[],score:0,
    }]);
  });

  it('deduplicates duplicate prerequisite rules and their effects', () => {
    const output = all(['A','B'],[rule(course('A'),'B'),rule(course('A'),'B')]);
    expect(output.links).toHaveLength(1);
    expect(impact(output,'A').downstreamCount).toBe(1);
  });
});
