import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Sparkles, ArrowUp, ArrowDown, Ban, Info } from 'lucide-react';

export const RecommendationSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"]
  });

  const card1Y = useTransform(scrollYProgress, [0.2, 0.5], [100, 0]);
  const card2Y = useTransform(scrollYProgress, [0.3, 0.6], [100, 0]);
  const card3Y = useTransform(scrollYProgress, [0.4, 0.7], [100, 0]);

  return (
    <section id="recommendations" ref={containerRef} className="scroll-mt-24 overflow-hidden bg-gradient-to-b from-teal-50/75 to-slate-50 px-4 py-16 dark:from-teal-950/15 dark:to-slate-950/25 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col-reverse items-stretch gap-9 lg:flex-row lg:items-center lg:gap-16">
        <div className="min-w-0 w-full flex-1 space-y-4 sm:space-y-6">
          <motion.div style={reduceMotion ? undefined : { y: card1Y }} className="relative min-w-0 overflow-hidden rounded-[1.5rem] border border-emerald-200 bg-white/95 p-4 shadow-[0_20px_45px_-27px_rgba(5,150,105,0.2)] dark:border-emerald-900/50 dark:bg-slate-900 sm:p-6">
            <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
            <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-lg font-bold leading-7 [overflow-wrap:anywhere] sm:text-xl text-slate-900 dark:text-white">طراحی الگوریتم</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">۳ واحد · اولویت فرضی در یک چارت نمونه</p>
              </div>
              <div className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-bold sm:text-sm">
                <ArrowUp className="w-4 h-4" /> اولویت بالا
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              در این مثال، جلو افتادن این درس می‌تواند مسیر درس‌های وابسته را ساده‌تر کند؛ اولویت نهایی به چارت دانشجو وابسته است.
            </p>
          </motion.div>

          <motion.div style={reduceMotion ? undefined : { y: card2Y }} className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-lg font-bold leading-7 [overflow-wrap:anywhere] sm:text-xl text-slate-900 dark:text-white">تاریخ اسلام</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">۲ واحد · درس عمومی نمونه</p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-full text-xs font-bold sm:text-sm">
                <ArrowDown className="w-4 h-4" /> اولویت متوسط
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              در این مثال می‌توان این درس را بعد از درس‌های وابسته بررسی کرد؛ هیچ رتبه‌بندی عمومی برای همهٔ دانشجویان وجود ندارد.
            </p>
          </motion.div>

          <motion.div style={reduceMotion ? undefined : { y: card3Y }} className="min-w-0 rounded-[1.5rem] border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/75 sm:p-6">
            <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-lg font-bold leading-7 [overflow-wrap:anywhere] sm:text-xl text-slate-900 dark:text-white line-through decoration-red-500">مبانی شبکه‌های کامپیوتری</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">۳ واحد · سناریوی فرضی</p>
              </div>
              <div className="flex items-center gap-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-xs font-bold sm:text-sm">
                <Ban className="w-4 h-4" /> مسدود
              </div>
            </div>
            <p className="text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
              در این مثال، شرط آموزشی لازم هنوز احراز نشده و درس برای بررسی بیشتر مشخص می‌شود.
            </p>
          </motion.div>
        </div>

        <div className="min-w-0 w-full flex-1 space-y-5 text-right lg:space-y-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1.5 text-xs font-extrabold text-teal-800 dark:border-teal-400/20 dark:bg-slate-900/70 dark:text-teal-300"><Sparkles className="h-4 w-4" /> کمک برای اولویت‌بندی آگاهانه</span>
          <h2 className="max-w-xl break-words text-[clamp(1.8rem,5vw,3rem)] font-black leading-[1.35] tracking-tight text-slate-950 dark:text-white">
            فقط انتخاب نکن؛ <span className="block bg-gradient-to-l from-teal-700 to-emerald-600 bg-clip-text text-transparent dark:from-teal-300 dark:to-emerald-300">بهتر مقایسه کن.</span>
          </h2>
          <p className="text-base leading-8 text-slate-600 dark:text-slate-400 sm:text-xl">
            درس‌چین می‌تواند اولویت‌های پیشنهادی را با دلایل قابل‌فهم کنار درس‌ها نشان دهد. این کارت‌ها مثال هستند؛ پیشنهاد معتبر به چارت، دروس گذرانده‌شده و دادهٔ به‌روز همان نیمسال نیاز دارد.
          </p>
        </div>
      </div>
    </section>
  );
};
