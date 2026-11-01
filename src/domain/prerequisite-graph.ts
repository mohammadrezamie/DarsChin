import type { AcademicRule, AcademicRuleNode } from '../types';
import { extractSourceCourseIds } from '../utils/academic';

/** A directed prerequisite graph must remain acyclic per curriculum.
 * Corequisites are deliberately excluded: mutually corequired classes can be valid.
 */
export function createsPrerequisiteCycle(
  curriculumId: string, targetCourseId: string, expression: AcademicRuleNode,
  rules: readonly AcademicRule[],
): boolean {
  const edges = new Map<string, Set<string>>();
  for (const rule of rules) {
    if (rule.curriculumId !== curriculumId || rule.relationshipType !== 'PREREQUISITE') continue;
    const sources = edges.get(rule.targetCourseId) || new Set<string>();
    extractSourceCourseIds(rule.expression).forEach(id => sources.add(id));
    edges.set(rule.targetCourseId, sources);
  }
  const proposed = edges.get(targetCourseId) || new Set<string>();
  extractSourceCourseIds(expression).forEach(id => proposed.add(id));
  edges.set(targetCourseId, proposed);

  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const sourceId of edges.get(id) || []) if (visit(sourceId)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return [...edges.keys()].some(visit);
}
