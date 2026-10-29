/**
 * A student's nonbinding course wishlist is distinct from actual academic
 * offerings. This helper only scopes/presents existing authoritative results;
 * it must never turn an unavailable or blocked course into an eligible one.
 */
export function orderedBasketOfferings<T extends { courseId: string }>(
  groups: readonly T[],
  wishlistIds: readonly string[],
  onlyBasket: boolean,
): T[] {
  if (!onlyBasket || wishlistIds.length === 0) return [...groups];
  const index = new Map(wishlistIds.map((id, position) => [id, position]));
  return groups
    .filter(group => index.has(group.courseId))
    .sort((a, b) => (index.get(a.courseId) ?? Infinity) - (index.get(b.courseId) ?? Infinity));
}

export function basketOfferingCoverage(
  wishlistIds: readonly string[],
  offeringCourseIds: readonly string[],
): { offered: number; missing: string[] } {
  const available = new Set(offeringCourseIds);
  const unique = [...new Set(wishlistIds)];
  return {
    offered: unique.filter(id => available.has(id)).length,
    missing: unique.filter(id => !available.has(id)),
  };
}
