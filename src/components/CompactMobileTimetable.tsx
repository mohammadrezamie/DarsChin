import React, { useId, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock3 } from 'lucide-react';
import type { PlacedClass } from './FluidWeekTimetable';

type DayAgenda = { day: string; entries: PlacedClass[] };

/**
 * A dense agenda is easier to scan than 13 hours of mostly empty time slots.
 * The original minute-accurate timeline is still available on demand.
 */
export const CompactMobileTimetable: React.FC<{
  days: DayAgenda[];
  canvasHeight: number;
  hourHeight: number;
  onRemove?: (id: string) => void;
}> = ({ days, canvasHeight, hourHeight, onRemove }) => {
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const id = useId();
  const selectedDay = days.find(item => item.day === chosenDay)
    ?? days.find(item => item.entries.length > 0)
    ?? days[0];
  if (!selectedDay) return null;

  const chooseDay = (day: string) => {
    setChosenDay(day);
    setShowTimeline(false);
  };
  const handleDayKeys = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === 'ArrowLeft') next = (index + 1) % days.length;
    else if (event.key === 'ArrowRight') next = (index - 1 + days.length) % days.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = days.length - 1;
    else return;
    event.preventDefault();
    chooseDay(days[next].day);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <section className="space-y-2.5 md:hidden" aria-label="برنامهٔ فشردهٔ هفتگی">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">برنامهٔ روزانه</h3>
        <span className="text-xs text-slate-600 dark:text-slate-300">برای دیدن روز دیگر، آن را انتخاب کن</span>
      </div>
      <div className="darschin-scroll-x flex gap-1.5 pb-2" role="tablist" aria-label="انتخاب روز برنامهٔ هفتگی">
        {days.map(({ day, entries }, index) => {
          const selected = selectedDay.day === day;
          const conflicts = entries.some(item => item.conflict);
          return (
            <button key={day} id={`${id}-day-${index}`} type="button" role="tab"
              aria-selected={selected} aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => chooseDay(day)}
              onKeyDown={event => handleDayKeys(event, index)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${selected
                ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}>
              <span>{day}</span>
              <span aria-label={`${entries.length} کلاس`}
                className={`inline-flex min-w-5 items-center justify-center rounded-md px-1 text-[11px] ${selected
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>
                {entries.length}
              </span>
              {conflicts && <span aria-label="دارای تداخل" title="دارای تداخل"
                className="h-2 w-2 rounded-full bg-rose-500 ring-1 ring-white/70" />}
            </button>
          );
        })}
      </div>

      <div id={`${id}-panel`} role="tabpanel"
        aria-labelledby={`${id}-day-${days.findIndex(day => day.day === selectedDay.day)}`}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex min-h-11 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 dark:border-slate-700 dark:bg-slate-800/70">
          <strong className="text-sm text-slate-900 dark:text-slate-100">{selectedDay.day}</strong>
          <span className="text-xs text-slate-600 dark:text-slate-300">{selectedDay.entries.length} کلاس زمان‌دار</span>
        </div>

        {selectedDay.entries.length === 0 ? (
          <p className="px-3 py-5 text-sm text-slate-600 dark:text-slate-300">
            برای این روز کلاسی با ساعت مشخص در برنامه نیست.
          </p>
        ) : (
          <ol className="divide-y divide-slate-100 dark:divide-slate-800">
            {selectedDay.entries.map(item => (
              <li key={item.id} className="flex min-w-0 items-center gap-2.5 px-3 py-2.5">
                <div dir="ltr" className="flex w-[4.25rem] shrink-0 flex-col items-center rounded-lg bg-slate-100 px-1 py-1.5 font-mono text-[11px] font-semibold leading-5 tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <time dateTime={item.start || undefined}>{item.start}</time>
                  <span className="h-px w-6 bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
                  <time dateTime={item.end || undefined}>{item.end}</time>
                </div>
                <div className="min-w-0 flex-1">
                  <strong className="block break-words text-[13px] font-bold leading-6 text-slate-900 dark:text-slate-100">{item.title}</strong>
                  {item.subtitle && <p className="break-words text-xs leading-5 text-slate-600 dark:text-slate-300">{item.subtitle}</p>}
                  {item.conflict && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                      <AlertTriangle aria-hidden="true" className="h-3 w-3" /> دارای تداخل
                    </span>
                  )}
                </div>
                {onRemove && (
                  <button type="button" onClick={() => onRemove(item.id)}
                    aria-label={`حذف ${item.title} از برنامه`}
                    className="min-h-11 shrink-0 rounded-lg border border-rose-200 px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40">
                    حذف
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}

        {selectedDay.entries.length > 0 && (
          <>
            <button type="button" aria-expanded={showTimeline}
              aria-controls={showTimeline ? `${id}-timeline` : undefined}
              onClick={() => setShowTimeline(open => !open)}
              className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-slate-200 px-3 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              {showTimeline ? 'بستن نمای زمانی' : 'نمای دقیق زمانی'}
              {showTimeline ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            </button>
            {showTimeline && (
              <div id={`${id}-timeline`} aria-label={`خط زمان دقیق ${selectedDay.day}`}
                className="flex border-t border-slate-200 dark:border-slate-700">
                <div className="w-14 shrink-0 bg-slate-50/70 dark:bg-slate-800/20">
                  <div className="relative" style={{ height: canvasHeight }}>
                    {Array.from({ length: 14 }, (_, i) => (
                      <span key={i} dir="ltr" className="absolute right-1 -translate-y-1/2 font-mono text-[10px] text-slate-600 dark:text-slate-300"
                        style={{ top: i * hourHeight }}>{String(i + 7).padStart(2, '0')}:00</span>
                    ))}
                  </div>
                </div>
                <div className="relative min-w-0 flex-1" style={{ height: canvasHeight }}>
                  {selectedDay.entries.map(item => (
                    <div key={item.id} title={`${item.title} · ${item.start} تا ${item.end}`}
                      className={`absolute overflow-hidden rounded-lg border p-1.5 text-right text-[11px] ${item.conflict
                        ? 'border-rose-400 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100'
                        : 'border-blue-300 bg-blue-100 text-blue-950 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100'}`}
                      style={{
                        top: item.top + 1,
                        height: Math.max(8, item.height - 2),
                        right: `calc(${item.lane / item.lanes * 100}% + 2px)`,
                        width: `calc(${100 / item.lanes}% - 4px)`,
                      }}>
                      <strong className="block truncate">{item.title}</strong>
                      {item.height > 35 && <span dir="ltr" className="block text-right font-mono text-[10px]">{item.start}–{item.end}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
