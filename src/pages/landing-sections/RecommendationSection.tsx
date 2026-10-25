import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Sparkles, ArrowUp, ArrowDown, Ban, Info } from 'lucide-react';

export const RecommendationSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"]
  });

  const card1Y = useTransform(scrollYProgress, [0.2, 0.5], [100, 0]);
  const card2Y = useTransform(scrollYProgress, [0.3, 0.6], [100, 0]);
  const card3Y = useTransform(scrollYProgress, [0.4, 0.7], [100, 0]);

  return (
    <section id="recommendations" ref={containerRef} className="scroll-mt-24 overflow-hidden bg-blue-50/50 px-3 py-16 dark:bg-slate-900/30 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col items-stretch gap-9 md:flex-row md:items-center md:gap-16">
        <div className="min-w-0 w-full flex-1 space-y-4 sm:space-y-6">
          <motion.div style={{ y: card1Y }} className="bg-white dark:bg-slate-900 min-w-0 rounded-2xl p-4 sm:p-6 border border-emerald-200 dark:border-emerald-900/50 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
            <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-lg font-bold leading-7 [overflow-wrap:anywhere] sm:text-xl text-slate-900 dark:text-white">طراحی الگوریتم</h3>
                <p className="text-sm text-slate-500">۳ واحد • پیش‌نیاز حیاتی</p>
              </div>
              <div className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-xs font-bold sm:text-sm">
                <ArrowUp className="w-4 h-4" /> اولویت بالا
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              این درس پیش‌نیاز ۳ درس تخصصی ترم آینده است. توصیه می‌شود حتماً اخذ گردد.
            </p>
          </motion.div>

          <motion.div style={{ y: card2Y }} className="bg-white dark:bg-slate-900 min-w-0 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md">
            <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-lg font-bold leading-7 [overflow-wrap:anywhere] sm:text-xl text-slate-900 dark:text-white">تاریخ اسلام</h3>
                <p className="text-sm text-slate-500">۲ واحد • دروس عمومی</p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-full text-xs font-bold sm:text-sm">
                <ArrowDown className="w-4 h-4" /> اولویت متوسط
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              جهت پر کردن سقف واحد مناسب است، اما تاثیر مستقیم در چارت تخصصی ندارد.
            </p>
          </motion.div>

          <motion.div style={{ y: card3Y }} className="bg-white dark:bg-slate-900 min-w-0 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm opacity-60">
            <div className="mb-4 flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-lg font-bold leading-7 [overflow-wrap:anywhere] sm:text-xl text-slate-900 dark:text-white line-through decoration-red-500">مبانی شبکه‌های کامپیوتری</h3>
                <p className="text-sm text-slate-500">۳ واحد</p>
              </div>
              <div className="flex items-center gap-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-xs font-bold sm:text-sm">
                <Ban className="w-4 h-4" /> مسدود
              </div>
            </div>
            <p className="text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
              اخذ این درس به دلیل عدم پاس شدن «سیستم‌عامل» غیرمجاز است.
            </p>
          </motion.div>
        </div>

        <div className="min-w-0 w-full flex-1 space-y-5 text-right md:space-y-8">
          <h2 className="break-words text-3xl font-black leading-snug text-slate-900 dark:text-white sm:text-4xl md:text-5xl">
            درس‌چین بهت نمیگه چه چیزی ارائه شده؛
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-600 to-indigo-500">میگه چی بهتره برداری.</span>
          </h2>
          <p className="text-base leading-8 text-slate-600 dark:text-slate-400 sm:text-xl">
            الگوریتم‌های توصیه‌گر ما با بررسی گلوگاه‌های چارت تحصیلی شما، دروسی را پیشنهاد می‌دهند که مسیر فارغ‌التحصیلی شما را هموارتر می‌کنند.
          </p>
        </div>
      </div>
    </section>
  );
};
