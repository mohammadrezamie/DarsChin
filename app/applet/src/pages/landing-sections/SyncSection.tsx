import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Chrome, RefreshCw, Server, ArrowLeftRight, CheckCircle2 } from 'lucide-react';

export const SyncSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"]
  });

  const arrowOpacity = useTransform(scrollYProgress, [0.3, 0.6], [0, 1]);
  const arrowX = useTransform(scrollYProgress, [0.3, 0.6], [-50, 0]);
  const statsOpacity = useTransform(scrollYProgress, [0.6, 0.8], [0, 1]);

  return (
    <section ref={containerRef} className="py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
          انتقال داده‌ها با یک کلیک
        </h2>
        <p className="text-xl text-slate-600 dark:text-slate-400">
          توسط افزونه کروم درس‌چین، تمامی اطلاعات دروس ارائه‌شده از آموزشیار مستقیماً و در لحظه به پلتفرم درس‌چین منتقل می‌شود. بدون نیاز به تایپ دستی.
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 relative py-10">
        
        {/* Educationalyar Mock */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl flex-1 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
             <Chrome className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">سامانه آموزشیار</h3>
          <p className="text-sm text-slate-500 mb-6">دروس جستجو شده و نتایج پراکنده</p>
          
          <div className="space-y-2 opacity-50">
             <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded px-2 text-xs flex items-center text-slate-400">ردیف ۱: ریاضی ۱ - کد ۵۴۳...</div>
             <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded px-2 text-xs flex items-center text-slate-400">ردیف ۲: فیزیک ۲ - کد ۹۸۷...</div>
          </div>
        </div>

        {/* Sync Animation */}
        <motion.div style={{ opacity: arrowOpacity, x: arrowX }} className="flex flex-col items-center justify-center">
          <div className="bg-blue-600 text-white p-4 rounded-full shadow-lg shadow-blue-500/30 z-10">
            <RefreshCw className="w-8 h-8 animate-spin-slow" />
          </div>
          <div className="hidden md:block w-32 h-1 bg-gradient-to-l from-blue-600 to-transparent absolute top-1/2 -translate-y-1/2 -z-10 -ml-16"></div>
          <div className="md:hidden h-16 w-1 bg-gradient-to-t from-blue-600 to-transparent absolute top-1/2 left-1/2 -translate-x-1/2 -z-10"></div>
        </motion.div>

        {/* DARSCHYN Mock */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl flex-1 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
             <Server className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">موتور درس‌چین</h3>
          <p className="text-sm text-slate-500 mb-6">داده‌های ساخت‌یافته و پردازش‌شده</p>

          <motion.div style={{ opacity: statsOpacity }} className="grid grid-cols-2 gap-2 text-sm font-bold">
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="text-2xl text-slate-900 dark:text-white mb-1">۱,۲۴۸</div>
              <div className="text-slate-500 text-xs">رکورد دریافت شده</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
              <div className="text-2xl text-emerald-600 dark:text-emerald-400 mb-1">۱,۱۹۸</div>
              <div className="text-emerald-700 dark:text-emerald-500 text-xs">رکورد معتبر</div>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
};
