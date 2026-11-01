import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, Check, Clock3, GraduationCap, LayoutGrid, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';

type DemoOffering = { id: string; name: string; code: string; units: number; day: string; time: string };

const demoOfferings: DemoOffering[] = [
  { id: 'math-2', name: 'ریاضی عمومی ۲', code: 'نمونه درس ۰۱', units: 3, day: 'شنبه', time: '۰۸:۰۰ تا ۱۰:۰۰' },
  { id: 'logic', name: 'مدارهای منطقی', code: 'نمونه درس ۰۲', units: 3, day: 'یکشنبه', time: '۱۰:۰۰ تا ۱۲:۰۰' },
  { id: 'physics', name: 'فیزیک ۲', code: 'نمونه درس ۰۳', units: 3, day: 'سه‌شنبه', time: '۱۳:۰۰ تا ۱۵:۰۰' },
];

const persianNumber = (value: number) => new Intl.NumberFormat('fa-IR').format(value);

export const HeroSection: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const heroAnimation = (y: number) => prefersReducedMotion ? false : { opacity: 0, y };
  const demoAnimation = prefersReducedMotion ? false : { opacity: 0, y: 24, scale: 0.985 };
  const [selectedIds, setSelectedIds] = useState<string[]>(['math-2', 'logic']);
  const selectedOfferings = useMemo(() => demoOfferings.filter((offering) => selectedIds.includes(offering.id)), [selectedIds]);
  const selectedUnits = selectedOfferings.reduce((total, offering) => total + offering.units, 0);
  const toggleOffering = (id: string) => setSelectedIds((current) =>
    current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
  );

  return (
    <section id="hero" dir="rtl" className="dc-hero scroll-mt-24 relative isolate overflow-hidden px-4 pb-12 pt-24 sm:px-6 sm:pb-24 sm:pt-36 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-28 top-12 h-80 w-80 rounded-full bg-teal-400/15 blur-3xl sm:h-[30rem] sm:w-[30rem]" />
        <div className="absolute -left-24 top-40 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-950" />
      </div>

      <div className="mx-auto grid min-w-0 max-w-7xl items-center gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
        <div className="relative z-10 text-right">
          <motion.div initial={heroAnimation(12)} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200/80 bg-white/75 px-4 py-2 text-sm font-bold text-teal-800 shadow-sm backdrop-blur dark:border-teal-400/20 dark:bg-slate-900/70 dark:text-teal-300">
            <Sparkles className="h-4 w-4" /> برنامه‌ریزی تحصیلی، با دید روشن‌تر
          </motion.div>

          <motion.h1 initial={heroAnimation(18)} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.06 }}
            className="mb-5 max-w-2xl text-[clamp(1.9rem,7.5vw,3.65rem)] font-black leading-[1.45] tracking-tight text-slate-950 dark:text-white">
            انتخاب واحد را
            <span className="mt-1 block dc-brand-text bg-gradient-to-l from-teal-700 via-emerald-700 to-amber-700 bg-clip-text text-transparent dark:from-teal-400 dark:via-emerald-400 dark:to-amber-400">با آگاهی برنامه‌ریزی کن</span>
          </motion.h1>

          <motion.p initial={heroAnimation(14)} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}
            className="mb-8 max-w-xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
            درس‌چین به تو کمک می‌کند وضعیت درس‌ها، اولویت‌ها و برنامه هفتگی‌ات را یک‌جا ببینی؛ تصمیم‌ها روشن‌تر می‌شوند و بررسی تداخل‌ها ساده‌تر.
          </motion.p>

          <motion.div initial={heroAnimation(12)} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.18 }} className="mb-4 flex flex-col gap-2.5 min-[380px]:flex-row min-[380px]:flex-wrap">
            <Link to="/demo/student" className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl dc-primary-action bg-gradient-to-l from-teal-700 to-emerald-700 px-4 py-3 text-center text-sm font-extrabold text-white shadow-[0_18px_35px_-18px_rgba(37,99,235,0.6)] transition hover:-translate-y-0.5 hover:from-teal-800 hover:to-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/30 sm:flex-none sm:px-6 sm:text-base">
              تست رایگان پنل دانشجو <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/register" className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl dc-secondary-action border border-slate-200 bg-white/80 px-4 py-3 text-center text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/20 sm:flex-none sm:px-6 sm:text-base dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-teal-600">
              ساخت حساب کاربری
            </Link>
          </motion.div>

          <p className="mb-7 flex flex-wrap items-center gap-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            دمو بدون شماره و رمز · داده‌ها نمونه‌اند · هیچ ثبت خودکاری در آموزشیار انجام نمی‌شود
          </p>
          <div aria-label="مزیت‌های اصلی" className="grid max-w-xl grid-cols-3 gap-2 sm:gap-3">
            {[
              { icon: ShieldCheck, title: 'بررسی شرایط', description: 'دلایل قابل فهم برای وضعیت درس‌ها' },
              { icon: CalendarDays, title: 'برنامه هفتگی', description: 'نمایش انتخاب‌ها در کنار هم' },
              { icon: LayoutGrid, title: 'اولویت‌بندی', description: 'مدیریت ساده‌تر گزینه‌ها' },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex min-w-0 flex-col items-center gap-2 rounded-2xl dc-hero-feature border border-slate-200/70 bg-white/65 p-2.5 text-center shadow-sm backdrop-blur-sm sm:flex-row sm:items-start sm:gap-3 sm:p-3 sm:text-right dark:border-slate-800 dark:bg-slate-900/55">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 dark:bg-teal-600/10 dark:text-teal-300"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0"><span className="block break-words text-[11px] font-extrabold leading-5 text-slate-900 sm:text-sm dark:text-white">{title}</span><span className="mt-1 hidden text-xs leading-5 text-slate-500 sm:block dark:text-slate-400">{description}</span></span>
              </div>
            ))}
          </div>
        </div>

        <motion.div initial={demoAnimation} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.12, ease: 'easeOut' }} className="relative mx-auto w-full min-w-0 max-w-2xl">
          <div aria-hidden="true" className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-teal-600/20 via-emerald-600/10 to-amber-600/20 blur-2xl" />
          <div className="overflow-hidden rounded-[1.75rem] dc-hero-preview border border-slate-200/80 bg-white/90 shadow-[0_28px_90px_-32px_rgba(30,64,175,0.38)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/90">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 px-3 py-4 dark:border-slate-800 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl dc-brand-mark text-white shadow-lg shadow-teal-700/20"><GraduationCap className="h-5 w-5" /></div>
                <div><div className="font-black text-slate-900 dark:text-white">میز برنامه‌ریزی</div><div className="text-xs text-slate-500 dark:text-slate-400">پیش‌نمایش تعاملی محصول</div></div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300"><WandSparkles className="h-3.5 w-3.5" /> داده نمونه</span>
            </div>

            <div className="grid min-w-0 gap-5 p-3 sm:p-6">
              <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-3">
                <div className="min-w-0 rounded-2xl bg-slate-50 p-2.5 sm:p-3 dark:bg-slate-800/70"><div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><BookOpen className="h-3.5 w-3.5" /> درس انتخابی</div><div className="text-xl font-black tabular-nums text-slate-900 dark:text-white sm:text-2xl">{persianNumber(selectedOfferings.length)}</div></div>
                <div className="min-w-0 rounded-2xl bg-teal-50/80 p-2.5 sm:p-3 dark:bg-teal-600/10"><div className="mb-2 flex items-center gap-1.5 text-xs text-teal-800 dark:text-teal-300"><GraduationCap className="h-3.5 w-3.5" /> مجموع واحد</div><div className="text-xl font-black tabular-nums text-teal-900 dark:text-teal-200 sm:text-2xl">{persianNumber(selectedUnits)}</div></div>
                <div className="min-w-0 rounded-2xl bg-emerald-50/80 p-2.5 sm:p-3 dark:bg-emerald-500/10"><div className="mb-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"><Check className="h-3.5 w-3.5" /> وضعیت</div><div className="text-[11px] font-black leading-5 text-emerald-800 dark:text-emerald-200 sm:text-sm">قابل بررسی</div></div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-black text-slate-900 dark:text-white">گزینه‌های نمونه</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">برای دیدن تغییر برنامه، درس‌ها را انتخاب یا حذف کن.</p></div><span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">ترم نمونه</span></div>
                <div className="space-y-2.5">
                  {demoOfferings.map((offering) => {
                    const selected = selectedIds.includes(offering.id);
                    return <button key={offering.id} type="button" aria-pressed={selected} onClick={() => toggleOffering(offering.id)}
                      className={`flex w-full min-w-0 items-center gap-2 rounded-2xl border p-3 text-right sm:gap-3 transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/20 sm:p-4 ${selected ? 'border-teal-300 bg-teal-50/70 dark:border-teal-600/50 dark:bg-teal-600/10' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'}`}>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{selected ? <Check className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}</span>
                      <span className="min-w-0 flex-1"><span className="block break-words text-sm font-extrabold leading-6 text-slate-900 [overflow-wrap:anywhere] dark:text-white">{offering.name}</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{offering.code} · {persianNumber(offering.units)} واحد</span></span>
                      <span className="hidden shrink-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400 sm:inline-flex"><Clock3 className="h-3.5 w-3.5" />{offering.day}</span>
                      <span className={`shrink-0 rounded-xl px-3 py-2 text-xs font-extrabold ${selected ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{selected ? 'انتخاب شد' : 'افزودن'}</span>
                    </button>;
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white"><CalendarDays className="h-4 w-4 text-teal-700 dark:text-teal-400" /> برنامه انتخابی نمونه</div><span className="text-xs text-slate-500 dark:text-slate-400">{persianNumber(selectedOfferings.length)} درس</span></div>
                {selectedOfferings.length > 0 ? <div className="grid gap-2 sm:grid-cols-2">{selectedOfferings.map((offering) => <div key={offering.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"><span className="min-w-0"><span className="block break-words text-sm font-bold leading-6 text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{offering.name}</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{offering.day} · {offering.time}</span></span><span className="shrink-0 text-xs font-extrabold text-teal-800 dark:text-teal-300">{persianNumber(offering.units)} واحد</span></div>)}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">هنوز درسی انتخاب نکرده‌ای؛ یک گزینه را اضافه کن تا این بخش به‌روزرسانی شود.</div>}
              </div>
              <p className="text-right text-xs leading-6 text-slate-500 dark:text-slate-400">این پیش‌نمایش صرفاً برای نمایش تعاملات رابط کاربری است؛ اطلاعات آن از حساب یا سامانه آموزشیار دریافت نمی‌شود.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
