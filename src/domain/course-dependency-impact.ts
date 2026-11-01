import type { AcademicRule, AcademicRuleNode } from '../types';
import { extractSourceCourseIds } from '../utils/academic';

export type DependencyLink = {
  source: string;
  target: string;
  kind: 'PREREQUISITE' | 'COREQUISITE';
  /** OR relationships are possible dependencies, not unconditional requirements. */
  conditional: boolean;
};

export type CourseImpact = {
  courseId: string;
  /** Count of unique courses anywhere downstream, not only the next semester. */
  downstreamCount: number;
  /** Longest chain of prerequisites to a later course. */
  longestChain: number;
  directDependents: number;
  downstreamCourseIds: string[];
  /** Relative planning signal, NOT a permission to enroll in a course. */
  score: number;
};

export type DependencyAnalysis = {
  links: DependencyLink[];
  impacts: CourseImpact[];
  hasAlternativeRules: boolean;
};

/** An OR group cannot be turned into an unconditional prerequisite edge. */
function containsOr(node: AcademicRuleNode): boolean {
  return node.type === 'GROUP' &&
    (node.operator === 'OR' || (node.operands || []).some(containsOr));
}

/**
 * Analyze an entire curriculum's directed prerequisite graph.
 *
 * Graph edges run from source prerequisite -> target course. Every reachable
 * descendant is counted once even when multiple paths converge on a course.
 * Corequisites are visible in the map but never treated as directional chains.
 * The algorithm intentionally reports potential impact for OR rules.
 */
export function analyzeCurriculumDependencies(
  curriculumId: string,
  courseIds: readonly string[],
  rules: readonly AcademicRule[],
): DependencyAnalysis {
  const nodes = new Set(courseIds);
  const adjacency = new Map<string, Set<string>>(
    [...nodes].map(id => [id, new Set<string>()]),
  );
  const links = new Map<string, DependencyLink>();
  let hasAlternativeRules = false;

  for (const rule of rules) {
    if (rule.curriculumId !== curriculumId ||
        (rule.relationshipType !== 'PREREQUISITE' && rule.relationshipType !== 'COREQUISITE')) continue;
    if (!nodes.has(rule.targetCourseId)) {
      throw new Error('یک قانون به درسی خارج از چارت انتخاب‌شده اشاره می‌کند.');
    }
    const conditional = containsOr(rule.expression);
    if (conditional) hasAlternativeRules = true;
    for (const source of new Set(extractSourceCourseIds(rule.expression))) {
      if (!nodes.has(source)) {
        throw new Error('پیش‌نیاز یا هم‌نیاز به درسی خارج از این چارت اشاره دارد.');
      }
      const kind = rule.relationshipType;
      const link: DependencyLink = {
        source, target: rule.targetCourseId, kind, conditional,
      };
      const key = `${kind}:${source}:${rule.targetCourseId}`;
      const previous = links.get(key);
      links.set(key, {
        ...link,
        conditional: conditional || Boolean(previous?.conditional),
      });
      if (kind === 'PREREQUISITE') adjacency.get(source)!.add(rule.targetCourseId);
    }
  }

  const inProgress = new Set<string>();
  const memo = new Map<string, { reach: Set<string>; chain: number }>();
  const visit = (id: string): { reach: Set<string>; chain: number } => {
    if (inProgress.has(id)) throw new Error('در زنجیرهٔ پیش‌نیازها حلقه وجود دارد؛ ابتدا قوانین چارت را اصلاح کنید.');
    const previous = memo.get(id);
    if (previous) return previous;
    inProgress.add(id);
    const reach = new Set<string>();
    let chain = 0;
    for (const next of adjacency.get(id) || []) {
      const child = visit(next);
      reach.add(next);
      for (const descendant of child.reach) reach.add(descendant);
      chain = Math.max(chain, child.chain + 1);
    }
    inProgress.delete(id);
    const result = { reach, chain };
    memo.set(id, result);
    return result;
  };

  const impacts = [...nodes].map(courseId => {
    const { reach, chain } = visit(courseId);
    const downstreamCourseIds = [...reach].sort();
    return {
      courseId,
      downstreamCount: downstreamCourseIds.length,
      longestChain: chain,
      directDependents: adjacency.get(courseId)?.size ?? 0,
      downstreamCourseIds,
      score: downstreamCourseIds.length * 10 + chain,
    };
  }).sort((a, b) =>
    b.downstreamCount - a.downstreamCount ||
    b.longestChain - a.longestChain ||
    a.courseId.localeCompare(b.courseId));

  return {
    links: [...links.values()].sort((a, b) =>
      a.source.localeCompare(b.source) ||
      a.target.localeCompare(b.target) ||
      a.kind.localeCompare(b.kind)),
    impacts,
    hasAlternativeRules,
  };
}
