import type { RegistrationStep } from './registration-queue';

/**
 * Marks are a manual, session-local checklist; they never confirm enrollment
 * with the university. An offering/code change must invalidate a previous mark.
 *
 * v2 deliberately does not accept old course-ID-only marks. Those could make a
 * newly selected group look registered even though it was never checked.
 */
export function registrationProgressToken(
  step: Pick<RegistrationStep, 'courseId' | 'offeringId' | 'groupCode' | 'copyCode'>,
): string {
  return JSON.stringify(['v2', step.courseId, step.offeringId, step.groupCode, step.copyCode]);
}

/** Only exact current offerings count as done; stale and legacy entries never do. */
export function completedRegistrationCourseIds(
  steps: readonly RegistrationStep[],
  storedTokens: readonly string[],
): Set<string> {
  const tokens = new Set(storedTokens);
  return new Set(steps
    .filter(step => tokens.has(registrationProgressToken(step)))
    .map(step => step.courseId));
}

/** Discard legacy, malformed and oversized values from tab storage. */
export function parseStoredRegistrationTokens(raw: string | null): string[] {
  if (!raw || raw.length > 64_000) return [];
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    return [...new Set(values.filter((value): value is string => {
      if (typeof value !== 'string' || value.length > 800 || value.length < 12) return false;
      try {
        const parts: unknown = JSON.parse(value);
        return Array.isArray(parts) && parts.length === 5 && parts[0] === 'v2' &&
          parts.slice(1, 4).every(item => typeof item === 'string' && item.length > 0) &&
          (parts[4] === null || typeof parts[4] === 'string');
      } catch { return false; }
    }))].slice(0, 300);
  } catch {
    return [];
  }
}
