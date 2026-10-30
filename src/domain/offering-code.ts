import type { CourseEligibilityResult } from '../types';

/**
 * Only an explicitly imported offering code for a currently available group
 * can be offered as a manual Educationalyar copy action.
 * Catalog-only codes, DEMO values, and blocked groups are not registration codes.
 * This is a UI safety check, not a replacement for server-side eligibility.
 */
export function verifiedOfferingGroupCopyCode(
  offering: Pick<CourseEligibilityResult,
    'rawCourseCode' | 'groupCode' | 'canSelect' | 'isEligible' | 'overallStatus'>,
): string | null {
  const raw = typeof offering.rawCourseCode === 'string' ? offering.rawCourseCode.trim() : '';
  const group = typeof offering.groupCode === 'string' ? offering.groupCode.trim() : '';
  if (!raw || !group || /^DEMO[-_]/i.test(raw) || /^DEMO[-_]/i.test(group) ||
      !offering.canSelect || !offering.isEligible || offering.overallStatus !== 'AVAILABLE') {
    return null;
  }
  return `${raw}_${group}`;
}
