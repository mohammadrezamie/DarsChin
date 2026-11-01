import React, { useState } from 'react';
import { BookOpenText, ChevronDown, CircleHelp, Compass, Lightbulb } from 'lucide-react';

export const studentHelp = {
  offerings: {
    title: 'بررسی دروس ارائه‌شده',
    summary: 'ببین چه گروه‌هایی وجود دارند و چرا ممکن است بعضی درس‌ها با سوابقت سازگار نباشند.',
    steps: ['پروفایل و چارت ورودی را درست انتخاب کن.', 'درس یا استاد را پیدا کن و دلیل وضعیت هر درس را بخوان.', 'گروه‌های دلخواهت را به برنامه اضافه کن؛ قبل از ثبت نهایی دوباره بررسی کن.'],
    tip: 'اگر سوابق یا چارت کامل نیست، نتیجهٔ «مجاز» قطعی نیست.',
  },
  schedule: {
    title: 'برنامهٔ هفتگی من',
    summary: 'ساعت کلاس‌ها، تداخل‌ها و گروه‌های جایگزین را کنار هم مرور کن.',
    steps: ['گروه‌های منتخب را در جدول هفتگی ببین.', 'برای درس‌های هم‌زمان، یک گروه جایگزین انتخاب کن.', 'تداخل کلاس و امتحان را بررسی کن و برنامه را ذخیره کن.'],
    tip: 'جدول هفتگی جای تأیید نهایی در سامانهٔ رسمی دانشگاه را نمی‌گیرد.',
  },
  registration: {
    title: 'صف سریع ثبت',
    summary: 'برای روز انتخاب واحد، کد گروه‌ها را با ترتیب دلخواه و دسترسی سریع آماده کن.',
    steps: ['در برنامه‌ریز، گروه‌های مدنظرت را انتخاب کن.', 'در حالت چیدمان، اولویت درس‌ها را بالا و پایین ببر.', 'کد هر گروه را کپی کن و بعد از ثبت در سامانهٔ رسمی، تیک شخصی بزن.'],
    tip: 'تیک صف ثبت صرفاً برای پیگیری خودت است و به معنای ثبت واقعی درس نیست.',
  },
  recommendations: {
    title: 'پیشنهادهای درسی',
    summary: 'گزینه‌های مناسب‌تر را از نظر اطلاعات موجود بررسی و با انتخاب‌های خودت مقایسه کن.',
    steps: ['سوابق دروس پاس‌شده و پروفایل را تکمیل کن.', 'دلیل هر پیشنهاد و محدودیتش را ببین.', 'پیشنهاد را به برنامه اضافه کن یا بر اساس شرایط واقعی کنار بگذار.'],
    tip: 'پیشنهاد خودکار حکم مجوز دانشگاه یا تضمین ارائهٔ درس را ندارد.',
  },
  passed: {
    title: 'دروس پاس‌شده',
    summary: 'دروس گذرانده‌شده را وارد کن تا بررسی پیش‌نیازها دقیق‌تر شود.',
    steps: ['چارت و ورودی خودت را مشخص کن.', 'فقط دروسی را که واقعاً گذرانده‌ای با وضعیت درست ثبت کن.', 'بعد از تغییر سوابق، پیشنهادها و برنامه را دوباره بررسی کن.'],
    tip: 'اگر از نتیجهٔ معادل‌سازی یا تطبیق واحد مطمئن نیستی، با آموزش بررسی کن.',
  },
  demand: {
    title: 'نیازسنجی ترم آینده',
    summary: 'اگر فرم مربوط به ورودی تو فعال باشد، نیازهای درسی‌ات را برای برنامه‌ریزی اعلام کن.',
    steps: ['فرم فعال مربوط به ورودی و رشتهٔ خودت را انتخاب کن.', 'دروس موردنیازت را از چارت همان ورودی مشخص کن.', 'پاسخ را ثبت کن و پیام ذخیرهٔ موفق را بررسی کن.'],
    tip: 'نیازسنجی به معنی قطعی‌شدن ارائهٔ درس یا انتخاب واحد نیست.',
  },
  support: {
    title: 'راهنما و پشتیبانی',
    summary: 'اگر در سامانه به مشکل خوردی، روش استفاده را مرور کن و درخواست یا گزارش خطا بفرست.',
    steps: ['راهنمای بخش مربوط را بخوان.', 'اگر مشکل باقی بود، نوع درخواست را انتخاب کن.', 'عنوان، شرح کوتاه و مراحل رخ‌دادن مشکل را بدون رمز و اطلاعات حساس بفرست.'],
    tip: 'هیچ‌وقت رمز ورود یا کد تأیید پیامکی را در تیکت وارد نکن.',
  },
} as const;

export type StudentGuideTab = keyof typeof studentHelp;
const faqa = [
  { q: 'آیا درس‌چین برای من انتخاب واحد می‌کند؟', a: 'خیر. درس‌چین برنامه‌ریزی و آماده‌سازی کدها را ساده می‌کند؛ ثبت نهایی در سامانهٔ رسمی انجام می‌شود.' },
  { q: 'چرا وضعیت یک درس نامشخص یا غیرمجاز است؟', a: 'ممکن است سوابق، چارت ورودی، پیش‌نیازها یا اطلاعات ارائه کامل نباشند. دلیل نمایش‌داده‌شده را بخوان و با منبع معتبر بررسی کن.' },
  { q: 'تیک «ثبت‌شده» در صف یعنی درس واقعاً ثبت شده؟', a: 'خیر. این تیک فقط یک یادداشت شخصی برای مرتب‌بودن مراحل ثبت است.' },
  { q: 'اطلاعات دمو واقعی است؟', a: 'خیر. درس‌ها، زمان‌ها و نقش‌های دموی بدون حساب ساختگی‌اند و صرفاً برای یادگیری رابط استفاده می‌شوند.' },
  { q: 'از کجا متوجه شوم تغییراتم ذخیره شده؟', a: 'پیام وضعیت ذخیره را در میز کار بررسی کن. اگر خطا یا قطعی ارتباط دیدی، پیش از خروج دوباره امتحان کن.' },
] as const;

export function StudentWorkspaceGuide({ active, onSelect, demandAvailable }: {
  active: StudentGuideTab;
  onSelect: (tab: StudentGuideTab) => void;
  demandAvailable: boolean;
}): React.ReactElement {
  const [fullOpen, setFullOpen] = useState(false);
  const current = studentHelp[active];
  return (
    <aside dir="rtl" aria-label="راهنمای استفادهٔ دانشجو" className="mb-3 min-w-0 space-y-2 print:hidden">
      <details key={active} className="group min-w-0 rounded-2xl border border-blue-200 bg-gradient-to-l from-blue-50 to-white px-3 py-2 dark:border-blue-900 dark:from-blue-950/30 dark:to-slate-900 sm:px-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-1 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <span className="flex min-w-0 items-center gap-2">
            <CircleHelp aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" />
            <span className="min-w-0">
              <span className="block text-xs font-extrabold leading-6 text-blue-900 dark:text-blue-100">این بخش چه کاری می‌کند؟ {current.title}</span>
              <span className="block text-xs leading-6 text-slate-600 dark:text-slate-300">{current.summary}</span>
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-700 transition-transform group-open:rotate-180 dark:text-blue-300" />
        </summary>
        <div className="border-t border-blue-100 pb-2 pt-3 dark:border-blue-900/80">
          <p className="mb-2 text-xs font-black text-slate-900 dark:text-white">چطور از این بخش استفاده کنم؟</p>
          <ol className="space-y-2 pr-5 text-xs leading-7 text-slate-700 dark:text-slate-200" style={{ listStyle: 'decimal' }}>
            {current.steps.map(step => <li key={step}>{step}</li>)}
          </ol>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-white/80 px-3 py-2 text-xs leading-6 text-amber-900 dark:bg-slate-950/60 dark:text-amber-200">
            <Lightbulb aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" /> {current.tip}
          </p>
        </div>
      </details>
      <button type="button" onClick={() => setFullOpen(value => !value)}
        aria-expanded={fullOpen} aria-controls="student-all-section-help"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-extrabold text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-slate-800">
        <BookOpenText aria-hidden="true" className="h-4 w-4" /> {fullOpen ? 'بستن راهنمای کامل' : 'راهنمای کامل بخش‌ها و سؤال‌های رایج'}
        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${fullOpen ? 'rotate-180' : ''}`} />
      </button>
      {fullOpen && (
        <section id="student-all-section-help" aria-label="راهنمای کامل میز کار دانشجو"
          className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white">
            <Compass aria-hidden="true" className="h-5 w-5 text-blue-700 dark:text-blue-300" /> راهنمای همهٔ بخش‌ها
          </h3>
          <p className="mt-2 text-xs leading-7 text-slate-600 dark:text-slate-300">
            از هر قسمت می‌توانی مستقیماً وارد همان فضای کار شوی. ابتدا چارت و سوابقت را بررسی کن، سپس گروه‌ها را انتخاب و برنامه‌ات را آماده کن.
          </p>
          <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.entries(studentHelp) as [StudentGuideTab, typeof current][]).map(([key, guide]) => (
              <button key={key} type="button" disabled={key === 'demand' && !demandAvailable}
                onClick={() => { onSelect(key); setFullOpen(false); }}
                className="min-h-20 min-w-0 rounded-xl border border-slate-200 px-3 py-3 text-right hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">
                <span className="block text-xs font-black text-slate-950 dark:text-white">{guide.title}</span>
                <span className="mt-1 block text-xs leading-6 text-slate-600 dark:text-slate-300">{guide.summary}</span>
              </button>
            ))}
          </div>
          <h4 className="mt-6 text-sm font-black text-slate-950 dark:text-white">سؤال‌های متداول</h4>
          <div className="mt-2 space-y-2">
            {faqa.map(({q,a}) => (
              <details key={q} className="rounded-xl border border-slate-200 px-3 py-1 dark:border-slate-700">
                <summary className="min-h-11 cursor-pointer py-2 text-xs font-bold leading-7 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-white">{q}</summary>
                <p className="border-t border-slate-100 py-3 text-xs leading-7 text-slate-600 dark:border-slate-700 dark:text-slate-300">{a}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
