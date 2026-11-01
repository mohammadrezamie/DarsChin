import { AcademicRuleNode } from '../types';

export function extractSourceCourseIds(node: AcademicRuleNode): string[] {
  if (node.type === 'COURSE' && node.courseId) {
    return [node.courseId];
  } else if (node.type === 'GROUP' && node.operands) {
    return node.operands.flatMap(extractSourceCourseIds);
  }
  return [];
}
