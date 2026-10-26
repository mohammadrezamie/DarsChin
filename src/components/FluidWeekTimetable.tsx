import React, { useMemo } from 'react';
import { CompactMobileTimetable } from './CompactMobileTimetable';
import { Clock3, AlertTriangle } from 'lucide-react';

/** Time is continuous, not partitioned into guessed two-hour class periods. */
export const CLASS_START_MINUTE = 7 * 60;
export const CLASS_END_MINUTE = 20 * 60;
export const HOUR_HEIGHT = 56;
export const CLASS_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'] as const;

export interface TimedClass {
  id: string;
  title: string;
  day?: string | null;
  start?: string | null;
  end?: string | null;
  subtitle?: string;
  conflict?: boolean;
}
export interface PlacedClass extends TimedClass {
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

const latinDigits = (s: string) => s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const dayKey = (value?: string | null) => (value || '')
  .replace(/\u200c/g, '').replace(/\s+/g, '').replace(/پنج‌شنبه/g, 'پنجشنبه');
export const normalizeClassDay = (value?: string | null) =>
  CLASS_DAYS.find(day => dayKey(day) === dayKey(value));

export function parseClassMinutes(value?: string | null): number | null {
  if (!value || !/^\s*[0-9۰-۹٠-٩]{1,2}:[0-9۰-۹٠-٩]{2}\s*$/.test(value)) return null;
  const [hour, minute] = latinDigits(value.trim()).split(':').map(Number);
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? hour * 60 + minute : null;
}

export function isClassPlottable(item: TimedClass): boolean {
  const start = parseClassMinutes(item.start);
  const end = parseClassMinutes(item.end);
  return !!normalizeClassDay(item.day) && start !== null && end !== null &&
    start < end && start >= CLASS_START_MINUTE && end <= CLASS_END_MINUTE;
}

/** Assign side-by-side lanes only to simultaneous classes; every block retains its exact minute position. */
export function placeTimedClasses(items: TimedClass[]): PlacedClass[] {
  const rows = items.filter(isClassPlottable)
    .map(item => ({
      ...item,
      startMinute: parseClassMinutes(item.start)!,
      endMinute: parseClassMinutes(item.end)!,
    }))
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
  const result: PlacedClass[] = [];
  for (const day of CLASS_DAYS) {
    const daily = rows.filter(item => normalizeClassDay(item.day) === day);
    let group: typeof daily = [];
    const flush = () => {
      if (!group.length) return;
      const laneEnds: number[] = [];
      const assignments = group.map(item => {
        let lane = laneEnds.findIndex(end => end <= item.startMinute);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(item.endMinute); }
        else laneEnds[lane] = item.endMinute;
        return { item, lane };
      });
      for (const { item, lane } of assignments) {
        result.push({
          ...item,
          top: (item.startMinute - CLASS_START_MINUTE) / 60 * HOUR_HEIGHT,
          height: (item.endMinute - item.startMinute) / 60 * HOUR_HEIGHT,
          lane,
          lanes: laneEnds.length,
        });
      }
      group = [];
    };
    let groupMaxEnd = -1;
    for (const item of daily) {
      if (group.length && item.startMinute >= groupMaxEnd) { flush(); groupMaxEnd = -1; }
      group.push(item);
      groupMaxEnd = Math.max(groupMaxEnd, item.endMinute);
    }
    flush();
  }
  return result;
}

export const FluidWeekTimetable: React.FC<{
  entries: TimedClass[];
  onRemove?: (id: string) => void;
}> = ({ entries, onRemove }) => {
  const placed = useMemo(() => placeTimedClasses(entries), [entries]);
  const unscheduled = entries.filter(item => !isClassPlottable(item));
  const canvasHeight = (CLASS_END_MINUTE - CLASS_START_MINUTE) / 60 * HOUR_HEIGHT;
  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        بازه نمایش ۷ صبح تا ۸ شب است. جای هر کلاس دقیقاً بر اساس ساعت شروع و پایان واقعی تعیین می‌شود؛ کلاس‌های بی‌زمان یا خارج از این محدوده پایین جدول می‌آیند.
      </div>
      {/* A compact, keyboard-accessible agenda is the default on mobile. */}
      <CompactMobileTimetable
        days={CLASS_DAYS.map(day => ({
          day,
          entries: placed.filter(item => normalizeClassDay(item.day) === day),
        }))}
        canvasHeight={canvasHeight}
        hourHeight={HOUR_HEIGHT}
        onRemove={onRemove}
      />

      {/* Desktop: all seven days on a continuous exact-minute ruler. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 md:block"
        aria-label="برنامهٔ پیوستهٔ هفتگی از ساعت ۷ تا ۲۰">
        <div className="flex min-w-[1120px] gap-1.5">
          <div className="w-[72px] shrink-0 bg-slate-50/60 dark:bg-slate-800/20">
            <div className="flex h-12 items-center justify-start border-b border-slate-200 pr-2 text-xs font-bold dark:border-slate-700">ساعت</div>
            <div className="relative" style={{ height: canvasHeight }}>
              {Array.from({ length: 14 }, (_, i) => (
                <span key={i} dir="ltr" className="absolute right-1 -translate-y-1/2 text-right font-mono text-[11px] text-slate-600 dark:text-slate-300"
                  style={{ top: i * HOUR_HEIGHT }}>
                  {String(i + 7).padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </div>
          {CLASS_DAYS.map(day => (
            <section key={day} aria-label={day} className="min-w-0 flex-1 rounded-xl bg-slate-50/35 dark:bg-slate-800/10">
              <div className="flex h-12 items-center justify-start bg-slate-50/70 pr-2 text-xs font-black dark:bg-slate-800/25">{day}</div>
              <div className="relative" style={{ height: canvasHeight }}>
                {placed.filter(item => normalizeClassDay(item.day) === day).map(item => (
                  <div key={item.id}
                    title={`${item.title} — ${item.start} تا ${item.end}`}
                    className={`absolute overflow-hidden rounded-lg border p-1.5 text-right text-[11px] shadow-sm ${item.conflict
                      ? 'border-rose-400 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100'
                      : 'border-blue-300 bg-blue-100 text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100'}`}
                    style={{
                      top: item.top + 1,
                      height: Math.max(8, item.height - 2),
                      right: `calc(${item.lane / item.lanes * 100}% + 2px)`,
                      width: `calc(${100 / item.lanes}% - 4px)`,
                    }}>
                    <div className="truncate font-extrabold">{item.title}</div>
                    {item.height > 35 && <div dir="ltr" className="mt-0.5 text-right font-mono text-[10px]">{item.start}–{item.end}</div>}
                    {item.height > 60 && item.subtitle && <div className="mt-0.5 truncate text-[10px] opacity-80">{item.subtitle}</div>}
                    {onRemove && item.height > 86 && <button type="button" onClick={() => onRemove(item.id)}
                      className="mt-1 rounded bg-white/70 px-2 py-0.5 text-[10px] font-semibold dark:bg-slate-800"
                      aria-label={`حذف ${item.title} از برنامه`}>حذف</button>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      {unscheduled.length > 0 && (
        <section aria-label="کلاس‌های بدون زمان یا خارج از محدوده" className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <h3 className="flex items-center gap-2 text-sm font-black text-amber-900 dark:text-amber-200">
            <AlertTriangle aria-hidden="true" className="h-4 w-4" /> کلاس‌های با زمان نامشخص یا خارج از بازه ۷ تا ۲۰
          </h3>
          <p className="mt-1 text-xs leading-6 text-amber-800 dark:text-amber-300">این کلاس‌ها حذف نشده‌اند؛ ساعت معتبر یا خارج از بازه را باید جداگانه بررسی کنی.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {unscheduled.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white p-3 text-xs dark:border-amber-900 dark:bg-slate-900">
                <div className="min-w-0">
                  <strong className="block truncate text-slate-900 dark:text-white">{item.title}</strong>
                  <span className="text-slate-600 dark:text-slate-300">{item.day || 'روز نامشخص'} · {item.start || '؟'} تا {item.end || '؟'}</span>
                </div>
                {onRemove && <button type="button" onClick={() => onRemove(item.id)} className="shrink-0 rounded-lg border border-rose-200 px-3 py-2 font-bold text-rose-700 dark:text-rose-300">حذف</button>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
