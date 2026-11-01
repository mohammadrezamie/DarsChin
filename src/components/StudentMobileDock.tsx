import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, Layers3, MoreHorizontal, Sparkles, MessageCircle, Zap } from 'lucide-react';

export type StudentDestination = 'offerings' | 'schedule' | 'registration' | 'recommendations' | 'passed' | 'demand' | 'support';

const PRIMARY = [
  { id: 'offerings', label: 'دروس', icon: Layers3 },
  { id: 'schedule', label: 'برنامه', icon: CalendarDays },
  { id: 'registration', label: 'صف ثبت', icon: Zap },
] as const;

const SECONDARY = [
  { id: 'recommendations', label: 'پیشنهادهای هوشمند', detail: 'بررسی پیشنهادهای قابل انتخاب', icon: Sparkles },
  { id: 'passed', label: 'دروس پاس‌شده', detail: 'ثبت و مرور سوابق تحصیلی', icon: BookOpen },
  { id: 'demand', label: 'نیازسنجی ترم آینده', detail: 'پس از بازشدن فرم توسط مدیر گروه', icon: Layers3 },
  { id: 'support', label: 'پشتیبانی و گزارش خطا', detail: 'راهنما و ارسال درخواست', icon: MessageCircle },
] as const;

interface Props {
  active: StudentDestination;
  demandAvailable: boolean;
  onSelect: (destination: StudentDestination) => void;
}

/**
 * Compact, thumb-reachable navigation on small devices. Only three frequently
 * used workspaces are permanent; the secondary destinations are still
 * discoverable by a labelled, keyboard-accessible sheet.
 */
export const StudentMobileDock: React.FC<Props> = ({ active, demandAvailable, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const activeSecondary = SECONDARY.some(item => item.id === active);

  useEffect(() => {
    if (!expanded) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setExpanded(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href]',
      ) ?? []);
      if (!buttons.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus({ preventScroll: true });
    };
  }, [expanded]);

  const navigate = (destination: StudentDestination) => {
    setExpanded(false);
    onSelect(destination);
  };

  return (
    <>
      <nav aria-label="دسترسی سریع میز کار دانشجو" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 shadow-[0_-12px_35px_-24px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95 md:hidden print:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-1.5" dir="rtl">
          {PRIMARY.map(item => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <button key={item.id} type="button" aria-current={selected ? 'page' : undefined}
                onClick={() => navigate(item.id)}
                className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-bold leading-5 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${selected ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/65 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                <Icon aria-hidden="true" className="h-[19px] w-[19px]" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button ref={moreRef} type="button"
            aria-label="بخش‌های بیشتر میز کار"
            aria-haspopup="dialog" aria-expanded={expanded}
            onClick={() => setExpanded(true)}
            className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-bold leading-5 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${activeSecondary ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/65 dark:text-blue-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
            <MoreHorizontal aria-hidden="true" className="h-[19px] w-[19px]" />
            <span>بیشتر</span>
          </button>
        </div>
      </nav>

      {expanded && (
        <div className="fixed inset-0 z-[90] md:hidden print:hidden" dir="rtl">
          <button type="button" aria-label="بستن فهرست بخش‌ها" tabIndex={-1}
            onClick={() => setExpanded(false)}
            className="absolute inset-0 h-full w-full bg-slate-950/55 backdrop-blur-[2px]" />
          <div ref={sheetRef} role="dialog" aria-modal="true" aria-label="سایر بخش‌های میز کار دانشجو"
            className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[min(85dvh,560px)] max-w-lg flex-col overflow-y-auto rounded-t-[1.65rem] border border-slate-200 bg-white px-4 pt-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">بخش‌های میز کار</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">دسترسی سریع، بدون جابه‌جایی در صفحه‌های بلند</p>
              </div>
              <button ref={closeRef} type="button" aria-label="بستن فهرست بخش‌ها"
                onClick={() => setExpanded(false)}
                className="min-h-11 min-w-11 rounded-xl bg-slate-100 text-sm font-bold text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-800 dark:text-slate-100">
                بستن
              </button>
            </div>
            <div className="grid gap-2">
              {SECONDARY.map(item => {
                const Icon = item.icon;
                const disabled = item.id === 'demand' && !demandAvailable;
                return (
                  <button key={item.id} type="button"
                    disabled={disabled}
                    aria-current={active === item.id ? 'page' : undefined}
                    onClick={() => navigate(item.id)}
                    className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-3 py-2 text-right transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-55 ${active === item.id ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/45' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:bg-slate-800'}`}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 dark:bg-slate-900 dark:text-blue-300"><Icon aria-hidden="true" className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">{item.label}</span>
                      <span className="block text-xs leading-6 text-slate-600 dark:text-slate-400">{disabled ? 'بسته؛ منتظر اعلام مدیر گروه' : item.detail}</span>
                    </span>
                    {active === item.id && <span className="shrink-0 text-xs font-bold text-blue-700 dark:text-blue-300">فعلی</span>}
                  </button>
                );
              })}
              <details className="rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm dark:border-indigo-800 dark:bg-indigo-950/30">
                <summary className="min-h-11 cursor-pointer py-2 font-extrabold text-indigo-900 dark:text-indigo-100">
                  اضافه‌کردن درس‌چین به صفحهٔ اصلی گوشی
                </summary>
                <div className="space-y-2 border-t border-indigo-200 pt-3 text-xs leading-7 text-indigo-950 dark:border-indigo-800 dark:text-indigo-100">
                  <p><strong>آیفون (Safari):</strong> منوی اشتراک‌گذاری را باز کن و «Add to Home Screen» را انتخاب کن.</p>
                  <p><strong>اندروید (Chrome):</strong> منوی مرورگر را باز کن و «Install app» یا «Add to Home screen» را بزن.</p>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300">پس از افزودن، سامانه در پنجرهٔ مستقل باز می‌شود؛ برای دریافت اطلاعات درسی به اتصال اینترنت نیاز داری.</p>
                </div>
              </details>
              <Link to="/help" onClick={() => setExpanded(false)}
                className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-right text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                <BookOpen aria-hidden="true" className="h-5 w-5 shrink-0" />
                <span className="min-w-0"><span className="block text-sm font-extrabold">راهنمای استفاده</span><span className="block text-xs leading-6">آموزش همهٔ بخش‌ها و پاسخ سؤال‌های متداول</span></span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
