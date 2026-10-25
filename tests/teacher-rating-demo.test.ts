import { beforeEach, describe, expect, it } from 'vitest';
import {
  MIN_PUBLISHED_RATINGS, summarizeCourseTeachers, validRatingScores, type TeacherRating,
} from '../src/domain/teacher-ratings';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';

const scores = {
  teachingClarity: 5, courseOrganization: 4,
  assessmentFairness: 3, studentSupport: 4,
};

beforeEach(() => resetBrowserDemo());

describe('numeric teacher rating privacy and integrity', () => {
  it('accepts four integer dimensions only; no comments or free text', () => {
    expect(validRatingScores(scores)).toBe(true);
    expect(validRatingScores({ ...scores, teachingClarity: 0 })).toBe(false);
    expect(validRatingScores({ ...scores, teachingClarity: 5.5 })).toBe(false);
    expect(validRatingScores({ ...scores, comment: 'unwanted text' })).toBe(false);
    expect(validRatingScores({ teachingClarity: 5 })).toBe(false);
  });

  it('suppresses small samples and does not mix different courses', () => {
    const make = (reviewerId: string, courseId = 'a'): TeacherRating => ({
      reviewerId, courseId, instructor: 'استاد نمونه', scores,
    });
    const one = summarizeCourseTeachers('a', ['استاد نمونه'], [
      make('1'), make('2'), make('3', 'other-course'),
    ]);
    expect(one[0].sampleSize).toBe(2);
    expect(one[0].average).toBeNull();
    expect(one[0].rank).toBeNull();
    expect(MIN_PUBLISHED_RATINGS).toBe(3);
  });

  it('deduplicates reviewers, preserves tied ranks and orders per-course', () => {
    const ratings: TeacherRating[] = ['A', 'B'].flatMap(instructor =>
      ['u1', 'u2', 'u3'].map(reviewerId => ({
        reviewerId, instructor, courseId: 'math', scores,
      })),
    );
    ratings.push({ reviewerId: 'u1', instructor: 'A', courseId: 'math', scores });
    const result = summarizeCourseTeachers('math', ['A', 'B'], ratings);
    expect(result).toHaveLength(2);
    expect(result.map(x => x.sampleSize)).toEqual([3, 3]);
    expect(result.map(x => x.rank)).toEqual([1, 1]);
    expect(result[0].scores).not.toBeNull();
  });

  it('lets the demo revise its synthetic rating but rejects comments and bad values', async () => {
    const path = '/api/demo/teacher-ratings?courseId=math2';
    const before = await browserDemoRequest<any[]>(path);
    expect(before.success).toBe(true);
    expect(before.data?.length).toBeGreaterThanOrEqual(2);
    const body = { courseId: 'math2', instructor: 'استاد نمونه ۱', scores };
    const put = async (payload: unknown) => browserDemoRequest<any[]>('/api/demo/teacher-ratings', {
      method: 'PUT', body: JSON.stringify(payload),
    });
    expect((await put({ ...body, comment: 'not supported' })).success).toBe(false);
    expect((await put({ ...body, scores: { ...scores, teachingClarity: 6 } })).success).toBe(false);
    expect((await put({ ...body, instructor: 'استاد جعلی' })).success).toBe(false);
    expect((await put(body)).success).toBe(true);
    const once = (await browserDemoRequest<any[]>(path)).data!.find(x => x.instructor === body.instructor);
    expect(once?.sampleSize).toBe(4);
    expect((await put(body)).success).toBe(true);
    const twice = (await browserDemoRequest<any[]>(path)).data!.find(x => x.instructor === body.instructor);
    expect(twice?.sampleSize).toBe(4);
    resetBrowserDemo();
    const reset = (await browserDemoRequest<any[]>(path)).data!.find(x => x.instructor === body.instructor);
    expect(reset?.sampleSize).toBe(3);
  });
});
