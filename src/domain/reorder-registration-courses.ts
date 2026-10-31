/** Pure reorder for the student's unified registration queue.
 * It preserves every selected course exactly once and never mutates props.
 * Prerequisite/corequisite ordering is still checked by buildRegistrationQueue.
 */
export function reorderRegistrationCourses(ids: readonly string[], from: number, to: number): string[] | null {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 ||
      from >= ids.length || to >= ids.length || from === to || new Set(ids).size !== ids.length) return null;
  const result = [...ids];
  const [selected] = result.splice(from, 1);
  result.splice(to, 0, selected);
  return result;
}
