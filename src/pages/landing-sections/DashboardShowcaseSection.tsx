import React from 'react';
import { motion } from 'motion/react';
import { Activity, BookOpen, CalendarDays, CheckCircle2, Database, FileSpreadsheet, GraduationCap, Layers3, ListChecks, MessageSquare, ShieldCheck, SlidersHorizontal, Sparkles, Users, Workflow } from 'lucide-react';

type Feature = { icon: React.ComponentType<{ className?: string }>; title: string; description: string };

const studentFeatures: Feature[] = [
  { icon: ListChecks, title: 'بررسی دروس ارائه‌شده', description: 'دیدن وضعیت درس‌ها و دلایل قابل اخذ یا مسدود بودن آن‌ها.' },
  { icon: Sparkles, title: 'پیشنهاد و اولویت‌بندی', description: 'مرتب‌سازی گزینه‌ها برای تصمیم‌گیری آگاهانه‌تر.' },
  { icon: CalendarDays, title: 'برنامه‌ریز هفتگی', description: 'چیدن ارائه‌های انتخابی و بررسی تداخل زمانی.' },
  { icon: BookOpen, title: 'کارنامه دروس', description: 'مدیریت سوابق درسی و درس‌های پاس‌شده.' },
];

const adminFeatures: Feature[] = [
  { icon: FileSpreadsheet, title: 'چارت‌های مصوب', description: 'مدیریت ساختار چارت و ارتباط درس‌ها با برنامه تحصیلی.' },
  { icon: Workflow, title: 'قوانین آموزشی', description: 'تعریف و مدیریت روابط پیش‌نیازی و هم‌نیازی.' },
  { icon: Layers3, title: 'ارائه‌های ترمی', description: 'مدیریت اطلاعات ارائه‌ها و داده‌های واردشده.' },
  { icon: Users, title: 'کاربران و دسترسی‌ها', description: 'مدیریت حساب‌ها و سطح دسترسی‌های سامانه.' },
];

const FeatureList: React.FC<{ items: Feature[]; variant: 'student' | 'admin' }> = ({ items, variant }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    {items.map(({ icon: Icon, title, description }, index) => (
      <motion.div key={title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06 }}
        className="group rounded-2xl border border-slate-200/80 bg-white/80 p-4 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-blue-500/50">
        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${variant === 'student' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'}`}><Icon className="h-5 w-5" /></div>
        <h3 className="mb-1 text-sm font-extrabold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-xs leading-6 text-slate-600 dark:text-slate-400">{description}</p>
      </motion.div>
    ))}
  </div>
);

export const DashboardShowcaseSection: React.FC = () => {
  return (
    <section id="workspaces" dir="rtl" className="scroll-mt-24 relative overflow-hidden bg-slate-100/80 px-4 py-24 dark:bg-slate-900/50 sm:px-6 sm:py-32 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-16 h-72 w-72 rounded-full bg-violet-400/10 blur-3xl" />
      <div className="relative z-10 mx-auto mb-14 max-w-3xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300"><Activity className="h-3.5 w-3.5" /> فضای کار یکپارچه</span>
        <h2 className="mb-5 text-3xl font-black text-slate-900 dark:text-white sm:text-4xl md:text-5xl">ابزارهای لازم، در جای درست</h2>
        <p className="text-base leading-8 text-slate-600 dark:text-slate-400 sm:text-lg">مسیر دانشجو و ابزارهای مدیریت آموزشی از هم تفکیک شده‌اند؛ هر نقش فقط باید به امکانات متناسب با دسترسی خودش برسد.</p>
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
        <motion.article initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
            <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"><GraduationCap className="h-6 w-6" /></div><div><h3 className="text-lg font-black text-slate-900 dark:text-white">میز کار دانشجو</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">تمرکز روی برنامه و مسیر تحصیلی</p></div></div>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">فضای دانشجو</span>
          </div>
          <FeatureList items={studentFeatures} variant="student" />
          <div className="mt-5 flex items-start gap-2 rounded-2xl bg-blue-50/80 p-3.5 text-xs leading-6 text-blue-900 dark:bg-blue-500/10 dark:text-blue-100"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />وضعیت نهایی هر درس باید بر اساس اطلاعات واقعی پروفایل و موتور بررسی شرایط مشخص شود.</div>
        </motion.article>

        <motion.article initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
          className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/10 dark:border-slate-700 sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-3 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300"><ShieldCheck className="h-6 w-6" /></div><div><h3 className="text-lg font-black">پنل مدیریت آموزشی</h3><p className="mt-1 text-xs text-slate-400">ساختار، داده و دسترسی‌ها</p></div></div>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-slate-300">فضای مدیریتی</span>
          </div>
          <FeatureList items={adminFeatures} variant="admin" />
          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-3.5 text-xs leading-6 text-slate-300"><SlidersHorizontal className="mt-1 h-4 w-4 shrink-0 text-violet-300" />تنظیمات و تغییرات حساس باید در سمت سرور مجوزسنجی شوند و سابقه قابل پیگیری داشته باشند.</div>
        </motion.article>
      </div>
      <div className="mx-auto mt-6 flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> داده و تنظیمات</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> دسترسی نقش‌محور</span><span className="inline-flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> پشتیبانی سامانه</span></div>
    </section>
  );
};


