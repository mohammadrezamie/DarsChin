import React from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, GraduationCap } from 'lucide-react';
import type { AcademicLimitInfo, StudentAcademicProfile } from '../types';

export const STUDENT_JOURNEY_STEPS = [
  { title: 'پروندهٔ تحصیلی', description: 'دانشگاه، رشته، ورودی و نیمسال را بررسی کن.' },
  { title: 'کارنامهٔ ترمی', description: 'درس‌های هر نیمسال را با نتیجهٔ واقعی: پاس، مردود، غیبت امتحان یا حذف کلاسی ثبت کن.' },
  { title: 'شرایط این ترم', description: 'سقف واحد، ترم تابستان و وضعیت معدل را بررسی کن.' },
  { title: 'مرور درس‌ها و پیشنهادها', description: 'درس‌ها و دلیل پیشنهاد هوشمند را در یک فهرست ببین.' },
  { title: 'انتخاب نام درس', description: 'اول تصمیم بگیر کدام درس‌ها را می‌خواهی؛ استاد و ساعت بعداً.' },
  { title: 'تعیین استاد و ساعت', description: 'فقط برای درس‌های انتخابی، استاد، ساعت و تداخل را بررسی کن.' },
  { title: 'چینش و صف ثبت', description: 'در یک فهرست، اولویت درس‌ها، گروه اصلی، جایگزین‌ها و کد ثبت را تنظیم کن.' },
] as const;

interface Props {
  step: number;
  busy: boolean;
  hasProfile: boolean;
  hasCurriculum: boolean;
  academicLimits: AcademicLimitInfo | null;
  profile: StudentAcademicProfile | null;
  wishlistCount: number;
  selectedGroupCount?: number;
  onOpenProfile: () => void;
  onStep: (step: number) => void;
}

export const StudentJourneyStepper: React.FC<Props> = ({
  step, busy, hasProfile, hasCurriculum, academicLimits, profile, wishlistCount, selectedGroupCount = 0,
  onOpenProfile, onStep,
}) => {
  const current = STUDENT_JOURNEY_STEPS[Math.min(6, Math.max(0, step))];
  const limit = academicLimits?.effectiveMaxUnits;
  return (
    <section id="student-journey-progress" tabIndex={-1} aria-label="مسیر گام‌به‌گام آماده‌سازی انتخاب واحد" dir="rtl"
      className="scroll-mt-20 overflow-hidden rounded-[1.35rem] border border-indigo-200 bg-white p-3.5 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-900 dark:bg-slate-900 sm:p-5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
            راهنمای انتخاب واحد · مرحلهٔ {(step + 1).toLocaleString('fa-IR')} از ۷
          </p>
          <h2 className="mt-1 flex items-center gap-1.5 text-base font-extrabold text-slate-950 dark:text-white sm:text-lg">
            <GraduationCap aria-hidden="true" className="h-5 w-5 shrink-0 text-indigo-600" /> {current.title}
          </h2>
          <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">{current.description}</p>
        </div>
        <span className="shrink-0 rounded-xl bg-indigo-50 px-2.5 py-2 text-xs font-extrabold text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
          {Math.round((step / 6) * 100).toLocaleString('fa-IR')}٪
        </span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5" aria-label="پیشرفت مراحل">
        {STUDENT_JOURNEY_STEPS.map((item, index) => (
          <button key={item.title} type="button" disabled={busy || index > step}
            onClick={() => onStep(index)} title={item.title}
            aria-label={'مرحلهٔ ' + (index + 1).toLocaleString('fa-IR') + ': ' + item.title}
            aria-current={index === step ? 'step' : undefined}
            className={'flex min-h-11 min-w-0 items-center justify-center rounded-xl px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ' +
              (index > step ? 'cursor-not-allowed opacity-65' : '')}>
            <span aria-hidden="true" className={'block h-2 w-full rounded-full ' +
              (index <= step ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-200 dark:bg-slate-700')} />
            <span className="sr-only">{item.title}</span>
          </button>
        ))}
      </div>
      {step === 0 && <p className="mt-3 rounded-xl bg-sky-50 p-3 text-xs leading-7 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
        اطلاعات نمونهٔ سامانه به‌معنای تأیید پروندهٔ تو نیست. ابتدا دانشگاه، مقطع، رشته، ورودی و نیمسال را بررسی و ذخیره کن.
      </p>}
      {step === 1 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-7 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        در کارنامه، برای هر نیمسال درس‌ها و نتیجهٔ واقعی آن‌ها را ثبت کن؛ مردودی، غیبت موجه امتحان و حذف به‌دلیل غیبت کلاسی هیچ‌کدام به معنی قبولی نیستند.
      </p>}
      {step === 2 && <div className="mt-3 rounded-xl bg-indigo-50 p-3 text-xs leading-7 text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-100">
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-bold">
          <span>نیمسال: {academicLimits?.isSummer ? 'تابستان' : 'عادی'}</span>
          <span>معدل قبلی: {typeof profile?.previousTermGpa === 'number' ? profile.previousTermGpa.toLocaleString('fa-IR') : 'هنوز ثبت نشده'}</span>
          <span>سقف مؤثر: {typeof limit === 'number' ? limit.toLocaleString('fa-IR') + ' واحد' : 'نیازمند دریافت از سامانه'}</span>
        </div>
        <p className="mt-1">این عدد از تنظیمات و تحلیل سمت سرور به دست می‌آید؛ مجوز قطعی انتخاب واحد دانشگاه نیست. اگر معدل یا نیمسال اشتباه است، پرونده را اصلاح کن.</p>
      </div>}
      {step === 4 && <p className="mt-3 rounded-xl bg-indigo-50 p-3 text-xs leading-7 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
        الان {wishlistCount.toLocaleString('fa-IR')} درس در سبد علاقه‌مندی داری. این سبد سقف واحد انتخاب نهایی را مصرف نمی‌کند.
      </p>}
      {step === 5 && <p className="mt-3 rounded-xl bg-indigo-50 p-3 text-xs leading-7 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
        گروه‌های درس‌های سبدت را به ترتیب اولویت می‌بینی؛ استاد، زمان و تداخل را بررسی کن. فقط گروه‌های واقعاً مجاز را می‌توانی وارد برنامهٔ نهایی کنی. اکنون {selectedGroupCount.toLocaleString('fa-IR')} گروه انتخاب کرده‌ای.
      </p>}
      {step === 4 && wishlistCount === 0 && <p role="status" className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300">حداقل یک درس را به سبد علاقه‌مندی اضافه کن تا سراغ گروه‌ها بروی.</p>}
      {step === 5 && selectedGroupCount === 0 && <p role="status" className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300">برای آماده‌سازی صف ثبت، اول حداقل یک گروه مجاز را انتخاب کن.</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(step === 0 || step === 2) && <button type="button" onClick={onOpenProfile}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
          <BookOpen className="h-4 w-4" aria-hidden="true" /> اصلاح پرونده
        </button>}
        {step < 6 ? <button type="button" disabled={busy || (step === 0 && (!hasProfile || !hasCurriculum)) || (step === 2 && !academicLimits) || (step === 4 && wishlistCount === 0) || (step === 5 && selectedGroupCount === 0)}
          onClick={() => onStep(step + 1)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-50">
          {busy ? 'در حال ذخیره…' : step === 0 ? 'پرونده‌ام را بررسی و تأیید کردم' :
            step === 1 ? 'سوابق ثبت‌شده را بررسی کردم' : step === 2 ? 'شرایط را دیدم؛ مرور درس‌ها' :
            step === 3 ? 'انتخاب نام درس' : step === 4 ? 'حالا استاد و ساعت را انتخاب می‌کنم' : 'چینش اولویت و آماده‌سازی ثبت'}
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        </button> : <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5" /> همهٔ بخش‌ها را مرور کردی. برنامهٔ نهایی همچنان باید با قوانین و اطلاعات واقعی بررسی شود.
        </p>}
        {step > 0 && <button type="button" disabled={busy} onClick={() => onStep(step - 1)}
          className="min-h-11 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
          مرحلهٔ قبل
        </button>}
      </div>
    </section>
  );
};
