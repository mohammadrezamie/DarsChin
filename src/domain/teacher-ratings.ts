/** Ratings prototype is isolated to synthetic browser demo data. */
export const RATING_DIMENSIONS = [
  'teachingClarity', 'courseOrganization', 'assessmentFairness', 'studentSupport',
] as const;
export type RatingDimension = typeof RATING_DIMENSIONS[number];
export type RatingScores = Record<RatingDimension, number>;
export interface TeacherRating {
  reviewerId: string; // Internal only; never exposed in public summaries.
  courseId: string;
  instructor: string; // Demo alias only; production requires a stable teacherId.
  scores: RatingScores;
}
export interface TeacherRatingSummary {
  courseId: string;
  instructor: string;
  sampleSize: number;
  average: number | null;
  scores: Record<RatingDimension, number> | null;
  rank: number | null;
}
export const MIN_PUBLISHED_RATINGS = 3;

export function validRatingScores(value: unknown): value is RatingScores {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  return Object.keys(raw).length === RATING_DIMENSIONS.length
    && RATING_DIMENSIONS.every(k => typeof raw[k] === 'number'
      && Number.isInteger(raw[k]) && (raw[k] as number) >= 1 && (raw[k] as number) <= 5);
}

/** Intentionally scoped by course: a teacher's score in another course never leaks in. */
export function summarizeCourseTeachers(courseId: string, instructors: string[], ratings: TeacherRating[]): TeacherRatingSummary[] {
  const distinctInstructors = [...new Set(instructors.filter(Boolean))];
  const summaries = distinctInstructors.map(instructor => {
    const courseRatings = ratings.filter(r => r.courseId === courseId && r.instructor === instructor && validRatingScores(r.scores));
    const latestByReviewer = new Map<string, TeacherRating>();
    for (const rating of courseRatings) latestByReviewer.set(rating.reviewerId, rating);
    const votes = [...latestByReviewer.values()];
    if (votes.length < MIN_PUBLISHED_RATINGS) {
      return { courseId, instructor, sampleSize: votes.length, average: null, scores: null, rank: null };
    }
    const scores = Object.fromEntries(RATING_DIMENSIONS.map(key => [
      key, Number((votes.reduce((sum, vote) => sum + vote.scores[key], 0) / votes.length).toFixed(2)),
    ])) as Record<RatingDimension, number>;
    const average = Number((RATING_DIMENSIONS.reduce((sum, key) => sum + scores[key], 0) / RATING_DIMENSIONS.length).toFixed(2));
    return { courseId, instructor, sampleSize: votes.length, scores, average, rank: null };
  });
  summaries.sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.instructor.localeCompare(b.instructor, 'fa'));
  let lastAverage: number | null = null;
  let lastRank: number | null = null;
  return summaries.map((item, index) => {
    if (item.average === null) return item;
    if (item.average !== lastAverage) { lastAverage = item.average; lastRank = index + 1; }
    return { ...item, rank: lastRank };
  });
}
