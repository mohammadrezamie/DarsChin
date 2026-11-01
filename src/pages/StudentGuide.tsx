import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpenText, HelpCircle, Search, ShieldCheck } from 'lucide-react';
import { studentSectionHelp } from '../help/student-sections';

const questions = [
  { q: 'درس‌چین خودش برای من انتخاب واحد می‌کند؟', a: 'خیر. درس‌چین ابزار برنامه‌ریزی، تداخل‌سنجی و آماده‌سازی صف ثبت است؛ ثبت نهایی باید در سامانهٔ رسمی دانشگاه انجام شود.' },
  { q: 'می‌توانم بدون ساخت حساب قابلیت‌ها را امتحان کنم؟', a: 'بله. دمو دانشجو با داده‌های کاملاً نمونه و بدون شمارهٔ موبایل و رمز عبور قابل آزمایش است.' },
  { q: 'چرا یک درس را غیرمجاز یا مشروط می‌بینم؟', a: 'پیش‌نیاز، هم‌نیاز، واحدهای گذرانده، قوانین دوره و شرایط ارائه ممکن است اثر داشته باشند. اطلاعات پروفایل را بررسی کن و برای تصمیم قطعی به مقررات رسمی رجوع کن.' },
  { q: 'کد درس را کجا سریع کپی کنم؟', a: 'در میز کار دانشجو، قسمت «صف ثبت» را باز کن. اولویت‌ها را مرتب کن و در حالت فشرده کد گروه مناسب را کپی کن.' },
  { q: 'تداخل کلاس‌ها را چطور پیدا کنم؟', a: 'از «دروس ارائه‌شده» گزینه‌ها را به برنامه اضافه کن، سپس در «برنامه من» روزها و بازهٔ ساعت را مرور کن.' },
  { q: 'چرا نیازسنجی برایم نمایش داده نمی‌شود؟', a: 'فرم نیازسنجی زمانی فعال می‌شود که برای ورودی و محدودهٔ تحصیلی تو منتشر شده باشد. اعلام نیاز به معنی تضمین ارائهٔ درس نیست.' },
  { q: 'آیا داده‌های دمو واقعی هستند؟', a: 'خیر؛ اطلاعات دمو ساختگی‌اند و برای نمایش رفتار ابزار استفاده می‌شوند.' },
  { q: 'برای خطای برنامه یا اشکال ثبت چه کار کنم؟', a: 'در میز کار، بخش «پشتیبانی» را باز کن و با شرح مراحل مشکل، تیکت یا گزارش خطا ثبت کن. رمز یا دادهٔ محرمانه را ارسال نکن.' },
];

const categories = [
  ['offerings', 'بررسی درس‌ها'], ['schedule', 'برنامهٔ هفتگی'],
  ['registration', 'صف ثبت'], ['recommendations', 'پیشنهادها'],
  ['passed', 'درس‌های پاس‌شده'], ['demand', 'نیازسنجی'], ['support', 'پشتیبانی'],
] as const;

export const StudentGuide: React.FC = () => {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase('fa-IR');
  const filteredCategories = useMemo(() => categories.filter(([id, label]) => {
    const item = studentSectionHelp[id];
    return !normalized || (label + item.title + item.purpose + item.steps.join(' ')).toLocaleLowerCase('fa-IR').includes(normalized);
  }), [normalized]);
  const filteredQuestions = useMemo(() => questions.filter(item =>
    !normalized || (item.q + item.a).toLocaleLowerCase('fa-IR').includes(normalized)), [normalized]);

  return <div dir="rtl" className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <header className="border-b border-slate-200 bg-white/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
      <nav aria-label="ناوبری راهنمای دانشجو" className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-base font-black text-teal-800 dark:text-teal-300"><BookOpenText className="h-5 w-5" /> درس‌چین</Link>
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold sm:text-sm">
          <Link to="/demo/student" className="rounded-xl border border-teal-200 px-3 py-2 text-teal-800 dark:border-teal-900 dark:text-teal-300">دموی دانشجو</Link>
          <Link to="/dashboard" className="inline-flex min-h-11 items-center rounded-xl bg-teal-800 px-4 text-white">میز کار من <ArrowLeft className="mr-2 h-4 w-4" /></Link>
        </div>
      </nav>
    </header>
    <main id="help-main" className="mx-auto max-w-5xl space-y-10 px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <section className="rounded-3xl border border-teal-200 bg-gradient-to-bl from-teal-50 via-white to-emerald-50 p-5 sm:p-9 dark:border-teal-950 dark:from-slate-900 dark:via-slate-950 dark:to-emerald-950/30">
        <span className="text-xs font-black text-teal-800 dark:text-teal-300">راهنمای جامع دانشجو</span>
        <h1 className="mt-2 text-[clamp(1.7rem,5vw,2.7rem)] font-black leading-[1.65]">از اولین ورود تا آماده‌شدن برای انتخاب واحد</h1>
        <p className="mt-3 max-w-3xl text-sm leading-8 text-slate-600 dark:text-slate-300 sm:text-base">برای هر ابزار توضیح کوتاه و کاربردی، مراحل شروع و پاسخ سؤال‌های پرتکرار آماده کرده‌ایم. لازم نیست تمام بخش‌ها را یک‌جا یاد بگیری؛ از همان قسمت که لازم داری شروع کن.</p>
        <label htmlFor="darschin-guide-search" className="mt-6 block text-xs font-bold text-slate-600 dark:text-slate-300">جست‌وجو در راهنما و سؤال‌ها</label>
        <div className="relative mt-2">
          <Search aria-hidden="true" className="pointer-events-none absolute right-4 top-3.5 h-5 w-5 text-slate-400" />
          <input id="darschin-guide-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="مثلاً: تداخل، پیش‌نیاز، کد درس، نیازسنجی"
            className="min-h-12 w-full rounded-2xl border border-slate-300 bg-white py-3 pl-4 pr-12 text-base text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </div>
      </section>
      <section aria-labelledby="help-sections-title">
        <h2 id="help-sections-title" className="text-xl font-black sm:text-2xl">راهنمای هر بخش</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {filteredCategories.map(([id, label]) => {
            const item = studentSectionHelp[id];
            return <article key={id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <span className="text-xs font-black text-teal-800 dark:text-teal-300">{label}</span>
              <h3 className="mt-1 text-lg font-black">{item.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{item.purpose}</p>
              <details className="mt-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">چطور از این بخش استفاده کنم؟</summary>
                <ol className="space-y-2 pb-2 pt-2 text-sm leading-7 text-slate-700 dark:text-slate-200">
                  {item.steps.map(step => <li key={step}>• {step}</li>)}
                </ol>
              </details>
            </article>;
          })}
        </div>
      </section>
      <section aria-labelledby="help-faq-title">
        <h2 id="help-faq-title" className="flex items-center gap-2 text-xl font-black sm:text-2xl"><HelpCircle className="h-6 w-6 text-teal-700" /> سؤال‌های متداول</h2>
        <div className="mt-5 space-y-3">
          {filteredQuestions.map(({q,a})=><details key={q} className="group rounded-2xl border border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-2 text-sm font-bold leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 sm:text-base">
              {q} <span aria-hidden="true" className="text-xl text-teal-800 group-open:rotate-45 dark:text-teal-300">+</span>
            </summary>
            <p className="border-t border-slate-100 py-3 text-sm leading-8 text-slate-600 dark:border-slate-800 dark:text-slate-300">{a}</p>
          </details>)}
        </div>
      </section>
      {filteredCategories.length === 0 && filteredQuestions.length === 0 && <p role="status" className="rounded-xl border border-slate-300 p-6 text-sm">برای این عبارت راهنمایی پیدا نشد. واژهٔ کوتاه‌تری را امتحان کن.</p>}
      <p className="flex items-start gap-2 text-xs leading-7 text-slate-500 dark:text-slate-400"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> توضیحات راهنما آموزشی‌اند؛ ثبت و مجازبودن قطعی واحدها به مقررات و سامانهٔ رسمی دانشگاه وابسته است.</p>
    </main>
  </div>;
};
