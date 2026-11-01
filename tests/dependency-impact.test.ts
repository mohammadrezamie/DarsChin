import { describe, expect, it } from 'vitest';
import type { AcademicRule, AcademicRuleNode } from '../src/types';
import { analyzeDependencyImpact } from '../src/domain/dependency-impact';

const course = (id: string): AcademicRuleNode => ({type:'COURSE',courseId:id});
const rule = (source: string, target: string, relation: AcademicRule['relationshipType'] = 'PREREQUISITE'): AcademicRule => ({
  id: `rule-${source}-${target}`, curriculumId:'chart-electric', targetCourseId:target,
  relationshipType:relation, expression:course(source),
});

describe('whole-curriculum academic dependency impact', () => {
  it('counts the entire downstream chain, not only next-term direct prerequisites', () => {
    // A -> B -> C, D, E, F. A directly unlocks only one, but indirectly five.
    const rules = [rule('A','B'),rule('B','C'),rule('B','D'),rule('B','E'),rule('B','F')];
    const result = analyzeDependencyImpact('chart-electric', ['A','B','C','D','E','F','X'], rules);
    expect(result.valid).toBe(true);
    expect(result.items[0]).toMatchObject({courseId:'A',directUnlocks:1,downstreamUnlocks:5,longestChain:2});
    expect(result.items.find(x=>x.courseId==='B')).toMatchObject({directUnlocks:4,downstreamUnlocks:4,longestChain:1});
    expect(result.items.find(x=>x.courseId==='X')).toMatchObject({directUnlocks:0,downstreamUnlocks:0,longestChain:0});
  });

  it('counts converging branches only once and ignores unrelated curricula', () => {
    const rules = [rule('A','B'),rule('A','C'),rule('B','D'),rule('C','D'),{
      ...rule('A','E'),curriculumId:'unrelated',
    }];
    const result = analyzeDependencyImpact('chart-electric',['A','B','C','D','E'],rules);
    expect(result.items.find(x=>x.courseId==='A')?.downstreamUnlocks).toBe(3);
    expect(result.items.find(x=>x.courseId==='A')?.longestChain).toBe(2);
  });

  it('does not treat corequisites as directed blocking prerequisites', () => {
    const rules = [rule('A','B','COREQUISITE'),rule('B','C')];
    const result = analyzeDependencyImpact('chart-electric',['A','B','C'],rules);
    expect(result.items.find(x=>x.courseId==='A')?.downstreamUnlocks).toBe(0);
    expect(result.items.find(x=>x.courseId==='B')?.downstreamUnlocks).toBe(1);
  });

  it('marks OR prerequisites as possible impact rather than guaranteed unlocking', () => {
    const rules:AcademicRule[] = [{
      id:'optional',curriculumId:'chart-electric',targetCourseId:'B',
      relationshipType:'PREREQUISITE',
      expression:{type:'GROUP',operator:'OR',operands:[course('A'),course('X')]},
    }];
    const report = analyzeDependencyImpact('chart-electric',['A','X','B'],rules);
    expect(report.items.find(x=>x.courseId==='A')).toMatchObject({downstreamUnlocks:1,possibleNotGuaranteed:true});
    expect(report.items.find(x=>x.courseId==='X')).toMatchObject({downstreamUnlocks:1,possibleNotGuaranteed:true});
  });

  it('refuses ranking a corrupt cyclic graph and reports missing chart references', () => {
    const circular = analyzeDependencyImpact('chart-electric',['A','B','C'],[
      rule('A','B'),rule('B','C'),rule('C','A'),rule('unknown','B'),
    ]);
    expect(circular.valid).toBe(false);
    expect(circular.cycles).toEqual(['A','B','C']);
    expect(circular.items).toHaveLength(0);
    expect(circular.unresolvedCourseIds).toEqual(['unknown']);
  });
});
