import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { updatePlanSchema, normalizeCoursePriorities } from '../server/schemas/student';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';
import { DemoWorkspace } from '../src/pages/DemoWorkspace';

beforeEach(() => resetBrowserDemo());

describe('student plan API and mobile workspace regression', () => {
  it('accepts ordered course IDs and canonical numeric rank maps, not the legacy mismatched map of arrays', () => {
    expect(updatePlanSchema.safeParse({ coursePriorities: ['math', 'physics'] }).success).toBe(true);
    expect(updatePlanSchema.safeParse({ coursePriorities: { math: 0, physics: 1 } }).success).toBe(true);
    expect(updatePlanSchema.safeParse({ coursePriorities: { math: ['physics'] } }).success).toBe(false);
    expect(updatePlanSchema.safeParse({ coursePriorities: { math: -1 } }).success).toBe(false);
    expect(updatePlanSchema.safeParse({ coursePriorities: [''] }).success).toBe(false);
  });

  it('turns deduplicated ordered IDs into stable persisted ranks', () => {
    expect(normalizeCoursePriorities(['physics', 'math', 'physics']))
      .toEqual({ physics: 0, math: 1 });
    expect(normalizeCoursePriorities({ math: 2, physics: 0 }))
      .toEqual({ math: 2, physics: 0 });
    expect(normalizeCoursePriorities(undefined)).toBeUndefined();
    expect(normalizeCoursePriorities([])).toEqual({});
  });

  it('renders the six touch-friendly student workspaces including previously unreachable support and bugs', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/demo/student']}>
        <DemoWorkspace role="student" />
      </MemoryRouter>,
    );
    expect(html).toContain('بخش‌های میز کار دانشجو');
    expect(html).toContain('دروس ارائه‌شده');
    expect(html).toContain('پیشنهادها');
    expect(html).toContain('برنامه من');
    expect(html).toContain('کارنامه');
    expect(html).toContain('پشتیبانی');
    expect(html).toContain('گزارش باگ');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('min-h-12');
    expect(html).toContain('گروه درسی انتخاب شده');
  });

  it('persists and reads illustrative plan changes within the isolated browser demo', async () => {
    const save = await browserDemoRequest('/api/student/plan', {
      method: 'PUT',
      body: JSON.stringify({
        selectedOfferingIds: ['off-math2'],
        coursePriorities: ['math2'],
        offeringPriorities: {},
      }),
    });
    expect(save.success).toBe(true);
    const current = await browserDemoRequest<any>('/api/student/plan');
    expect(current.data?.selectedOfferingIds).toEqual(['off-math2']);
    expect(current.data?.coursePriorities).toEqual(['math2']);
    expect((await browserDemoRequest('/api/student/plan/select', {
      method: 'POST',
      body: JSON.stringify({ offeringId: 'missing-offering', action: 'add' }),
    })).success).toBe(false);
    expect((await browserDemoRequest<any>('/api/student/plan')).data?.selectedOfferingIds).toEqual(['off-math2']);
  });
});
