import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';
import { DemoWorkspace } from '../src/pages/DemoWorkspace';

beforeEach(() => resetBrowserDemo());
const put = (endpoint: string, data: Record<string, unknown>) =>
  browserDemoRequest<any>(endpoint, { method: 'PUT', body: JSON.stringify(data) });
const add = (endpoint: string, data: Record<string, unknown>) =>
  browserDemoRequest<any>(endpoint, { method: 'POST', body: JSON.stringify(data) });
const remove = (endpoint: string) =>
  browserDemoRequest<any>(endpoint, { method: 'DELETE' });
const evaluations = async () => (await add('/api/eligibility/evaluate', {})).data.report.results as any[];

describe('coherent synthetic academic workflows across the student and admin demo', () => {
  it('reflects admin course edits in both student listings and passed-unit totals', async () => {
    const response = await put('/api/academic/courses/math2', {
      name: 'ریاضی آزمایشی ویرایش‌شده', units: 4,
    });
    expect(response.success).toBe(true);
    expect((await evaluations()).find(x => x.courseId === 'math2'))
      .toMatchObject({ courseName: 'ریاضی آزمایشی ویرایش‌شده', units: 4 });
    expect((await add('/api/student/passed-courses', { courseId: 'math2' })).success).toBe(true);
    expect((await browserDemoRequest<any>('/api/student/passed-courses')).data.totalUnits).toBe(4);
    expect((await add('/api/eligibility/evaluate', {})).data.academicLimits.passedUnits).toBe(4);
  });

  it('shows edited offering details in the student dashboard evaluation', async () => {
    const res = await put('/api/offerings/off-physics', {
      rawCourseName: 'فیزیک نمونه جدید', instructor: 'استاد آزمایشی تازه',
      dayOfWeek: 'دوشنبه', startTime: '13:00', endTime: '15:00',
    });
    expect(res.success).toBe(true);
    expect((await evaluations()).find(x => x.offeringId === 'off-physics'))
      .toMatchObject({
        courseName: 'فیزیک نمونه جدید',
        instructor: 'استاد آزمایشی تازه',
        dayOfWeek: 'دوشنبه',
        startTime: '13:00',
      });
  });

  it('allows adding valid linked demo courses and offerings but rejects orphan rows', async () => {
    const c = await add('/api/academic/courses', {
      code: 'DEMO-EXTRA-500', name: 'کنترل نمونه', units: 3, category: 'اصلی',
    });
    expect(c.success).toBe(true);
    const valid = await add('/api/offerings', {
      courseId: c.data.id, rawCourseName: 'کنترل نمونه',
      groupCode: '03', dayOfWeek: 'پنجشنبه', startTime: '13:00', endTime: '15:00',
      instructor: 'استاد نمونه',
    });
    expect(valid.success).toBe(true);
    expect((await evaluations()).some(x => x.offeringId === valid.data.id)).toBe(true);

    const missing = await add('/api/offerings', { rawCourseName: 'گروه بی‌درس' });
    const unknown = await add('/api/offerings', { courseId: 'missing-course' });
    expect(missing.success).toBe(false);
    expect(unknown.success).toBe(false);
    expect((await add('/api/academic/courses', {
      code: 'DEMO-EXTRA-500', name: 'تکراری', units: 2,
    })).success).toBe(false);
  });

  it('cleans removed and disabled offering IDs from the saved student plan', async () => {
    expect((await browserDemoRequest<any>('/api/student/plan')).data.selectedOfferingIds)
      .toContain('off-math2');
    expect((await remove('/api/offerings/off-math2')).success).toBe(true);
    expect((await browserDemoRequest<any>('/api/student/plan')).data.selectedOfferingIds)
      .not.toContain('off-math2');
    expect((await add('/api/student/plan/select', {
      offeringId: 'off-math2', action: 'add',
    })).success).toBe(false);
    expect((await evaluations()).some(x => x.offeringId === 'off-math2')).toBe(false);

    expect((await put('/api/academic/courses/physics', { active: false })).success).toBe(true);
    expect((await browserDemoRequest<any>('/api/student/plan')).data.selectedOfferingIds)
      .not.toContain('off-physics');
    expect((await evaluations()).some(x => x.courseId === 'physics')).toBe(false);
  });

  it('does not let an academic course with offerings or passed records vanish', async () => {
    expect((await remove('/api/academic/courses/math2')).success).toBe(false);
    await remove('/api/offerings/off-math2');
    expect((await add('/api/student/passed-courses', { courseId: 'math2' })).success).toBe(true);
    expect((await remove('/api/academic/courses/math2')).success).toBe(false);
  });

  it('refuses invalid time spans and stale selections without altering good data', async () => {
    const before = (await browserDemoRequest<any>('/api/student/plan')).data.selectedOfferingIds;
    expect((await put('/api/offerings/off-math2', {
      startTime: '16:00', endTime: '09:00',
    })).success).toBe(false);
    expect((await put('/api/student/plan', {
      selectedOfferingIds: [...before, 'off-does-not-exist'],
    })).success).toBe(false);
    expect((await browserDemoRequest<any>('/api/student/plan')).data.selectedOfferingIds).toEqual(before);
    expect((await evaluations()).find(x => x.offeringId === 'off-math2').startTime).toBe('08:00');
  });

  it('never advertises an online central database in demo or an unverified real dashboard', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/demo/admin']}>
        <DemoWorkspace role="admin" />
      </MemoryRouter>,
    );
    expect(html).toContain('شبیه‌ساز محلی');
    expect(html).toContain('بدون سرور');
    expect(html).not.toContain('برخط و فعال (Ready)');
  });
});
