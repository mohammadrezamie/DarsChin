import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CompactMobileTimetable } from '../src/components/CompactMobileTimetable';
import { CLASS_DAYS, HOUR_HEIGHT, placeTimedClasses } from '../src/components/FluidWeekTimetable';

const classA = {
  id: 'circuits', title: 'مدارهای الکتریکی بسیار بلند با نام استاد نمونه',
  day: 'دوشنبه', start: '08:10', end: '09:45', subtitle: 'استاد آزمایشی', conflict: true,
};
const classB = { id: 'math', title: 'ریاضی', day: 'دوشنبه', start: '10:00', end: '12:15' };
const getDays = (entries: typeof classA[] | typeof classB[] | any[]) => {
  const placed = placeTimedClasses(entries);
  return CLASS_DAYS.map(day => ({ day, entries: placed.filter(item => item.day === day) }));
};

describe('compact RTL mobile agenda', () => {
  it('opens on the first day containing courses, not an unrelated empty Saturday', () => {
    const html = renderToStaticMarkup(
      <CompactMobileTimetable days={getDays([classA, classB])}
        canvasHeight={13 * HOUR_HEIGHT} hourHeight={HOUR_HEIGHT}
        onRemove={() => {}} />,
    );
    const selectedTab = html.match(/<button[^>]*aria-selected="true"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(selectedTab).toContain('دوشنبه');
    expect(html.match(/role="tab"/g)).toHaveLength(7);
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('aria-labelledby=');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('نمای دقیق زمانی');
    expect(html).not.toContain('خط زمان دقیق دوشنبه');
    expect(html).not.toContain('style="height:728px"');
    expect(html).toContain('مدارهای الکتریکی بسیار بلند');
    expect(html).toContain('استاد آزمایشی');
    expect(html).toContain('دارای تداخل');
    expect(html).toContain('حذف مدارهای الکتریکی بسیار بلند');
    expect(html).toContain('min-h-11');
    expect(html).toContain('08:10');
    expect(html).toContain('12:15');
  });

  it('displays an honest empty state without wasting vertical height', () => {
    const html = renderToStaticMarkup(
      <CompactMobileTimetable days={getDays([])} canvasHeight={13 * HOUR_HEIGHT} hourHeight={HOUR_HEIGHT} />,
    );
    expect(html).toContain('برای این روز کلاسی با ساعت مشخص در برنامه نیست.');
    expect(html).not.toContain('نمای دقیق زمانی');
    expect(html).not.toContain('style="height:728px"');
    expect(html.match(/role="tab"/g)).toHaveLength(7);
  });

  it('preserves minutes and concurrency details for the optional exact timeline', () => {
    const placed = placeTimedClasses([
      { ...classA, end: '10:00' },
      { ...classB, start: '09:15', end: '10:45' },
    ]);
    expect(placed).toHaveLength(2);
    expect(placed[0].lanes).toBe(2);
    expect(placed[1].lanes).toBe(2);
    expect(placed[0].top).toBeCloseTo(70 / 60 * HOUR_HEIGHT);
    expect(placed[0].height).toBeCloseTo(110 / 60 * HOUR_HEIGHT);
  });
});
