import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, BookCheck, CalendarDays, ClipboardList, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';

const steps = [
  {
    icon: BookCheck,
    title: 'درس‌هایی که می‌توانی بررسی کنی',
    description: 'دروس ارائه‌شده را ببین و شرایط هر درس را با سوابق و چارت ورودی‌ات تطبیق بده.',
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  },
  {
    icon: CalendarDays,
    title: 'هفته‌ای که واقعاً می‌خواهی',
    description: 'گروه‌ها را کنار هم بچین؛ تداخل کلاس و ساعت‌های آزاد را بدون جدول شلوغ ببین.',
    color: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
  },
  {
    icon: ClipboardList,
    title: 'صف ثبت، آمادهٔ روز انتخاب واحد',
    description: 'اولویت‌هایت را مشخص کن و کدهای دقیق را با کمترین رفت‌وبرگشت آماده نگه دار.',
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
] as const;

export const DashboardShowcaseSection: React.FC = () => {
  const reduceMotion = useReducedMotion();
  return (
    <section id="workspaces" dir="rtl" className="scroll-mt-24 relative overflow-hidden bg-slate-100/80 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 dark:bg-slate-900/50">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-slate-950/70 dark:text-blue-300">
            <GraduationCap aria-hidden="true" className="h-4 w-4" /> همه‌چیز برای خودت، یک‌جا
          </span>
          <h2 className="mt-4 text-[clamp(1.7rem,5vw,2.8rem)] font-black leading-[1.5] text-slate-950 dark:text-white">
            از انتخاب درس تا آماده‌باش، مسیرت روشنه
          </h2>
          <p className="mt-3 text-sm leading-8 text-slate-600 sm:text-base dark:text-slate-300">
            به‌جای جابه‌جایی بین جدول‌ها و یادداشت‌های پراکنده، روی کارهایی تمرکز کن که روز انتخاب واحد واقعاً لازم داری.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
          {steps.map(({ icon: Icon, title, description, color }, index) => (
            <motion.article key={title}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: reduceMotion ? 0 : index * 0.05 }}
              className="min-w-0 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-6">
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>
                <Icon aria-hidden="true" className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-base font-extrabold leading-7 text-slate-950 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{description}</p>
            </motion.article>
          ))}
        </div>
        <div className="mt-7 flex flex-col items-start justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50/90 p-4 sm:flex-row sm:items-center sm:p-5 dark:border-blue-900 dark:bg-blue-950/30">
          <div className="flex min-w-0 items-start gap-3">
            <ShieldCheck aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" />
            <div>
              <p className="font-bold text-slate-950 dark:text-white">اول امتحان کن، بعد تصمیم بگیر</p>
              <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">دمو بدون حساب و با داده‌های ساختگی کار می‌کند؛ هیچ ثبت خودکاری در سامانهٔ دانشگاه انجام نمی‌شود.</p>
            </div>
          </div>
          <Link to="/demo/student" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-extrabold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Sparkles aria-hidden="true" className="h-4 w-4" /> تجربهٔ رایگان <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
};
