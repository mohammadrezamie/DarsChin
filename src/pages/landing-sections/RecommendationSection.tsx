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
    <section ref={containerRef} className="py-32 px-4 sm:px-6 lg:px-8 bg-blue-50/50 dark:bg-slate-900/30 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
        <div className="flex-1 w-full space-y-6">
          <motion.div style={{ y: card1Y }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-900/50 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500"></div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">طراحی الگوریتم</h3>
                <p className="text-sm text-slate-500">۳ واحد • پیش‌نیاز حیاتی</p>
              </div>
              <div className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full text-sm font-bold">
                <ArrowUp className="w-4 h-4" /> اولویت بالا
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              این درس پیش‌نیاز ۳ درس تخصصی ترم آینده است. توصیه می‌شود حتماً اخذ گردد.
            </p>
          </motion.div>

          <motion.div style={{ y: card2Y }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">تاریخ اسلام</h3>
                <p className="text-sm text-slate-500">۲ واحد • دروس عمومی</p>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-full text-sm font-bold">
                <ArrowDown className="w-4 h-4" /> اولویت متوسط
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              جهت پر کردن سقف واحد مناسب است، اما تاثیر مستقیم در چارت تخصصی ندارد.
            </p>
          </motion.div>

          <motion.div style={{ y: card3Y }} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm opacity-60">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white line-through decoration-red-500">مبانی شبکه‌های کامپیوتری</h3>
                <p className="text-sm text-slate-500">۳ واحد</p>
              </div>
              <div className="flex items-center gap-1 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1 rounded-full text-sm font-bold">
                <Ban className="w-4 h-4" /> مسدود
              </div>
            </div>
            <p className="text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
              اخذ این درس به دلیل عدم پاس شدن «سیستم‌عامل» غیرمجاز است.
            </p>
          </motion.div>
        </div>

        <div className="flex-1 space-y-8 text-left md:text-right">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white leading-tight">
            درس‌چین بهت نمیگه چه چیزی ارائه شده؛
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-600 to-indigo-500">میگه چی بهتره برداری.</span>
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
            الگوریتم‌های توصیه‌گر ما با بررسی گلوگاه‌های چارت تحصیلی شما، دروسی را پیشنهاد می‌دهند که مسیر فارغ‌التحصیلی شما را هموارتر می‌کنند.
          </p>
        </div>
      </div>
    </section>
  );
};
