import React, { useEffect, useRef, useState } from 'react';
import { Bug, Check, ClipboardCopy, Download, X } from 'lucide-react';
import {
  formatDemoBugReport,
  validateDemoBugReport,
  type DemoBugArea,
  type DemoBugSeverity,
} from '../demo/bug-report';

interface Props {
  area: DemoBugArea;
}

const fieldClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white';

export const DemoFeedback: React.FC<Props> = ({ area }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [severity, setSeverity] = useState<DemoBugSeverity>('medium');
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'manual'>('idle');
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    titleInputRef.current?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        openButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open]);

  const close = () => {
    setOpen(false);
    openButtonRef.current?.focus();
  };

  const generate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateDemoBugReport({ title, steps, expected, actual });
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setCopyStatus('idle');
    setReport(formatDemoBugReport({
      title, steps, expected, actual, severity, area,
      pathname: window.location.pathname,
      recordedAt: new Date().toISOString(),
    }));
  };

  const downloadReport = () => {
    if (!report) return;
    const file = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const element = document.createElement('a');
    element.href = url;
    element.download = `darschin-demo-${area}-feedback.txt`;
    document.body.appendChild(element);
    element.click();
    element.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copy = async () => {
    if (!report) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(report);
      setCopyStatus('success');
    } catch {
      setCopyStatus('manual');
    }
  };

  return (
    <>
      <button
        type="button"
        ref={openButtonRef}
        onClick={() => { setError(''); setCopyStatus('idle'); setOpen(true); }}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-400 px-3 text-xs font-bold text-amber-950 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-amber-100 dark:hover:bg-amber-900"
      >
        <Bug aria-hidden="true" className="h-4 w-4" /> گزارش باگ دمو
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="ساخت گزارش باگ قابل اشتراک"
            className="max-h-[95dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 text-right text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white sm:p-7"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">ثبت خطا برای دیباگ درس‌چین</h2>
              <button type="button" aria-label="بستن فرم گزارش باگ" onClick={close} className="rounded-lg p-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800">
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-7 text-blue-950 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
              این فرم <strong>هیچ داده‌ای به سرور نمی‌فرستد</strong>. گزارش را می‌سازی و کپی می‌کنی تا در GitHub Issue یا همین گفت‌وگو بفرستی.
              شماره موبایل، اطلاعات واقعی دانشجو، رمز عبور یا توکن را در متن ننویس.
            </p>

            <form onSubmit={generate} className="mt-4 space-y-4">
              <label className="block text-sm font-bold">
                عنوان خطا
                <input ref={titleInputRef} value={title} onChange={e => setTitle(e.target.value)} required maxLength={140} placeholder="مثلاً دکمه ذخیره برنامه واکنشی ندارد" className={fieldClass} />
              </label>
              <label className="block text-sm font-bold">
                میزان اهمیت
                <select value={severity} onChange={e => setSeverity(e.target.value as DemoBugSeverity)} className={fieldClass}>
                  <option value="low">کم — ایراد جزئی ظاهری</option>
                  <option value="medium">متوسط — اختلال در یک قابلیت</option>
                  <option value="high">زیاد — قابلیت اصلی قابل استفاده نیست</option>
                </select>
              </label>
              <label className="block text-sm font-bold">
                مراحل بازتولید
                <textarea value={steps} onChange={e => setSteps(e.target.value)} required rows={3} placeholder="۱. وارد پنل شدم؛ ۲. ..." className={fieldClass} />
              </label>
              <label className="block text-sm font-bold">
                رفتار مورد انتظار
                <textarea value={expected} onChange={e => setExpected(e.target.value)} required rows={2} placeholder="قرار بود چه اتفاقی بیفتد؟" className={fieldClass} />
              </label>
              <label className="block text-sm font-bold">
                رفتار مشاهده‌شده
                <textarea value={actual} onChange={e => setActual(e.target.value)} required rows={2} placeholder="واقعاً چه اتفاقی افتاد؟" className={fieldClass} />
              </label>
              {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}
              <button type="submit" className="min-h-11 w-full rounded-xl bg-blue-700 px-5 text-sm font-black text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                آماده‌سازی متن گزارش
              </button>
            </form>

            {report && (
              <div className="mt-5 border-t border-slate-200 pt-5 dark:border-slate-700">
                <label className="block text-sm font-bold">
                  متن آماده برای اشتراک‌گذاری (قابل بازبینی و ویرایش قبل از ارسال)
                  <textarea dir="auto" readOnly value={report} rows={9} className={fieldClass + ' font-mono text-xs'} onFocus={e => e.currentTarget.select()} />
                </label>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={copy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-700">
                    {copyStatus === 'success' ? <Check aria-hidden="true" className="h-4 w-4" /> : <ClipboardCopy aria-hidden="true" className="h-4 w-4" />}
                    {copyStatus === 'success' ? 'متن کپی شد' : 'کپی متن گزارش'}
                  </button>
                  <button type="button" onClick={downloadReport} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-300 px-5 text-sm font-bold text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:text-blue-200">
                    <Download aria-hidden="true" className="h-4 w-4" /> دریافت گزارش متنی
                  </button>
                  {copyStatus === 'manual' && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">کپی خودکار مجاز نیست؛ متن بالایی را انتخاب و دستی کپی کن.</p>}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
};
