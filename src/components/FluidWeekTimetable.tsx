import React, { useMemo, useState } from 'react';
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
  const [mobileDay, setMobileDay] = useState<(typeof CLASS_DAYS)[number]>('شنبه');
  const placed = useMemo(() => placeTimedClasses(entries), [entries]);
  const unscheduled = entries.filter(item => !isClassPlottable(item));
  const mobileEntries = placed.filter(item => normalizeClassDay(item.day) === mobileDay);
  const canvasHeight = (CLASS_END_MINUTE - CLASS_START_MINUTE) / 60 * HOUR_HEIGHT;
  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        بازه نمایش ۷ صبح تا ۸ شب است. جای هر کلاس دقیقاً بر اساس ساعت شروع و پایان واقعی تعیین می‌شود؛ کلاس‌های بی‌زمان یا خارج از این محدوده پایین جدول می‌آیند.
      </div>
      {/* Mobile: choose a day rather than squishing seven columns into 320px. */}
      <div className="space-y-3 md:hidden">
        <div className="darschin-scroll-x flex gap-2 pb-2" role="tablist" aria-label="انتخاب روز برنامهٔ هفتگی">
          {CLASS_DAYS.map(day => (
            <button key={day} type="button" role="tab"
              aria-selected={mobileDay === day}
              onClick={() => setMobileDay(day)}
              className={`min-h-11 shrink-0 rounded-xl border px-3 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${mobileDay===day
                ? 'border-blue-600 bg-blue-700 text-white'
                : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}>
              {day}
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={`برنامهٔ ${mobileDay}`}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3 text-sm font-black dark:border-slate-700 dark:bg-slate-800">
            <Clock3 aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            {mobileDay} · ساعت ۰۷:۰۰ تا ۲۰:۰۰
          </div>
          <div className="flex">
            <div className="w-14 shrink-0 bg-slate-50/60 dark:bg-slate-800/20">
              <div className="relative" style={{height:canvasHeight}}>
                {Array.from({length:14},(_,i)=>(
                  <span key={i} dir="ltr" className="absolute right-1 -translate-y-1/2 font-mono text-[10px] text-slate-600 dark:text-slate-300"
                    style={{top:i*HOUR_HEIGHT}}>{String(i+7).padStart(2,'0')}:00</span>
                ))}
              </div>
            </div>
            <div className="relative min-w-0 flex-1" style={{height:canvasHeight}}>
              {mobileEntries.map(item=>(
                <div key={item.id} title={`${item.title} · ${item.start} تا ${item.end}`}
                  className={`absolute overflow-hidden rounded-lg border p-2 text-right text-xs shadow-sm ${item.conflict
                    ? 'border-rose-400 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100'
                    : 'border-blue-300 bg-blue-100 text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100'}`}
                  style={{top:item.top+1,height:Math.max(8,item.height-2),
                    right:`calc(${item.lane/item.lanes*100}% + 2px)`,
                    width:`calc(${100/item.lanes}% - 4px)`}}>
                  <strong className="block truncate">{item.title}</strong>
                  {item.height>35 && <span dir="ltr" className="block text-right font-mono text-[10px]">{item.start}–{item.end}</span>}
                  {item.height>60 && item.subtitle && <span className="block truncate opacity-80">{item.subtitle}</span>}
                </div>
              ))}
            </div>
          </div>
          {!mobileEntries.length && <p className="border-t border-slate-200 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300">برای این روز کلاسی با ساعت مشخص در برنامه نیست.</p>}
          {mobileEntries.length>0 && <div className="space-y-2 border-t border-slate-200 p-3 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">درس‌های {mobileDay} · قابل بررسی و حذف</p>
            {mobileEntries.map(item=>(
              <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
                <div className="min-w-0"><strong className="block truncate text-xs">{item.title}</strong>
                  <span dir="ltr" className="block text-right text-[11px] text-slate-500 dark:text-slate-300">{item.start}–{item.end}</span>
                </div>
                {onRemove && <button type="button" onClick={()=>onRemove(item.id)}
                  aria-label={`حذف ${item.title} از برنامه`}
                  className="min-h-10 shrink-0 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700 dark:border-rose-900 dark:text-rose-300">حذف</button>}
              </div>
            ))}
          </div>}
        </div>
      </div>

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
