import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Clock, MapPin, User, AlertTriangle } from 'lucide-react';

export const ScheduleSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"]
  });

  const block1Opacity = useTransform(scrollYProgress, [0.3, 0.5], [0, 1]);
  const block2Opacity = useTransform(scrollYProgress, [0.4, 0.6], [0, 1]);
  const block3Opacity = useTransform(scrollYProgress, [0.5, 0.7], [0, 1]);
  const collisionOpacity = useTransform(scrollYProgress, [0.7, 0.8], [0, 1]);
  const resolveOpacity = useTransform(scrollYProgress, [0.8, 1], [0, 1]);

  return (
    <section id="schedule" ref={containerRef} className="scroll-mt-24 py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
          تشخیص هوشمند تداخل
        </h2>
        <p className="text-xl text-slate-600 dark:text-slate-400">
          دیگر نگران هم‌پوشانی کلاس‌ها یا امتحانات نباشید. برنامه هفتگی به‌صورت زنده ترسیم شده و تداخل‌ها را قبل از ثبت نهایی به شما اخطار می‌دهد.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-10 shadow-xl overflow-x-auto relative">
        <div className="grid grid-cols-6 gap-4 min-w-[700px]">
          {['ساعت', 'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه'].map(day => (
            <div key={day} className="text-center font-bold text-slate-500 pb-4 border-b border-slate-200 dark:border-slate-800">{day}</div>
          ))}
          
          <div className="text-center font-medium text-slate-400 py-6">08:00<br/>10:00</div>
          <div className="col-span-1 relative">
            <motion.div style={{ opacity: block1Opacity }} className="absolute inset-2 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
              <div className="font-bold text-blue-900 dark:text-blue-100 text-sm mb-2">فیزیک ۱</div>
              <div className="text-xs flex flex-col gap-1 text-blue-700 dark:text-blue-300">
                <span className="flex items-center gap-1"><User className="w-3 h-3"/>دکتر احمدی</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>کلاس ۱۰۱</span>
              </div>
            </motion.div>
          </div>
          <div className="col-span-1"></div>
          <div className="col-span-1 relative">
             <motion.div style={{ opacity: block2Opacity }} className="absolute inset-2 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
              <div className="font-bold text-emerald-900 dark:text-emerald-100 text-sm mb-2">معادلات دیفرانسیل</div>
              <div className="text-xs flex flex-col gap-1 text-emerald-700 dark:text-emerald-300">
                <span className="flex items-center gap-1"><User className="w-3 h-3"/>دکتر رضایی</span>
              </div>
            </motion.div>
          </div>
          <div className="col-span-2"></div>
          
          <div className="text-center font-medium text-slate-400 py-6">10:00<br/>12:00</div>
          <div className="col-span-1"></div>
          <div className="col-span-1 relative">
            <motion.div style={{ opacity: block3Opacity }} className="absolute inset-2 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3">
              <div className="font-bold text-purple-900 dark:text-purple-100 text-sm mb-2">برنامه‌سازی پیشرفته</div>
            </motion.div>
            
            <motion.div style={{ opacity: collisionOpacity }} className="absolute inset-2 bg-red-100/90 dark:bg-red-900/80 backdrop-blur-sm border-2 border-red-500 rounded-xl p-3 flex flex-col items-center justify-center text-center z-10 shadow-lg shadow-red-500/20">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mb-1" />
              <div className="text-xs font-bold text-red-700 dark:text-red-300 leading-tight">تداخل با<br/>مدار منطقی</div>
            </motion.div>
            
            <motion.div style={{ opacity: resolveOpacity }} className="absolute top-1/2 left-full ml-4 -translate-y-1/2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-xl z-20 hidden md:block">
              <div className="text-xs text-slate-500 mb-2">گروه جایگزین پیشنهادی:</div>
              <div className="font-bold text-sm text-slate-900 dark:text-white mb-1">مدار منطقی - گروه ۲</div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> دوشنبه ۱۳:۰۰
              </div>
            </motion.div>
          </div>
          <div className="col-span-3 border-t border-dashed border-slate-200 dark:border-slate-800"></div>
        </div>
      </div>
    </section>
  );
};
