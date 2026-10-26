import type { DemandResponse } from '../types';

/**
 * Check identity and response shape at the UI boundary. Successful HTTP is not
 * sufficient proof that a response belongs to the currently selected survey
 * and signed-in student. A null response is valid for an unanswered survey.
 *
 * This check does not replace server authorization or academic eligibility.
 */
export function isDemandResponseForContext(
  response: unknown,
  userId: string | null | undefined,
  surveyId: string,
  allowedCourseIds: readonly string[],
): response is DemandResponse | null {
  if (response === null) return true;
  if (!userId || !surveyId || !response || typeof response !== 'object' || Array.isArray(response)) return false;

  const candidate = response as Partial<DemandResponse>;
  if (candidate.userId !== userId || candidate.surveyId !== surveyId) return false;
  if (typeof candidate.studentNumber !== 'string') return false;
  if (!['YES', 'NO', 'UNKNOWN'].includes(candidate.anticipatedGraduation as string)) return false;
  if (!Array.isArray(candidate.courseIds) || !candidate.courseIds.every(id => typeof id === 'string')) return false;

  const unique = new Set(candidate.courseIds);
  const allowed = new Set(allowedCourseIds);
  return unique.size === candidate.courseIds.length && candidate.courseIds.every(id => allowed.has(id));
}
