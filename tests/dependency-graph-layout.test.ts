import { describe, it, expect } from 'vitest';
import { analyzeCurriculumDependencies } from '../src/domain/course-dependency-insights';
import { layoutDependencyGraph, NODE_WIDTH, COLUMN_WIDTH } from '../src/domain/dependency-graph-layout';
import type { AcademicRule } from '../src/types';

const rule = (from: string, to: string): AcademicRule => ({
  id: 'rule-' + from + '-' + to,
  curriculumId: 'chart', targetCourseId: to,
  relationshipType: 'PREREQUISITE', expression: { type: 'COURSE', courseId: from },
});
const courses = new Map(['a','b','c','d','e'].map(id => [id, { name: 'درس ' + id }]));

describe('RTL graph layout based on the entire prerequisite DAG', () => {
  it('puts four linked course levels from right to left regardless of suggested semester', () => {
    const ids = ['a','b','c','d'];
    const graph = analyzeCurriculumDependencies('chart', ids,
      [rule('a','b'), rule('b','c'), rule('c','d')]);
    const rows = ids.map((id,i) => ({ courseId:id, suggestedSemester: 4 - i }));
    const chain = layoutDependencyGraph(rows,courses,graph,'chain');
    expect(chain.chainModeActive).toBe(true);
    expect(chain.sortedTerms).toEqual([1,2,3,4]);
    expect(chain.positions.get('a')!.x).toBeGreaterThan(chain.positions.get('b')!.x);
    expect(chain.positions.get('b')!.x).toBeGreaterThan(chain.positions.get('c')!.x);
    expect(chain.positions.get('c')!.x).toBeGreaterThan(chain.positions.get('d')!.x);
    expect(chain.positions.get('d')!.x + NODE_WIDTH).toBeLessThan(chain.positions.get('c')!.x);
    expect(chain.width).toBeGreaterThan(4 * COLUMN_WIDTH);
  });

  it('semester mode displays the stored curriculum columns without confusing them with graph depth', () => {
    const ids = ['a','b','c'];
    const graph = analyzeCurriculumDependencies('chart', ids,
      [rule('a','b'),rule('b','c')]);
    const rows = [{courseId:'a', suggestedSemester:6},
      {courseId:'b',suggestedSemester:1},{courseId:'c',suggestedSemester:3}];
    const term = layoutDependencyGraph(rows,courses,graph,'semester');
    expect(term.chainModeActive).toBe(false);
    expect(term.sortedTerms).toEqual([1,3,6]);
    expect(term.positions.get('b')!.x).toBeGreaterThan(term.positions.get('a')!.x);
  });

  it('deduplicates assignments and sorts high-impact siblings by future dependencies', () => {
    const ids = ['a','b','c','d','e'];
    const graph = analyzeCurriculumDependencies('chart', ids,
      [rule('a','b'),rule('a','c'),rule('b','d'),rule('d','e')]);
    const rows = [...ids.map(courseId => ({courseId,suggestedSemester:1})),
      {courseId:'a',suggestedSemester:6}];
    const chain=layoutDependencyGraph(rows,courses,graph,'chain');
    expect(chain.positions.size).toBe(5);
    expect(chain.positions.get('b')!.x).toBe(chain.positions.get('c')!.x);
    expect(chain.positions.get('b')!.y).toBeLessThan(chain.positions.get('c')!.y);
  });

  it('does not invent chain positions for a cyclic graph', () => {
    const ids = ['a','b','c'];
    const cyclic = analyzeCurriculumDependencies('chart',ids,
      [rule('a','b'),rule('b','c'),rule('c','a')]);
    expect(cyclic.valid).toBe(false);
    const layout=layoutDependencyGraph(ids.map(courseId=>({courseId,suggestedSemester:3})),courses,cyclic,'chain');
    expect(layout.chainModeActive).toBe(false);
    expect(layout.sortedTerms).toEqual([3]);
    expect(layout.positions.size).toBe(3);
  });

  it('lays out a long graduation path without duplicating or losing nodes', () => {
    const ids = Array.from({ length: 120 }, (_, i) => 'level-' + i);
    const graph = analyzeCurriculumDependencies('chart', ids,
      ids.slice(1).map((id, i) => rule(ids[i], id)));
    expect(graph.valid).toBe(true);
    const catalog = new Map(ids.map(id => [id, {name:id}]));
    const layout = layoutDependencyGraph(ids.map(courseId => ({courseId, suggestedSemester:1})),
      catalog, graph, 'chain');
    expect(layout.positions.size).toBe(120);
    expect(layout.sortedTerms).toHaveLength(120);
    expect(layout.positions.get(ids[0])!.x).toBeGreaterThan(layout.positions.get(ids[119])!.x);
    expect(new Set([...layout.positions.values()].map(p => p.x + '/' + p.y)).size).toBe(120);
  });

  it('handles empty charts and missing courses without throwing', () => {
    const graph = analyzeCurriculumDependencies('chart',[],[]);
    const layout=layoutDependencyGraph([{courseId:'missing',suggestedSemester:1}],courses,graph,'chain');
    expect(layout.positions.size).toBe(0);
    expect(layout.width).toBeGreaterThanOrEqual(500);
    expect(layout.height).toBeGreaterThanOrEqual(220);
  });
});
