import type { CurriculumDependencyAnalysis, DependencyEdge } from './course-dependency-insights';

export interface RemainingGraduationPath {
  courseId: string;
  /** Reachable unfinished courses through paths with no OR selection. Not a
   * statement that the downstream course itself is required for graduation. */
  noChoiceFutureCourseIds: string[];
  /** Unfinished courses reachable exclusively through at least one OR edge. */
  choiceOnlyFutureCourseIds: string[];
  /** Longest number of UNFINISHED downstream courses on a single path.
   * Completed intermediates remain traversable, but do not consume a step. */
  longestRemainingChain: number;
  longestNoChoiceRemainingChain: number;
}

/** Analyze ALL future dependency chains, including ones crossing completed
 * courses, without treating OR alternatives as unavoidable bottlenecks.
 * Co-requisites must not influence priority. Invalid charts never yield
 * personal recommendations disguised as a verified graduation plan.
 */
export function analyzeRemainingGraduationPaths(
  graph: CurriculumDependencyAnalysis,
  completedCourseIds: ReadonlySet<string>,
): ReadonlyMap<string, RemainingGraduationPath> {
  if (!graph.valid) return new Map();
  const nodes = graph.insights.map(row => row.courseId);
  const outgoing = new Map<string, DependencyEdge[]>(nodes.map(id => [id, []]));
  for (const edge of graph.edges) {
    if (edge.kind === 'PREREQUISITE' && outgoing.has(edge.from) && outgoing.has(edge.to)) {
      outgoing.get(edge.from)!.push(edge);
    }
  }

  // Graph.depth is topological; process successors before their parents.
  const reverse = [...graph.insights].sort((a,b) => b.depth - a.depth);
  const remainingLongest = new Map<string, number>();
  const noChoiceLongest = new Map<string, number>();
  for (const node of reverse) {
    let longest = 0;
    let noChoice = 0;
    for (const edge of outgoing.get(node.courseId) ?? []) {
      const increment = completedCourseIds.has(edge.to) ? 0 : 1;
      longest = Math.max(longest, increment + (remainingLongest.get(edge.to) ?? 0));
      if (!edge.optional) {
        noChoice = Math.max(noChoice, increment + (noChoiceLongest.get(edge.to) ?? 0));
      }
    }
    remainingLongest.set(node.courseId, longest);
    noChoiceLongest.set(node.courseId, noChoice);
  }

  const result = new Map<string, RemainingGraduationPath>();
  for (const root of nodes) {
    const withoutChoice = new Set<string>();
    const withChoice = new Set<string>();
    const visitedMandatory = new Set<string>();
    const visitedOptional = new Set<string>();
    const queue: { id: string; selectedChoice: boolean }[] = (outgoing.get(root) ?? [])
      .map(edge => ({ id: edge.to, selectedChoice: edge.optional }));
    for (let index = 0; index < queue.length; index++) {
      const { id, selectedChoice } = queue[index];
      const visited = selectedChoice ? visitedOptional : visitedMandatory;
      if (visited.has(id)) continue;
      visited.add(id);
      if (!completedCourseIds.has(id)) {
        (selectedChoice ? withChoice : withoutChoice).add(id);
      }
      // Even a passed middle node may lead to unfinished successors.
      for (const edge of outgoing.get(id) ?? []) {
        queue.push({ id: edge.to, selectedChoice: selectedChoice || edge.optional });
      }
    }
    result.set(root, {
      courseId: root,
      noChoiceFutureCourseIds: [...withoutChoice].sort(),
      choiceOnlyFutureCourseIds: [...withChoice].filter(id => !withoutChoice.has(id)).sort(),
      longestRemainingChain: remainingLongest.get(root) ?? 0,
      longestNoChoiceRemainingChain: noChoiceLongest.get(root) ?? 0,
    });
  }
  return result;
}
