import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import { publicDemoEnabled } from '../../config/demo-availability';
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
    <section id="hero" dir="rtl" className="dc-hero scroll-mt-24 relative isolate overflow-hidden px-4 pb-9 pt-24 sm:px-6 sm:pb-16 sm:pt-28 lg:px-8">
      <div className="mx-auto grid min-w-0 max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10">
        <div className="relative z-10 min-w-0 text-right">
          <motion.div initial={heroAnimation(12)} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/75 px-4 py-2 text-sm font-bold text-blue-800 shadow-sm backdrop-blur dark:border-blue-400/20 dark:bg-slate-900/70 dark:text-blue-300">
            <Sparkles className="h-4 w-4" /> از چارت تحصیلی تا برنامهٔ هفتگی
          </motion.div>

          <motion.h1 initial={heroAnimation(18)} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.06 }}
            className="mb-5 max-w-2xl text-[clamp(1.9rem,5vw,3.25rem)] font-black leading-[1.45] tracking-tight text-slate-950 dark:text-white">
            قبل از انتخاب واحد،
            <span className="mt-1 block dc-brand-text ">مسیر ترمت را روشن کن</span>
          </motion.h1>

          <motion.p initial={heroAnimation(14)} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }}
            className="mb-8 max-w-xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
            چارت متناسب با رشته و ورودی‌ات را ببین، وضعیت و پیش‌نیاز درس‌ها را بفهم، تقاضای ترم را ثبت کن و گزینه‌های برنامه‌ات را از نظر تداخل مقایسه کن.
          </motion.p>

          <motion.div initial={heroAnimation(12)} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.18 }} className="mb-4 flex flex-col gap-2.5 min-[380px]:flex-row min-[380px]:flex-wrap">
            <Link to={publicDemoEnabled ? '/demo/student' : '/register'} className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl dc-primary-action bg-[#2455A6] px-4 py-3 text-center text-sm font-extrabold text-white shadow-[0_18px_35px_-18px_rgba(37,99,235,0.6)] transition hover:-translate-y-0.5 hover:bg-[#1E4080] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/30 sm:flex-none sm:px-6 sm:text-base">
              {publicDemoEnabled ? 'دیدن نمونهٔ پنل دانشجو' : 'شروع استفاده از درس‌چین'} <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/register" className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl dc-secondary-action border border-slate-200 bg-white/80 px-4 py-3 text-center text-sm font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/20 sm:flex-none sm:px-6 sm:text-base dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-blue-600">
              ساخت حساب دانشجو
            </Link>
          </motion.div>
          <div className="mb-7 text-sm font-bold text-blue-700 dark:text-blue-300">
            <a href="#manager-workspace" className="underline-offset-4 hover:underline">ویژهٔ مدیران گروه و مدیران آموزشی ←</a>
          </div>

          <p className="mb-7 flex flex-wrap items-center gap-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
            دمو با داده‌های آزمایشی است · درس‌چین جایگزین درگاه رسمی دانشگاه نیست؛ ثبت نهایی در همان درگاه انجام می‌شود.
          </p>
          <div aria-label="مزیت‌های اصلی" className="grid max-w-xl grid-cols-3 gap-2 sm:gap-3">
            {[
              { icon: ShieldCheck, title: 'چارت ورودی تو', description: 'درس‌های متناسب با رشته و ورودی' },
              { icon: CalendarDays, title: 'وضعیت هر درس', description: 'پیش‌نیازها و شرایط قابل فهم' },
              { icon: LayoutGrid, title: 'برنامه بدون تداخل', description: 'مقایسهٔ زمان‌ها و روزهای حضور' },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex min-w-0 flex-col items-center gap-2 rounded-2xl dc-hero-feature border border-slate-200/70 bg-white/65 p-2.5 text-center shadow-sm backdrop-blur-sm sm:p-3 dark:border-slate-800 dark:bg-slate-900/55">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800 dark:bg-blue-600/10 dark:text-blue-300"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0"><span className="block break-words text-[11px] font-extrabold leading-5 text-slate-900 sm:text-sm dark:text-white">{title}</span><span className="mt-1 hidden text-xs leading-5 text-slate-500 sm:block dark:text-slate-400">{description}</span></span>
              </div>
            ))}
          </div>
        </div>

        <motion.div initial={demoAnimation} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.12, ease: 'easeOut' }} className="relative mx-auto w-full min-w-0 max-w-2xl">
          <div aria-hidden="true" className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-transparent" />
          <div className="overflow-hidden rounded-[1.75rem] dc-hero-preview border border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 px-3 py-4 dark:border-slate-800 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl dc-brand-mark text-white shadow-lg shadow-blue-700/15"><GraduationCap className="h-5 w-5" /></div>
                <div><div className="font-black text-slate-900 dark:text-white">میز برنامه‌ریزی</div><div className="text-xs text-slate-500 dark:text-slate-400">پیش‌نمایش تعاملی محصول</div></div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><WandSparkles className="h-3.5 w-3.5 shrink-0" /> دادهٔ آزمایشی</span>
            </div>

            <div className="grid min-w-0 gap-5 p-3 sm:p-6">
              <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-3">
                <div className="min-w-0 rounded-2xl bg-slate-50 p-2.5 sm:p-3 dark:bg-slate-800/70"><div className="mb-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><BookOpen className="h-3.5 w-3.5 shrink-0" /> درس انتخابی</div><div className="text-xl font-black tabular-nums text-slate-900 dark:text-white sm:text-2xl">{persianNumber(selectedOfferings.length)}</div></div>
                <div className="min-w-0 rounded-2xl bg-blue-50/80 p-2.5 sm:p-3 dark:bg-blue-600/10"><div className="mb-2 flex items-center gap-1.5 text-xs text-blue-800 dark:text-blue-300"><GraduationCap className="h-3.5 w-3.5 shrink-0" /> مجموع واحد</div><div className="text-xl font-black tabular-nums text-blue-900 dark:text-blue-200 sm:text-2xl">{persianNumber(selectedUnits)}</div></div>
                <div className="min-w-0 rounded-2xl bg-emerald-50/80 p-2.5 sm:p-3 dark:bg-emerald-500/10"><div className="mb-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"><Check className="h-3.5 w-3.5 shrink-0" /> وضعیت</div><div className="text-[11px] font-black leading-5 text-emerald-800 dark:text-emerald-200 sm:text-sm">قابل بررسی</div></div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-black text-slate-900 dark:text-white">گزینه‌های نمونه</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">برای دیدن تغییر برنامه، درس‌ها را انتخاب یا حذف کن.</p></div><span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">ترم نمونه</span></div>
                <div className="space-y-2.5">
                  {demoOfferings.map((offering) => {
                    const selected = selectedIds.includes(offering.id);
                    return <button key={offering.id} type="button" aria-pressed={selected} onClick={() => toggleOffering(offering.id)}
                      className={`flex w-full min-w-0 items-center gap-2 rounded-2xl border p-3 text-right sm:gap-3 transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/20 sm:p-4 ${selected ? 'border-blue-300 bg-blue-50/70 dark:border-blue-600/50 dark:bg-blue-600/10' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'}`}>
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-[#2455A6] text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{selected ? <Check className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}</span>
                      <span className="min-w-0 flex-1"><span className="block break-words text-sm font-extrabold leading-6 text-slate-900 [overflow-wrap:anywhere] dark:text-white">{offering.name}</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{offering.code} · {persianNumber(offering.units)} واحد</span></span>
                      <span className="hidden shrink-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400 sm:inline-flex"><Clock3 className="h-3.5 w-3.5 shrink-0" />{offering.day}</span>
                      <span className={`shrink-0 rounded-xl px-3 py-2 text-xs font-extrabold ${selected ? 'bg-[#2455A6] text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{selected ? 'انتخاب شد' : 'افزودن'}</span>
                    </button>;
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white"><CalendarDays className="h-4 w-4 text-blue-700 dark:text-blue-400" /> برنامه انتخابی نمونه</div><span className="text-xs text-slate-500 dark:text-slate-400">{persianNumber(selectedOfferings.length)} درس</span></div>
                {selectedOfferings.length > 0 ? <div className="grid gap-2 sm:grid-cols-2">{selectedOfferings.map((offering) => <div key={offering.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"><span className="min-w-0"><span className="block break-words text-sm font-bold leading-6 text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{offering.name}</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{offering.day} · {offering.time}</span></span><span className="shrink-0 text-xs font-extrabold text-blue-800 dark:text-blue-300">{persianNumber(offering.units)} واحد</span></div>)}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">هنوز درسی انتخاب نکرده‌ای؛ یک گزینه را اضافه کن تا این بخش به‌روزرسانی شود.</div>}
              </div>
              <p className="text-right text-xs leading-6 text-slate-500 dark:text-slate-400">این پیش‌نمایش فقط برای نمایش رابط کاربری است؛ هیچ اطلاعاتی از حساب واقعی یا درگاه دانشگاه دریافت نمی‌کند.</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
