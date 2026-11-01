import type { AcademicRule, AcademicRuleNode } from '../types';

export interface DependencyEdge {
  from: string;
  to: string;
  kind: 'PREREQUISITE' | 'COREQUISITE';
  /** OR means this branch is a possible route, not necessarily mandatory. */
  optional: boolean;
}

export interface DependencyInsight {
  courseId: string;
  directDependents: number;
  downstreamCount: number;
  longestChain: number;
  downstreamIds: string[];
  /** Structural planning indicator, not a university eligibility decision. */
  priorityScore: number;
  depth: number;
}

export interface CurriculumDependencyAnalysis {
  edges: DependencyEdge[];
  insights: DependencyInsight[];
  errors: string[];
  hasChoices: boolean;
  valid: boolean;
}

function sourcesOf(node: AcademicRuleNode, optional = false): { id: string; optional: boolean }[] {
  if (node.type === 'COURSE') return node.courseId ? [{ id: node.courseId, optional }] : [];
  if (node.type !== 'GROUP') return [];
  const nestedChoice = optional || node.operator === 'OR';
  return (node.operands || []).flatMap(child => sourcesOf(child, nestedChoice));
}

/**
 * Computes structural significance over the ENTIRE curriculum, not only the
 * immediately following term. Only verified curriculum membership is accepted.
 * Co-requisites are displayed but excluded from DAG depth and priority.
 *
 * Scores are not eligibility decisions. An OR branch is only a possible route.
 * Invalid or cyclic prerequisite graphs have no published ranking at all.
 */
export function analyzeCurriculumDependencies(
  curriculumId: string,
  courseIds: readonly string[],
  rules: readonly AcademicRule[],
): CurriculumDependencyAnalysis {
  const ids = [...new Set(courseIds.filter(Boolean))];
  const allowed = new Set(ids);
  const errors: string[] = [];
  const unique = new Map<string, DependencyEdge>();
  let hasChoices = false;

  for (const rule of rules) {
    if (rule.curriculumId !== curriculumId || !['PREREQUISITE', 'COREQUISITE'].includes(rule.relationshipType)) continue;
    if (!allowed.has(rule.targetCourseId)) {
      errors.push('قانونی به درسی خارج از چارت انتخابی اشاره دارد.');
      continue;
    }
    const kind = rule.relationshipType as DependencyEdge['kind'];
    for (const source of sourcesOf(rule.expression)) {
      if (!allowed.has(source.id)) {
        errors.push('پیش‌نیاز یا هم‌نیازی در چارت انتخابی وجود ندارد.');
        continue;
      }
      if (source.id === rule.targetCourseId && kind === 'PREREQUISITE') {
        errors.push('یک درس نمی‌تواند پیش‌نیاز خودش باشد.');
        continue;
      }
      hasChoices ||= source.optional;
      const key = [kind, source.id, rule.targetCourseId].join('\u001f');
      const previous = unique.get(key);
      // If any equivalent edge is mandatory, it must not appear optional.
      unique.set(key, { from: source.id, to: rule.targetCourseId, kind,
        optional: previous ? previous.optional && source.optional : source.optional });
    }
  }

  const edges = [...unique.values()].sort((a, b) =>
    (a.from + a.to + a.kind).localeCompare(b.from + b.to + b.kind));
  const outgoing = new Map(ids.map(id => [id, new Set<string>()]));
  const incoming = new Map(ids.map(id => [id, new Set<string>()]));
  for (const edge of edges) {
    if (edge.kind !== 'PREREQUISITE') continue;
    outgoing.get(edge.from)!.add(edge.to);
    incoming.get(edge.to)!.add(edge.from);
  }

  // Kahn's algorithm validates the entire chart and avoids recursive cycles.
  const inDegree = new Map(ids.map(id => [id, incoming.get(id)!.size]));
  const queue = ids.filter(id => inDegree.get(id) === 0).sort();
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const target of [...outgoing.get(id)!].sort()) {
      const next = inDegree.get(target)! - 1;
      inDegree.set(target, next);
      if (next === 0) {
        queue.push(target);
        queue.sort();
      }
    }
  }
  if (order.length !== ids.length) errors.push('در زنجیرهٔ پیش‌نیازها چرخه وجود دارد؛ تا اصلاح چارت، رتبه‌بندی معتبر نیست.');
  if (errors.length) return { edges, insights: [], errors: [...new Set(errors)], valid: false, hasChoices };

  // One reverse-topological pass. A set prevents double-counting on diamonds:
  // A→B→D and A→C→D must count D only once for A.
  const reachable = new Map<string, Set<string>>();
  const longest = new Map<string, number>();
  const depth = new Map<string, number>();
  for (const id of order) {
    depth.set(id, Math.max(0, ...[...incoming.get(id)!].map(source => (depth.get(source) ?? 0) + 1)));
  }
  for (const id of order.reverse()) {
    const all = new Set<string>();
    let length = 0;
    for (const to of outgoing.get(id)!) {
      all.add(to);
      for (const descendant of reachable.get(to) || []) all.add(descendant);
      length = Math.max(length, (longest.get(to) ?? 0) + 1);
    }
    reachable.set(id, all);
    longest.set(id, length);
  }

  const insights = ids.map(courseId => {
    const downstreamIds = [...reachable.get(courseId)!].sort();
    const downstreamCount = downstreamIds.length;
    const longestChain = longest.get(courseId)!;
    return {
      courseId,
      directDependents: outgoing.get(courseId)!.size,
      downstreamCount,
      longestChain,
      downstreamIds,
      priorityScore: Math.min(100, downstreamCount * 6 + longestChain * 10),
      depth: depth.get(courseId)!,
    };
  }).sort((a, b) =>
    b.priorityScore - a.priorityScore || b.downstreamCount - a.downstreamCount ||
    b.longestChain - a.longestChain || a.courseId.localeCompare(b.courseId));

  return { edges, insights, errors: [], hasChoices, valid: true };
}
