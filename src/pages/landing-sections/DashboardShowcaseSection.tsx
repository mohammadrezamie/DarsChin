import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, GraduationCap, ListChecks, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';

const features: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: ListChecks, title: 'دروس و شرایط اخذ', description: 'وضعیت درس‌ها و علت محدودیت‌های ثبت را یک‌جا ببین.' },
  { icon: Sparkles, title: 'اولویت‌های شخصی', description: 'درس‌ها و گروه‌ها را طبق برنامهٔ خودت مرتب کن.' },
  { icon: CalendarDays, title: 'تقویم بدون تداخل', description: 'ساعت کلاس و امتحان را در یک نگاه بررسی کن.' },
  { icon: BookOpen, title: 'پروندهٔ تحصیلی', description: 'سوابق گذرانده و مسیر باقی‌مانده را دنبال کن.' },
];

export const DashboardShowcaseSection: React.FC = () => {
  const reducedMotion = useReducedMotion();
  return (
    <section id="workspaces" dir="rtl" aria-labelledby="student-tools-title"
      className="scroll-mt-24 overflow-hidden bg-slate-100/80 px-4 py-16 dark:bg-slate-900/50 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-9 max-w-3xl">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-900 dark:bg-slate-950/80 dark:text-blue-300">
            <GraduationCap className="h-4 w-4" aria-hidden="true" /> ابزارهای دانشجو
          </span>
          <h2 id="student-tools-title" className="text-[clamp(1.75rem,5vw,2.8rem)] font-black leading-[1.6] text-slate-950 dark:text-white">
            هر کاری برای برنامه‌ریزی ترم لازم داری، همین‌جاست
          </h2>
          <p className="mt-3 text-sm leading-8 text-slate-600 sm:text-base dark:text-slate-300">
            درس‌چین مسیر انتخاب واحد را ساده‌تر می‌کند؛ بدون اینکه مجبور باشی بین جدول‌های طولانی و کدهای پراکنده سردرگم شوی.
          </p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {features.map(({ icon: Icon, title, description }, index) => (
            <motion.article key={title}
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: reducedMotion ? 0 : index * 0.05 }}
              className="min-w-0 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/5 dark:border-slate-800 dark:bg-slate-950/80">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-base font-extrabold text-slate-950 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{description}</p>
            </motion.article>
          ))}
        </div>
        <div className="mt-7 flex flex-col items-start justify-between gap-5 rounded-3xl border border-blue-200 bg-gradient-to-l from-blue-50 to-white p-5 sm:flex-row sm:items-center sm:p-7 dark:border-blue-900 dark:from-blue-950/30 dark:to-slate-950">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-extrabold text-blue-800 dark:text-blue-200">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> از دمو شروع کن
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              بدون ثبت‌نام و شمارهٔ تماس، در محیط آزمایشی خودت برنامه بچین. داده‌ها نمونه‌اند و ثبت نهایی در سامانهٔ رسمی انجام می‌شود.
            </p>
          </div>
          <Link to="/demo/student" className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-extrabold text-white shadow-sm hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-auto">
            ورود به دموی دانشجو <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-5 flex items-start gap-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          نتیجهٔ نهایی هر درس به اطلاعات واقعی و مقررات رسمی دانشگاه وابسته است.
        </p>
      </div>
    </section>
  );
};
