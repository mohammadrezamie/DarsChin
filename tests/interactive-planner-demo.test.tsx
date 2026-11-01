import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PlannerDemo } from '../src/pages/PlannerDemo';
import {
  DEMO_INITIAL_IDS,
  DEMO_STORAGE_KEY,
  getDemoTimeConflicts,
  getDemoTotalUnits,
  getSelectedCourses,
  normalizeDemoSelection,
  readDemoSelection,
} from '../src/demo/course-planner';

describe('browser-only timetable demo', () => {
  it('renders a clear disclaimer and interactive sample course controls', () => {
    const html = renderToStaticMarkup(<MemoryRouter><PlannerDemo /></MemoryRouter>);
    expect(html).toContain('محیط تعاملیِ آزمایشی');
    expect(html).toContain('اطلاعات ساختگی');
    expect(html).toContain('برنامه‌ریز هفتگی درس‌چین');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('بازگشت به صفحهٔ اصلی');
  });

  it('provides sample courses and a matching computed unit sum', () => {
    expect(getSelectedCourses(DEMO_INITIAL_IDS)).toHaveLength(3);
    expect(getDemoTotalUnits(DEMO_INITIAL_IDS)).toBe(9);
    expect(getDemoTotalUnits([])).toBe(0);
  });

  it('detects an actual overlap within the same day', () => {
    const matches = getDemoTimeConflicts(['math2', 'circuits']);
    expect(matches).toHaveLength(1);
    expect(matches[0].first.day).toBe('شنبه');
    expect(new Set([matches[0].first.id, matches[0].second.id])).toEqual(new Set(['math2', 'circuits']));
  });

  it('does not report false collisions across separate days or nonoverlapping slots', () => {
    expect(getDemoTimeConflicts(['math2', 'physics', 'logic'])).toHaveLength(0);
    expect(getDemoTimeConflicts(['em', 'lab'])).toHaveLength(0);
  });

  it('rejects unknown identifiers, duplicates and invalid persisted data', () => {
    expect(normalizeDemoSelection(['math2', 'math2', 'nonexistent', 3, 'physics'])).toEqual(['math2', 'physics']);
    expect(normalizeDemoSelection({ something: 'invalid' })).toEqual(DEMO_INITIAL_IDS);
  });

  it('keeps intentionally empty selections and recovers gracefully from broken local storage', () => {
    expect(readDemoSelection({ getItem: () => '[]' })).toEqual([]);
    expect(readDemoSelection({ getItem: () => 'not json' })).toEqual(DEMO_INITIAL_IDS);
    expect(readDemoSelection({ getItem: (key) => key === DEMO_STORAGE_KEY ? '["logic"]' : null })).toEqual(['logic']);
  });
});
