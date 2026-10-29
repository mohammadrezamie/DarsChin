import type { AcademicRule } from '../types';
import { analyzeCurriculumDependencies } from './course-dependency-insights';

export type VisualRelationship = 'PREREQUISITE' | 'COREQUISITE';

export interface DependencyDraftAssessment {
  valid: boolean;
  error: string;
}

/**
 * The visual editor only creates a single COURSE→COURSE rule. It never alters
 * compound AND/OR or context-dependent rules, which keep their advanced editor.
 * Validation is a local preview; the authenticated API is the authority.
 */
export function assessDependencyDraft(
  curriculumId: string,
  courseIds: readonly string[],
  rules: readonly AcademicRule[],
  sourceId: string,
  targetId: string,
  relationshipType: VisualRelationship,
): DependencyDraftAssessment {
  const membership = new Set(courseIds);
  if (!curriculumId || !sourceId || !targetId) {
    return { valid: false, error: 'ابتدا چارت و دو درس را انتخاب کنید.' };
  }
  if (!membership.has(sourceId) || !membership.has(targetId)) {
    return { valid: false, error: 'هر دو درس باید عضو چارت انتخابی باشند.' };
  }
  if (sourceId === targetId) {
    return { valid: false, error: 'یک درس نمی‌تواند به خودش متصل شود.' };
  }
  if (rules.some(rule => rule.curriculumId === curriculumId &&
    rule.relationshipType === relationshipType &&
    rule.targetCourseId === targetId &&
    rule.expression.type === 'COURSE' && rule.expression.courseId === sourceId)) {
    return { valid: false, error: 'این اتصال پیش‌تر ثبت شده است.' };
  }

  const before = analyzeCurriculumDependencies(curriculumId, courseIds, rules);
  if (!before.valid) {
    return { valid: false, error: 'ابتدا خطاهای روابط فعلی این چارت را اصلاح کنید.' };
  }
  if (before.edges.some(edge =>
    edge.from === sourceId && edge.to === targetId && edge.kind === relationshipType)) {
    return { valid: false, error: 'این اتصال در یکی از قوانین ترکیبی چارت وجود دارد؛ آن را در ویرایشگر پیشرفته اصلاح کنید.' };
  }

  const candidate: AcademicRule = {
    id: '__unsaved_visual_draft__',
    curriculumId,
    targetCourseId: targetId,
    relationshipType,
    expression: { type: 'COURSE', courseId: sourceId },
  };
  const after = analyzeCurriculumDependencies(curriculumId, courseIds, [...rules, candidate]);
  return after.valid
    ? { valid: true, error: '' }
    : { valid: false, error: after.errors.join(' ') || 'رابطهٔ پیشنهادی معتبر نیست.' };
}
