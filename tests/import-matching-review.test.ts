import { describe, expect, it } from 'vitest';
import type { Course } from '../src/types';
import { parseRawInput, processImportPayload } from '../src/domain/import-validator';
import { processImportSchema } from '../server/schemas/imports';
import { reconcileSyncRecords } from '../server/sync/reconciliation';

const course: Course = {
  id: 'math-2', name: 'ریاضی عمومی ۲', code: 'M-102',
  units: 3, category: 'پایه', active: true,
};
const row = (overrides: Record<string, unknown> = {}) => ({
  courseCode: 'M-102', courseName: 'ریاضی عمومی ۲',
  group: '01', instructor: 'مدرس نمونه',
  day: 'شنبه', startTime: '۰۸:۰۰', endTime: '۱۰:۰۰',
  capacity: 35, availableCapacity: 13,
  ...overrides,
});
const process = (rows: unknown[], catalog = [course]) =>
  processImportPayload({ records: rows }, 'batch-fixture', 'term-1', 'campus-1', catalog);

describe('Educationalyar import: strict matching and human review', () => {
  it('accepts JSON objects, arrays and CSV as bounded import payloads', () => {
    for (const payload of [{ records: [row()] }, [row()], 'code,name\nM-102,ریاضی عمومی ۲']) {
      expect(processImportSchema.safeParse({ payload }).success).toBe(true);
    }
    expect(processImportSchema.safeParse({ payload: null }).success).toBe(false);
    expect(processImportSchema.safeParse({ payload: '' }).success).toBe(false);
  });

  it('matches one verified code/title combination and preserves real source time and capacity', () => {
    const result = process([row()]);
    expect(result.matchedCount).toBe(1);
    expect(result.reviewCount).toBe(0);
    expect(result.preparedOfferings).toHaveLength(1);
    expect(result.preparedOfferings[0]).toMatchObject({
      courseId: 'math-2', groupCode: '01', dayOfWeek: 'شنبه',
      startTime: '08:00', endTime: '10:00', capacity: 35,
      enrolledCount: 22, enrolledCountKnown: true,
    });
  });

  it('reads explicit Persian CSV columns without confusing course and instructor names', () => {
    const csv = [
      'کد درس,نام درس,گروه,نام استاد,روز,ساعت,ظرفیت,ظرفیت باقیمانده',
      'M-102,ریاضی عمومی ۲,03,مدرس آزمایشی,سه‌شنبه,۰۹:۰۰ - ۱۱:۰۰,۳۵,۱۲',
    ].join('\n');
    const parsed = parseRawInput(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      courseCode: 'M-102', courseName: 'ریاضی عمومی ۲',
      instructor: 'مدرس آزمایشی', day: 'سه‌شنبه',
      startTime: '۰۹:۰۰', endTime: '۱۱:۰۰',
      capacity: 35, availableCapacity: 12,
    });
    const result = processImportPayload(csv, 'csv-batch', 'term-1', 'campus-1', [course]);
    expect(result.matchedCount).toBe(1);
    expect(result.preparedOfferings[0]).toMatchObject({
      groupCode: '03', instructor: 'مدرس آزمایشی',
      dayOfWeek: 'سه‌شنبه', startTime: '09:00',
      endTime: '11:00', capacity: 35,
      enrolledCountKnown: true, enrolledCount: 23,
    });
  });

  it('does not silently map unknown, ambiguous, or absent codes to the first similar title', () => {
    const unknown = process([row({ courseCode: 'NOT-EXISTING' })]);
    expect(unknown.preparedOfferings).toHaveLength(0);
    expect(unknown.importRecords[0].status).toBe('NEEDS_REVIEW');
    const noCode = process([row({ courseCode: '' })]);
    expect(noCode.preparedOfferings).toHaveLength(0);
    expect(noCode.importRecords[0].status).toBe('NEEDS_REVIEW');
    const collision = process([row()], [{ ...course }, { ...course, id: 'other-course' }]);
    expect(collision.preparedOfferings).toHaveLength(0);
    expect(collision.importRecords[0].status).toBe('NEEDS_REVIEW');
    const wrongTitle = process([row({ courseName: 'ریاضی عمومی ۱' })]);
    expect(wrongTitle.preparedOfferings).toHaveLength(0);
    expect(wrongTitle.importRecords[0].status).toBe('NEEDS_REVIEW');
  });

  it('never invents group, lecturer, class time, capacity or availability', () => {
    const raw = parseRawInput({ records: [{ courseCode: 'M-102', courseName: 'ریاضی عمومی ۲' }] });
    expect(raw[0]).toMatchObject({ group: '', instructor: '', day: '', startTime: '', endTime: '' });
    expect(raw[0].capacity).toBeUndefined();
    expect(raw[0].availableCapacity).toBeUndefined();
    expect(process(raw).importRecords[0].status).toBe('NEEDS_REVIEW');
    expect(process([row({ startTime: 'not-a-time' })]).matchedCount).toBe(0);
    expect(process([row({ capacity: null })]).matchedCount).toBe(0);
  });

  it('never labels missing available capacity as a confirmed free seat count', () => {
    const result = process([row({ availableCapacity: null })]);
    expect(result.matchedCount).toBe(1);
    expect(result.preparedOfferings[0]).toMatchObject({
      enrolledCount: 0, enrolledCountKnown: false,
    });
    expect(result.preparedOfferings[0].notes).toContain('نامعلوم');
  });

  it('refuses publication during sync when supplied code conflicts with its name', () => {
    const base = {
      course: { courseCode: 'WRONG', courseName: course.name },
      courseClass: { courseClassRef: 'CLASS-1234', group: '01',
        instructor: 'مدرس نمونه', schedule: 'شنبه 08:00 - 10:00', capacity: '35' },
    };
    const mismatch = reconcileSyncRecords({
      records: [base], termId: 'term-1', campusId: 'campus-1', courses: [course],
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.offerings).toHaveLength(0);
    expect(mismatch.errors[0]).toContain('تطبیق یکتایی');
    const missingCode = reconcileSyncRecords({
      records: [{ ...base, course: { courseCode: '', courseName: course.name } }],
      termId: 'term-1', campusId: 'campus-1', courses: [course],
    });
    expect(missingCode.ok).toBe(false);
    expect(missingCode.offerings).toHaveLength(0);
  });
});
