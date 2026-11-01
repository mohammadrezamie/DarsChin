import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft, BookOpenCheck, CalendarDays, CheckCircle2, ClipboardList,
  GraduationCap, ShieldCheck, Sparkles,
} from 'lucide-react';

const features = [
  {
    icon: BookOpenCheck,
    label: 'دروس و شرایط',
    caption: 'هر درس را با وضعیت پیش‌نیاز و اطلاعات قابل‌بررسی مرور کن.',
    marker: '۰۱',
  },
  {
    icon: CalendarDays,
    label: 'برنامهٔ هفتگی',
    caption: 'ساعت کلاس‌ها، امتحان‌ها و تداخل‌ها را یک‌جا ببین.',
    marker: '۰۲',
  },
  {
    icon: ClipboardList,
    label: 'صف ثبت اولویت‌بندی‌شده',
    caption: 'کد گروه‌ها را مرتب کن و برای کپی سریع آماده نگه دار.',
    marker: '۰۳',
  },
  {
    icon: Sparkles,
    label: 'پیشنهادهای قابل‌توضیح',
    caption: 'گزینه‌های مناسب را بررسی کن؛ تصمیم نهایی با توست.',
    marker: '۰۴',
  },
] as const;

/**
 * Public marketing describes the STUDENT product only.
 * Internal admin capabilities live behind authenticated, permission-checked routes.
 */
export const DashboardShowcaseSection: React.FC = () => {
  const reduceMotion = useReducedMotion();
  return (
    <section id="workspaces" dir="rtl"
      className="scroll-mt-24 relative isolate overflow-hidden border-y border-slate-200 bg-slate-100/70 px-3 py-14 sm:px-6 sm:py-24 lg:px-8 dark:border-slate-800 dark:bg-slate-900/50">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-14 -z-10 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl text-right">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-extrabold text-blue-700 dark:border-blue-800 dark:bg-slate-950/80 dark:text-blue-300">
            <GraduationCap aria-hidden="true" className="h-4 w-4" /> فضای کار دانشجو
          </span>
          <h2 className="mt-5 text-[clamp(1.8rem,5vw,3rem)] font-black leading-[1.55] text-slate-950 dark:text-white">
            از اولین درس تا برنامهٔ آمادهٔ ثبت
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-8 text-slate-600 sm:text-base dark:text-slate-300">
            همهٔ ابزارهای لازم برای تصمیم‌گیری دربارهٔ انتخاب واحد، در یک میز کار منظم و قابل‌فهم.
            روی موبایل اقدامات روزمره سریع و در دسترس‌اند؛ روی دسکتاپ اطلاعات را با فضای بیشتر بررسی کن.
          </p>
        </div>
        <div className="mt-8 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, label, caption, marker }, index) => (
            <motion.article key={marker}
              initial={reduceMotion ? false : { opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: reduceMotion ? 0 : index * 0.06 }}
              className="min-w-0 rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-900/5 dark:border-slate-800 dark:bg-slate-950/80 dark:hover:border-blue-800">
              <div className="mb-5 flex items-center justify-between">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="text-sm font-extrabold tabular-nums text-slate-400 dark:text-slate-500">{marker}</span>
              </div>
              <h3 className="text-base font-black leading-7 text-slate-950 dark:text-white">{label}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{caption}</p>
            </motion.article>
          ))}
        </div>
        <div className="mt-7 flex min-w-0 flex-col gap-3 rounded-3xl border border-blue-200 bg-gradient-to-l from-white to-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-blue-900 dark:from-slate-950 dark:to-blue-950/35">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
              <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              اول امتحان کن، بعد تصمیم بگیر
            </p>
            <p className="mt-1 text-xs leading-7 text-slate-600 dark:text-slate-300">
              دمو بدون شماره و رمز باز می‌شود. داده‌ها ساختگی‌اند و هیچ واحدی خودکار در دانشگاه ثبت نمی‌شود.
            </p>
          </div>
          <Link to="/demo/student"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-blue-900/10 transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            شروع دموی رایگان <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-6 flex items-start gap-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          اطلاعات نمایش داده‌شده، جایگزین مقررات رسمی دانشگاه یا تأیید ثبت نهایی در سامانهٔ آموزشی نیست.
        </p>
      </div>
    </section>
  );
};
