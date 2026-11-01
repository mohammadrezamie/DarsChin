import { describe, expect, it } from 'vitest';
import type { AcademicRule } from '../src/types';
import { analyzeCurriculumDependencies } from '../src/domain/course-dependency-insights';
import { draftLinksAsRules, validateDraftLink, type DraftDependencyLink } from '../src/domain/dependency-draft';

const chart='chart-A';
const ids=['A','B','C','D','E'];
const e=(from: string,to: string,kind: DraftDependencyLink['kind']='PREREQUISITE'): DraftDependencyLink=>
  ({from,to,kind});
const rule=(from:string,to:string,kind:DraftDependencyLink['kind']='PREREQUISITE'):AcademicRule=>({
  id:'published-'+from+'-'+to,curriculumId:chart,targetCourseId:to,relationshipType:kind,
  expression:{type:'COURSE',courseId:from},
});

describe('safe editing of academic dependency graph as a temporary draft', () => {
  it('validates a long course chain across the full curriculum', () => {
    const published=[rule('A','B'),rule('B','C')];
    const existingDraft=[e('C','D')];
    const result=validateDraftLink(chart,ids,published,existingDraft,e('D','E'));
    expect(result.ok).toBe(true);
    const preview=analyzeCurriculumDependencies(chart,ids,[
      ...published,...draftLinksAsRules(chart,[...existingDraft,e('D','E')]),
    ]);
    expect(preview.valid).toBe(true);
    expect(preview.insights.find(x=>x.courseId==='A')).toMatchObject({downstreamCount:4,longestChain:4});
    expect(published).toHaveLength(2);
    expect(existingDraft).toHaveLength(1); // No mutation or persistence.
  });

  it('rejects a proposed cycle, including one that closes a 4-course path', () => {
    const published=[rule('A','B'),rule('B','C')];
    const pending=[e('C','D')];
    const result=validateDraftLink(chart,ids,published,pending,e('D','A'));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('چرخه');
  });

  it('refuses duplicate, self and out-of-chart relationships even if input is forged', () => {
    const published=[rule('A','B')];
    expect(validateDraftLink(chart,ids,published,[],e('A','B')).ok).toBe(false);
    expect(validateDraftLink(chart,ids,published,[e('C','D')],e('C','D')).ok).toBe(false);
    expect(validateDraftLink(chart,ids,published,[],e('A','A')).ok).toBe(false);
    expect(validateDraftLink(chart,ids,published,[],e('outside','A')).ok).toBe(false);
    expect(validateDraftLink(chart,ids,published,[],e('A','outside')).ok).toBe(false);
    expect(validateDraftLink('',ids,published,[],e('C','D')).ok).toBe(false);
  });

  it('accepts reciprocal co-requisites but excludes them from prerequisite priority', () => {
    const draft=[e('A','B','COREQUISITE')];
    expect(validateDraftLink(chart,ids,[],draft,e('B','A','COREQUISITE')).ok).toBe(true);
    const result=analyzeCurriculumDependencies(chart,ids,draftLinksAsRules(chart,[
      ...draft,e('B','A','COREQUISITE'),
    ]));
    expect(result.valid).toBe(true);
    expect(result.edges).toHaveLength(2);
    expect(result.insights.find(x=>x.courseId==='A')?.downstreamCount).toBe(0);
  });

  it('rejects additional edits when a published chart is invalid, without hiding the error', () => {
    const bad=[rule('A','B'),rule('B','A')];
    const result=validateDraftLink(chart,ids,bad,[],e('C','D'));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('اصلاح');
  });

  it('isolates drafts to the selected chart and does not promote OR edges to mandatory', () => {
    const other: AcademicRule={id:'other',curriculumId:'chart-B',targetCourseId:'B',
      relationshipType:'PREREQUISITE',expression:{type:'COURSE',courseId:'A'}};
    const or: AcademicRule={id:'or',curriculumId:chart,targetCourseId:'E',relationshipType:'PREREQUISITE',
      expression:{type:'GROUP',operator:'OR',operands:[{type:'COURSE',courseId:'A'}, {type:'COURSE',courseId:'B'}]}};
    const draft=[e('C','D')];
    const result=analyzeCurriculumDependencies(chart,ids,[other,or,...draftLinksAsRules(chart,draft)]);
    expect(result.valid).toBe(true);
    expect(result.edges.some(x=>x.from==='A'&&x.to==='B')).toBe(false);
    expect(result.edges.find(x=>x.from==='B'&&x.to==='E')?.optional).toBe(true);
    expect(result.edges.find(x=>x.from==='C'&&x.to==='D')?.optional).toBe(false);
  });
});
