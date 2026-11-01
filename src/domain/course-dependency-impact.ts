import type { AcademicRule, AcademicRuleNode, CurriculumCourse } from '../types';

export type CourseLink = {
  source: string;
  target: string;
  kind: 'prerequisite' | 'corequisite';
  /** An OR-branch is not an obligatory prerequisite path. */
  conditional: boolean;
};

export type CourseImpact = {
  courseId: string;
  directlyUnlocks: number;
  downstreamCourses: number;
  requiredDownstream: number;
  conditionalDownstream: number;
  longestChain: number;
  /** Relative advisory indicator; never an academic eligibility decision. */
  impactScore: number;
};

/** Build validated, curriculum-scoped relationships for a future visual editor. */
export function buildCourseDependencyGraph(
  curriculumId: string,
  curriculumCourses: readonly Pick<CurriculumCourse, 'curriculumId' | 'courseId' | 'active'>[],
  rules: readonly AcademicRule[],
): { courseIds: string[]; links: CourseLink[] } {
  const courseIds = [...new Set(curriculumCourses.filter(x => x.curriculumId === curriculumId && x.active)
    .map(x => x.courseId))].sort();
  const known = new Set(courseIds);
  const links: CourseLink[] = [];
  const unique = new Set<string>();
  const visitExpression = (
    expression: AcademicRuleNode,
    target: string,
    kind: CourseLink['kind'],
    conditional = false,
  ): void => {
    if (expression.type === 'GROUP') {
      for (const child of expression.operands || []) {
        visitExpression(child, target, kind, conditional || expression.operator === 'OR');
      }
      return;
    }
    if (expression.type !== 'COURSE' || !expression.courseId) {
      throw new Error('Invalid course dependency expression');
    }
    const source = expression.courseId;
    if (!known.has(source)) throw new Error(`Unknown prerequisite course: ${source}`);
    if (source === target && kind === 'prerequisite') {
      throw new Error('A course cannot be its own prerequisite');
    }
    const key = `${kind}:${source}:${target}`;
    if (!unique.has(key)) {
      unique.add(key);
      links.push({ source, target, kind, conditional });
    } else if (!conditional) {
      // AND path overrides a possible OR path for the same pair.
      const existing = links.find(link => link.source === source && link.target === target && link.kind === kind);
      if (existing) existing.conditional = false;
    }
  };
  for (const rule of rules) {
    if (rule.curriculumId !== curriculumId || rule.relationshipType === 'CONTEXTUAL_RETAKE_RULE') continue;
    if (!known.has(rule.targetCourseId)) throw new Error(`Unknown target course: ${rule.targetCourseId}`);
    const kind = rule.relationshipType === 'PREREQUISITE' ? 'prerequisite' : 'corequisite';
    visitExpression(rule.expression, rule.targetCourseId, kind);
  }
  links.sort((a, b) =>
    a.source.localeCompare(b.source) || a.target.localeCompare(b.target) || a.kind.localeCompare(b.kind));
  return { courseIds, links };
}

/**
 * Count DISTINCT downstream courses across the WHOLE curriculum, not only the
 * next term or the number of immediate dependents.
 * OR alternatives are counted separately as possible, not guaranteed unlocks.
 * Corequisites are visual links but do not increase the prerequisite score.
 * Cyclic data fails closed instead of producing a misleading priority.
 */
export function rankCoursesByDependencyImpact(
  courseIds: readonly string[],
  links: readonly CourseLink[],
): CourseImpact[] {
  const all = new Set(courseIds);
  const adjacency = new Map<string, CourseLink[]>();
  for (const courseId of courseIds) adjacency.set(courseId, []);
  for (const link of links) {
    if (link.kind !== 'prerequisite') continue;
    if (!all.has(link.source) || !all.has(link.target)) throw new Error('Unknown course in dependency graph');
    adjacency.get(link.source)!.push(link);
  }

  const visiting = new Set<string>(), visited = new Set<string>();
  const check = (courseId: string): void => {
    if (visiting.has(courseId)) throw new Error('Cyclic prerequisite graph');
    if (visited.has(courseId)) return;
    visiting.add(courseId);
    for (const link of adjacency.get(courseId) || []) check(link.target);
    visiting.delete(courseId);
    visited.add(courseId);
  };
  courseIds.forEach(check);

  return courseIds.map(courseId => {
    const potential = new Set<string>(), required = new Set<string>();
    const requiredStack: string[] = [courseId];
    while (requiredStack.length) {
      const current = requiredStack.pop()!;
      for (const link of adjacency.get(current) || []) {
        if (!potential.has(link.target)) potential.add(link.target);
        if (!link.conditional && !required.has(link.target)) {
          required.add(link.target);
          requiredStack.push(link.target);
        }
      }
    }
    // Evaluate all paths separately so an optional fork can later converge
    // into a shared required course without double-counting it.
    const stack: string[] = [courseId];
    const traversed = new Set<string>();
    while (stack.length) {
      const current = stack.pop()!;
      if (traversed.has(current)) continue;
      traversed.add(current);
      for (const link of adjacency.get(current) || []) {
        potential.add(link.target);
        stack.push(link.target);
      }
    }
    const depth = new Map<string, number>();
    const longest = (id: string): number => {
      if (depth.has(id)) return depth.get(id)!;
      const value = Math.max(0, ...(adjacency.get(id) || []).map(link => 1 + longest(link.target)));
      depth.set(id, value);
      return value;
    };
    const requiredDownstream = required.size;
    const conditionalDownstream = potential.size - requiredDownstream;
    return {
      courseId,
      directlyUnlocks: new Set((adjacency.get(courseId) || []).map(link => link.target)).size,
      downstreamCourses: potential.size,
      requiredDownstream,
      conditionalDownstream,
      longestChain: longest(courseId),
      impactScore: requiredDownstream + conditionalDownstream * 0.5,
    };
  }).sort((a, b) => b.impactScore - a.impactScore ||
    b.longestChain - a.longestChain || a.courseId.localeCompare(b.courseId));
}
