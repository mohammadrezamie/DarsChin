import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CLASS_DAYS, CLASS_START_MINUTE, CLASS_END_MINUTE, HOUR_HEIGHT,
  FluidWeekTimetable, isClassPlottable, parseClassMinutes, placeTimedClasses,
} from '../src/components/FluidWeekTimetable';

const a = { id: 'a', title: 'مدارهای الکتریکی', day: 'شنبه', start: '07:30', end: '09:10' };
const b = { id: 'b', title: 'ریاضی', day: 'شنبه', start: '08:05', end: '09:00' };
const c = { id: 'c', title: 'فیزیک', day: 'شنبه', start: '09:10', end: '10:15' };

describe('minute-accurate timetable for the SRBIAU pilot', () => {
  it('uses 07:00–20:00 and accepts arbitrary minute boundaries, including Persian digits', () => {
    expect(CLASS_START_MINUTE).toBe(420);
    expect(CLASS_END_MINUTE).toBe(1200);
    expect(CLASS_DAYS).toContain('جمعه');
    expect(parseClassMinutes('۰۷:۳۵')).toBe(455);
    expect(parseClassMinutes('۲۰:۰۰')).toBe(1200);
    expect(parseClassMinutes('7:05')).toBe(425);
    expect(parseClassMinutes('24:00')).toBeNull();
    expect(parseClassMinutes('نامشخص')).toBeNull();
  });

  it('does not duplicate classes into fixed two-hour slots', () => {
    const placed = placeTimedClasses([a, b, c]);
    expect(placed).toHaveLength(3);
    const first = placed.find(row => row.id === 'a')!;
    const overlap = placed.find(row => row.id === 'b')!;
    const sequential = placed.find(row => row.id === 'c')!;
    expect(first.top).toBe(0.5 * HOUR_HEIGHT);
    expect(first.height).toBeCloseTo(100 / 60 * HOUR_HEIGHT);
    expect(overlap.lanes).toBe(2);
    expect(first.lane).not.toBe(overlap.lane);
    expect(sequential.lanes).toBe(1);
    expect(sequential.top).toBeCloseTo(130 / 60 * HOUR_HEIGHT);
  });

  it('keeps undated, incomplete and out-of-range classes visible outside the grid', () => {
    const unknown = { id: 'unknown', title: 'پروژه', day: 'نامشخص', start: '', end: '' };
    const before = { id: 'before', title: 'کلاس زودهنگام', day: 'شنبه', start: '06:30', end: '08:30' };
    const late = { id: 'late', title: 'کلاس شبانه', day: 'جمعه', start: '19:30', end: '20:30' };
    const invalid = { id: 'invalid', title: 'زمان معکوس', day: 'یکشنبه', start: '12:00', end: '10:00' };
    expect([unknown, before, late, invalid].every(row => !isClassPlottable(row))).toBe(true);
    expect(placeTimedClasses([a, unknown, before, late, invalid])).toHaveLength(1);
    const html = renderToStaticMarkup(<FluidWeekTimetable entries={[a, unknown, before, late, invalid]} />);
    expect(html).toContain('07:00');
    expect(html).toContain('20:00');
    for (const row of [unknown, before, late, invalid]) expect(html).toContain(row.title);
    expect(html).toContain('خارج از بازه');
  });
});
