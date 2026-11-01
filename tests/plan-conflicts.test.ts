import { describe, expect, it } from 'vitest';
import { clockMinutes, detectPlanConflicts } from '../src/domain/plan-conflicts';
import type { CourseOffering } from '../src/types';

const row = (id: string, courseId: string, overrides: Partial<CourseOffering> = {}): CourseOffering => ({
  id, courseId, termId: 'term-synthetic', campusId: 'camp-synthetic',
  groupCode: id, instructor: 'مدرس آزمایشی',
  dayOfWeek: 'سه‌شنبه', startTime: '۰۹:۰۰', endTime: '۱۰:۳۰',
  capacity: 30, enrolledCount: 0, source: 'manual', active: true,
  ...overrides,
});
describe('authoritative clash engine for confirmed course selections', () => {
  it('normalizes Persian/Arabic time and weekday variants', () => {
    expect(clockMinutes('۰۹:۲۵')).toBe(565);
    expect(clockMinutes('٠٩:٢٥')).toBe(565);
    expect(clockMinutes('9:25')).toBe(565);
    expect(clockMinutes('24:00')).toBeNull();
    const clashes=detectPlanConflicts([
      row('one','course-one'),
      row('two','course-two',{ dayOfWeek:'سهشنبه',startTime:'09:25',endTime:'11:00' }),
    ]);
    expect(clashes).toEqual([{
      kind:'CLASS',offeringIds:['one','two'],
      description:'دو کلاس انتخاب‌شده در یک روز و ساعت هم‌پوشانی دارند.',
    }]);
  });
  it('does not flag back-to-back sessions or different weekdays', () => {
    expect(detectPlanConflicts([
      row('a','course-a',{endTime:'10:00'}),
      row('b','course-b',{startTime:'10:00',endTime:'11:00'}),
      row('c','course-c',{dayOfWeek:'چهارشنبه'}),
    ])).toEqual([]);
  });
  it('rejects exactly simultaneous exam starts, not same-day different times', () => {
    const a=row('a','course-a',{ dayOfWeek:'',startTime:'',endTime:'',examDate:'۱۴۰۵/۱۰/۲۱ - ۰۹:۰۰' });
    const b=row('b','course-b',{ dayOfWeek:'',startTime:'',endTime:'',examDate:'1405/10/21 - 09:00' });
    const c=row('c','course-c',{ dayOfWeek:'',startTime:'',endTime:'',examDate:'۱۴۰۵/۱۰/۲۱ - ۱۱:۰۰' });
    expect(detectPlanConflicts([a,b,c])).toHaveLength(1);
    expect(detectPlanConflicts([a,c])).toEqual([]);
  });
  it('does not invent a definite clash from an unannounced timetable or date-only exam', () => {
    expect(detectPlanConflicts([
      row('a','course-a',{dayOfWeek:'',startTime:'',endTime:'',examDate:'۱۴۰۵/۱۰/۲۱'}),
      row('b','course-b',{dayOfWeek:'سه‌شنبه',startTime:'',endTime:'',examDate:'1405/10/21'}),
    ])).toEqual([]);
  });
  it('keeps alternative sections of the same course out of pairwise collision detection', () => {
    expect(detectPlanConflicts([row('a','one'),row('b','one')])).toEqual([]);
  });
});
