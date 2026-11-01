import { describe, expect, it } from 'vitest';
import type { Course } from '../src/types';
import { reconcileSyncRecords } from '../server/sync/reconciliation';

const course = {
  id: 'course-1',
  code: 'EE-101',
  name: 'ریاضی عمومی',
  alternateCodes: [],
  courseCodes: [],
} as unknown as Course;

const record = (overrides: Record<string, unknown> = {}) => ({
  course: { courseCode: 'EE-101', courseName: 'ریاضی عمومی', units: 3 },
  courseClass: {
    courseClassRef: 'CLASS-12345',
    offeringCode: 'OFFER-01',
    group: '01',
    instructor: 'دکتر نمونه',
    schedule: 'شنبه 08:00 - 10:00',
    capacity: '35',
  },
  _meta: { parserVersion: '3.3.6', sourcePage: 1 },
  ...overrides,
});

describe('safe sync reconciliation', () => {
  it('normalizes the checked-in nested extension payload without inventing a schedule', () => {
    const result = reconcileSyncRecords({
      records: [record()],
      termId: 'term-test',
      campusId: 'campus-test',
      courses: [course],
    });

    expect(result.ok).toBe(true);
    expect(result.offerings).toHaveLength(1);
    expect(result.offerings[0]).toMatchObject({
      termId: 'term-test',
      campusId: 'campus-test',
      courseId: 'course-1',
      groupCode: '01',
      dayOfWeek: 'شنبه',
      startTime: '08:00',
      endTime: '10:00',
      source: 'extension',
      active: true,
    });
    expect(result.offerings[0].sourceIdentity).toContain('CLASS-12345');
  });

  it('rejects missing or malformed schedules and returns no partial writes', () => {
    const invalid = record({
      courseClass: {
        courseClassRef: 'CLASS-12345',
        group: '01',
        instructor: 'دکتر نمونه',
        capacity: '35',
        schedule: '',
      },
    });
    const result = reconcileSyncRecords({
      records: [record(), invalid],
      termId: 'term-test',
      campusId: 'campus-test',
      courses: [course],
    });

    expect(result.ok).toBe(false);
    expect(result.offerings).toHaveLength(0);
    expect(result.errors.some((error) => error.includes('زمان‌بندی'))).toBe(true);
  });

  it('deduplicates identical source records and creates stable identities', () => {
    const first = reconcileSyncRecords({
      records: [record(), record()],
      termId: 'term-test',
      campusId: 'campus-test',
      courses: [course],
    });
    const replay = reconcileSyncRecords({
      records: [record()],
      termId: 'term-test',
      campusId: 'campus-test',
      courses: [course],
    });

    expect(first.ok).toBe(true);
    expect(first.offerings).toHaveLength(1);
    expect(first.duplicateRecords).toBe(1);
    expect(replay.offerings[0].id).toBe(first.offerings[0].id);
  });

  it('rejects ambiguous course-code matching instead of choosing the first course', () => {
    const secondCourse = { ...course, id: 'course-2' } as Course;
    const result = reconcileSyncRecords({
      records: [record()],
      termId: 'term-test',
      campusId: 'campus-test',
      courses: [course, secondCourse],
    });

    expect(result.ok).toBe(false);
    expect(result.offerings).toHaveLength(0);
    expect(result.errors[0]).toContain('تطبیق یکتایی');
  });

  it('refuses inactive and cohort-scoped aliases without a verified program context', () => {
    const inactive = reconcileSyncRecords({
      records: [record()],
      termId: 'term-test',
      campusId: 'campus-test',
      courses: [{ ...course, active: false }],
    });
    expect(inactive.ok).toBe(false);
    expect(inactive.offerings).toHaveLength(0);

    const cohortScoped = reconcileSyncRecords({
      records: [record()],
      termId: 'term-test',
      campusId: 'campus-test',
      courses: [{
        ...course,
        code: 'NEW-CANONICAL',
        courseCodes: [{ code: 'EE-101', entryYear: 1403, majorId: 'major-ee', active: true }],
      }],
    });
    expect(cohortScoped.ok).toBe(false);
    expect(cohortScoped.offerings).toHaveLength(0);
  });

  it('rejects an empty extract and missing capacity', () => {
    const empty = reconcileSyncRecords({
      records: [],
      termId: 'term-test',
      campusId: 'campus-test',
      courses: [course],
    });
    const noCapacity = record({
      courseClass: {
        courseClassRef: 'CLASS-12345',
        group: '01',
        instructor: 'دکتر نمونه',
        schedule: 'شنبه 08:00 - 10:00',
      },
    });
    const missing = reconcileSyncRecords({
      records: [noCapacity],
      termId: 'term-test',
      campusId: 'campus-test',
      courses: [course],
    });

    expect(empty.ok).toBe(false);
    expect(missing.ok).toBe(false);
    expect(missing.errors[0]).toContain('ظرفیت');
  });
});
