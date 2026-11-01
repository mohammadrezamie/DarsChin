import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AcademicRule, AcademicRuleNode } from '../src/types';
import { analyzeCurriculumDependencies } from '../src/domain/course-dependency-insights';
import { AdminDependencyMap } from '../src/components/AdminDependencyMap';

const course = (id: string): AcademicRuleNode => ({ type: 'COURSE', courseId: id });
const rule = (id: string, from: AcademicRuleNode, to: string,
  kind: AcademicRule['relationshipType'] = 'PREREQUISITE', chart = 'chart-A'): AcademicRule =>
  ({ id, curriculumId: chart, targetCourseId: to, relationshipType: kind, expression: from });
const insight = (result: ReturnType<typeof analyzeCurriculumDependencies>, id: string) =>
  result.insights.find(x => x.courseId === id)!;

describe('whole-curriculum prerequisite impact — not only next semester', () => {
  it('counts every reachable course and longest future chain to graduation', () => {
    const rules = [rule('1',course('A'),'B'),rule('2',course('B'),'C'),rule('3',course('C'),'D')];
    const result = analyzeCurriculumDependencies('chart-A',['A','B','C','D','E'],rules);
    expect(result.valid).toBe(true);
    expect(insight(result,'A')).toMatchObject({directDependents:1,downstreamCount:3,longestChain:3,depth:0});
    expect(insight(result,'B')).toMatchObject({downstreamCount:2,longestChain:2,depth:1});
    expect(insight(result,'D')).toMatchObject({downstreamCount:0,longestChain:0,depth:3});
    expect(insight(result,'E').priorityScore).toBe(0);
    expect(insight(result,'A').priorityScore).toBeGreaterThan(insight(result,'B').priorityScore);
  });

  it('does not double count a target reached through multiple prerequisite paths (diamond)', () => {
    const rules = [
      rule('a',course('A'),'B'),rule('b',course('A'),'C'),
      rule('c',course('B'),'D'),rule('d',course('C'),'D'),
    ];
    const result = analyzeCurriculumDependencies('chart-A',['A','B','C','D'],rules);
    expect(insight(result,'A').downstreamIds).toEqual(['B','C','D']);
    expect(insight(result,'A').downstreamCount).toBe(3);
    expect(insight(result,'A').longestChain).toBe(2);
  });

  it('raises a gateway course above a dead-end course with the same direct dependent count', () => {
    const rules = [
      rule('1',course('gateway'),'core'),
      rule('2',course('core'),'senior1'),
      rule('3',course('core'),'senior2'),
      rule('4',course('shallow'),'end'),
    ];
    const result = analyzeCurriculumDependencies('chart-A',
      ['gateway','core','senior1','senior2','shallow','end'],rules);
    expect(insight(result,'gateway').directDependents).toBe(1);
    expect(insight(result,'shallow').directDependents).toBe(1);
    expect(insight(result,'gateway').downstreamCount).toBe(3);
    expect(insight(result,'gateway').priorityScore).toBeGreaterThan(insight(result,'shallow').priorityScore);
  });

  it('does not count corequisites as DAG edges, and permits their reciprocal relationship', () => {
    const rules = [rule('1',course('A'),'B','COREQUISITE'),rule('2',course('B'),'A','COREQUISITE')];
    const result = analyzeCurriculumDependencies('chart-A',['A','B'],rules);
    expect(result.valid).toBe(true);
    expect(result.edges).toHaveLength(2);
    expect(insight(result,'A').downstreamCount).toBe(0);
    expect(insight(result,'B').longestChain).toBe(0);
  });

  it('rejects cyclic and self-referential prerequisite chains instead of publishing scores', () => {
    const cyclic = analyzeCurriculumDependencies('chart-A',['A','B'],[
      rule('1',course('A'),'B'),rule('2',course('B'),'A'),
    ]);
    expect(cyclic.valid).toBe(false);
    expect(cyclic.insights).toEqual([]);
    expect(cyclic.errors.join(' ')).toContain('چرخه');
    const self = analyzeCurriculumDependencies('chart-A',['A'],[rule('self',course('A'),'A')]);
    expect(self.valid).toBe(false);
    expect(self.insights).toHaveLength(0);
  });

  it('rejects stale source/target references and isolates other curricula', () => {
    const other = rule('out',course('A'),'B','PREREQUISITE','chart-B');
    const empty = analyzeCurriculumDependencies('chart-A',['A','B'],[other]);
    expect(empty.valid).toBe(true);
    expect(insight(empty,'A').downstreamCount).toBe(0);
    const missingSource = analyzeCurriculumDependencies('chart-A',['A','B'],[rule('x',course('unknown'),'B')]);
    expect(missingSource.valid).toBe(false);
    expect(missingSource.insights).toEqual([]);
    const missingTarget = analyzeCurriculumDependencies('chart-A',['A'],[rule('x',course('A'),'not-in-chart')]);
    expect(missingTarget.valid).toBe(false);
  });

  it('marks OR branches as possible influence and deduplicates equal edges', () => {
    const choice: AcademicRuleNode = {
      type:'GROUP',operator:'OR',operands:[course('A'),course('B')],
    };
    const res = analyzeCurriculumDependencies('chart-A',['A','B','C'],[
      rule('or',choice,'C'),rule('and',course('A'),'C'),
    ]);
    expect(res.hasChoices).toBe(true);
    expect(res.edges).toHaveLength(2);
    expect(res.edges.find(x=>x.from==='A')?.optional).toBe(false);
    expect(res.edges.find(x=>x.from==='B')?.optional).toBe(true);
  });

  it('returns structural scores deterministically for unconnected courses', () => {
    const res = analyzeCurriculumDependencies('chart-A',['C','A','B','A'],[]);
    expect(res.valid).toBe(true);
    expect(res.edges).toEqual([]);
    expect(res.insights.map(x=>x.courseId)).toEqual(['A','B','C']);
    expect(res.insights.every(x=>x.priorityScore===0 && x.longestChain===0)).toBe(true);
  });

  it('makes the admin visualization selectable, RTL, accessible and transparent about read-only status', () => {
    const html = renderToStaticMarkup(
      <AdminDependencyMap rules={[]} courses={[]} curricula={[]} />,
    );
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('نقشهٔ وابستگی درس‌ها');
    expect(html).toContain('انتخاب چارت نقشهٔ وابستگی');
    expect(html).toContain('روی دو درس پشت‌سرهم بزن');
    expect(readFileSync(resolve(process.cwd(),'src/components/AdminDependencyMap.tsx'),'utf8')).toContain('افزودن به پیش‌نویس');
    const admin = readFileSync(resolve(process.cwd(),'src/components/AdminAcademicRules.tsx'),'utf8');
    expect(admin).toContain('<AdminDependencyMap rules={rules} courses={courses} curricula={curricula} />');
    expect(admin).not.toContain('JSON.stringify(rule.expression, null, 2)');
    expect(admin).toContain('describeExpression(rule.expression)');
  });
});
