import type { CurriculumDependencyAnalysis } from './course-dependency-insights';

export interface GraphChartAssignment {
  courseId: string;
  suggestedSemester?: number;
}
export interface GraphCourseLabel { name: string }
export type DependencyGraphLayoutMode = 'chain' | 'semester';

export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 68;
export const COLUMN_WIDTH = 252;
export const ROW_HEIGHT = 88;

export interface DependencyGraphLayout {
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
  sortedTerms: number[];
  chainModeActive: boolean;
}

/** Pure RTL mind-map geometry. In chain mode every prerequisite edge progresses
 * from a lower DAG layer on the right to a later layer on the left; in term
 * mode columns follow the curriculum's proposed semesters instead.
 * Invalid graphs deliberately fall back to semesters without inventing depth.
 */
export function layoutDependencyGraph(
  assignments: readonly GraphChartAssignment[],
  courseMap: ReadonlyMap<string, GraphCourseLabel>,
  analysis: CurriculumDependencyAnalysis,
  mode: DependencyGraphLayoutMode,
): DependencyGraphLayout {
  const groups = new Map<number, string[]>();
  const insights = new Map(analysis.insights.map(item => [item.courseId, item]));
  const chainModeActive = mode === 'chain' && analysis.valid;

  for (const assignment of assignments) {
    if (!courseMap.has(assignment.courseId)) continue;
    const insight = insights.get(assignment.courseId);
    const column = chainModeActive && insight
      ? insight.depth + 1
      : Math.max(1, Math.min(16, Math.round(Number(assignment.suggestedSemester) || 1)));
    const list = groups.get(column) ?? [];
    if (!list.includes(assignment.courseId)) list.push(assignment.courseId);
    groups.set(column, list);
  }

  const sortedTerms = [...groups.keys()].sort((a, b) => a - b);
  const positions = new Map<string, { x: number; y: number }>();
  sortedTerms.forEach((term, column) => {
    (groups.get(term) ?? [])
      .sort((a,b) =>
        chainModeActive
          ? (insights.get(b)?.downstreamCount ?? 0) - (insights.get(a)?.downstreamCount ?? 0) ||
            (courseMap.get(a)?.name ?? '').localeCompare(courseMap.get(b)?.name ?? '', 'fa')
          : (courseMap.get(a)?.name ?? '').localeCompare(courseMap.get(b)?.name ?? '', 'fa'))
      .forEach((id, row) => positions.set(id, {
        x: 24 + (sortedTerms.length - 1 - column) * COLUMN_WIDTH,
        y: 64 + row * ROW_HEIGHT,
      }));
  });

  return {
    positions,
    width: Math.max(500, sortedTerms.length * COLUMN_WIDTH + 32),
    height: Math.max(220, 88 + Math.max(0, ...[...groups.values()].map(items => items.length)) * ROW_HEIGHT),
    sortedTerms,
    chainModeActive,
  };
}
