import { beforeEach, describe, expect, it } from 'vitest';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';

beforeEach(() => resetBrowserDemo());

describe('browser-only manager: class without an announced timetable', () => {
  it('creates and edits an unspecified session without calling the university API', async () => {
    const [courses, terms, campuses] = await Promise.all([
      browserDemoRequest<any[]>('/api/academic/courses'),
      browserDemoRequest<any[]>('/api/academic/terms'),
      browserDemoRequest<any[]>('/api/academic/campuses'),
    ]);
    const row = {
      courseId: courses.data![0].id,
      termId: terms.data![0].id,
      campusId: campuses.data![0].id,
      groupCode: '78', instructor: 'مدرس آزمایشی',
      capacity: 21,
      startTime: '', endTime: '', dayOfWeek: '',
    };
    const created = await browserDemoRequest<any>('/api/offerings', {
      method: 'POST', body: JSON.stringify(row),
    });
    expect(created.success).toBe(true);
    expect(created.data?.startTime).toBe('');
    expect(created.data?.endTime).toBe('');
    expect(created.data?.enrolledCountKnown).toBe(false);
    const changed = await browserDemoRequest<any>('/api/offerings/' + created.data.id, {
      method: 'PUT', body: JSON.stringify({
        dayOfWeek: 'پنجشنبه', startTime: '۰۷:۳۵', endTime: '۰۹:۰۵',
      }),
    });
    expect(changed.success).toBe(true);
    expect(changed.data?.startTime).toBe('07:35');
    expect(changed.data?.endTime).toBe('09:05');
    const list = await browserDemoRequest<any[]>('/api/offerings');
    expect(list.data?.some(item => item.id === created.data.id)).toBe(true);
  });

  it('rejects one-sided, inverted, nonexistent-course and over-capacity input', async () => {
    const courses = (await browserDemoRequest<any[]>('/api/academic/courses')).data!;
    const invalid = [
      { courseId: courses[0].id, startTime: '10:00', endTime: '' },
      { courseId: courses[0].id, startTime: '12:00', endTime: '10:00' },
      { courseId: 'unknown-course', startTime: '', endTime: '' },
      { courseId: courses[0].id, capacity: 2, enrolledCount: 10 },
    ];
    for (const row of invalid) {
      const response = await browserDemoRequest('/api/offerings', {
        method: 'POST',
        body: JSON.stringify({
          termId: 'demo-term', campusId: 'demo-campus',
          groupCode: '07', instructor: 'مدرس آزمایشی', capacity: 30, ...row,
        }),
      });
      expect(response.success).toBe(false);
    }
  });
});
