import type { CurriculumCourse } from '../types';

/** Shared assignments apply to every track; scoped assignments never cross tracks. */
export function ruleScopeCourseIds(assignments: readonly CurriculumCourse[], curriculumId: string, trackId: string | null | undefined): Set<string> {
  return new Set(assignments.filter(row => row.curriculumId === curriculumId && row.active !== false &&
    (!row.trackId || (Boolean(trackId) && row.trackId === trackId))).map(row => row.courseId));
}
