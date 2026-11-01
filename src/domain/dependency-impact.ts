import type { AcademicRule } from '../types';
import { extractSourceCourseIds } from '../utils/academic';

export interface CourseDependencyImpact {
  courseId: string;
  directUnlocks: number;
  /** Unique reachable descendants, across the ENTIRE chart (not just next term). */
  downstreamUnlocks: number;
  longestChain: number;
  /** OR conditions and individual university overrides mean this is indicative, not an eligibility promise. */
  possibleNotGuaranteed: boolean;
}

export interface DependencyImpactReport {
  valid: boolean;
  /** A detected legacy cycle disables ranking until an administrator reviews the data. */
  cycles: string[];
  unresolvedCourseIds: string[];
  items: CourseDependencyImpact[];
}

/**
 * Map every PREREQUISITE source -> all courses that may depend on it.
 *
 * The metric is the number of DISTINCT downstream courses, across every
 * remaining term. This is potential impact for admin planning, NOT guaranteed
 * eligibility or a student grade prediction. OR groups are conservatively
 * included as possible edges. Corequisites never impose directed order.
 */
export function analyzeDependencyImpact(
  curriculumId: string,
  chartCourseIds: readonly string[],
  rules: readonly AcademicRule[],
): DependencyImpactReport {
  const ids = [...new Set(chartCourseIds.filter(Boolean))];
  const known = new Set(ids);
  const outgoing = new Map(ids.map(id => [id, new Set<string>()]));
  const unresolved = new Set<string>();
  const possible = new Set<string>();

  for (const rule of rules) {
    if (rule.curriculumId !== curriculumId || rule.relationshipType !== 'PREREQUISITE') continue;
    const sources = [...new Set(extractSourceCourseIds(rule.expression))];
    if (!known.has(rule.targetCourseId)) {
      unresolved.add(rule.targetCourseId);
      continue;
    }
    // A condition involving OR cannot promise unlocking this target when one
    // specific prerequisite is completed. Still show its possible impact.
    const isConditional = (node: typeof rule.expression): boolean =>
      node.type === 'GROUP' &&
      (node.operator === 'OR' || Boolean(node.operands?.some(isConditional)));
    if (isConditional(rule.expression)) for (const source of sources) possible.add(source);
    for (const source of sources) {
      if (!known.has(source)) { unresolved.add(source); continue; }
      outgoing.get(source)!.add(rule.targetCourseId);
    }
  }

  // A cycle is a data issue. No course in an invalid graph should be presented
  // as ranked, because descendants / path depth would be misleading.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles = new Set<string>();
  const path: string[] = [];
  const findCycles = (id: string): void => {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      path.slice(start).forEach(member => cycles.add(member));
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    path.push(id);
    for (const next of outgoing.get(id) || []) findCycles(next);
    path.pop();
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) findCycles(id);
  if (cycles.size) {
    return { valid: false, cycles: [...cycles].sort(), unresolvedCourseIds: [...unresolved].sort(), items: [] };
  }

  const depthMemo = new Map<string, number>();
  const depth = (id: string): number => {
    const existing = depthMemo.get(id);
    if (existing !== undefined) return existing;
    const value = Math.max(0, ...[...(outgoing.get(id) || [])].map(next => 1 + depth(next)));
    depthMemo.set(id, value);
    return value;
  };
  const items = ids.map(courseId => {
    const seen = new Set<string>();
    const pending = [...(outgoing.get(courseId) || [])];
    while (pending.length) {
      const next = pending.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      for (const dependent of outgoing.get(next) || []) pending.push(dependent);
    }
    return {
      courseId,
      directUnlocks: outgoing.get(courseId)?.size ?? 0,
      downstreamUnlocks: seen.size,
      longestChain: depth(courseId),
      possibleNotGuaranteed: possible.has(courseId),
    };
  }).sort((a,b) => b.downstreamUnlocks - a.downstreamUnlocks ||
    b.longestChain - a.longestChain || a.courseId.localeCompare(b.courseId));

  return { valid: true, cycles: [], unresolvedCourseIds: [...unresolved].sort(), items };
}
