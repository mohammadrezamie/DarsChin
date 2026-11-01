import React from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Sparkles, Calendar, BookOpen, ShieldCheck } from 'lucide-react';

export const HeroSection: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, 300]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  return (
    <section className="relative min-h-[90vh] flex flex-col items-center pt-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <motion.div style={{ y, opacity }} className="text-center z-10 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-bold mb-8 shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          <span>پلتفرم هوشمند برنامه‌ریزی تحصیلی درس‌چین</span>
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.1]"
        >
          انتخاب واحد <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-600 to-indigo-500">بدون حدس و خطا</span>
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg md:text-2xl text-slate-600 dark:text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed"
        >
          یک پلتفرم API-first برای تحلیل قوانین آموزشی، ساخت برنامه هفتگی ایده‌آل و همگام‌سازی لحظه‌ای با سیستم دانشگاه.
        </motion.p>
      </motion.div>

      {/* Browser Mockup / Live Demo */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-6xl mt-8 relative z-20"
      >
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col">
          {/* Browser Header */}
          <div className="h-12 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <div className="mx-auto bg-white dark:bg-slate-900 rounded-md px-32 py-1 text-xs text-slate-400 border border-slate-200 dark:border-slate-800">darschyn.app</div>
          </div>
          
          {/* Browser Body - Mini Dashboard */}
          <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  دروس پیشنهادی
                </h3>
                <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">مجاز به اخذ: ۲۰ واحد</span>
              </div>
              
              {/* Course Cards */}
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-lg mb-1">ساختمان داده‌ها</div>
                  <div className="text-sm text-slate-500">۳ واحد • پیش‌نیاز پاس شده</div>
                </div>
                <div className="h-10 px-4 bg-blue-600 text-white rounded-lg flex items-center font-bold text-sm">اخذ شده</div>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 flex justify-between items-center opacity-70"
              >
                <div>
                  <div className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-1">طراحی الگوریتم</div>
                  <div className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" />
                    خطا: نیازمند ساختمان داده‌ها
                  </div>
                </div>
                <div className="h-10 px-4 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-lg flex items-center font-bold text-sm cursor-not-allowed">قفل</div>
              </motion.div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                وضعیت برنامه
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500">واحدهای انتخابی</span>
                    <span className="font-bold">۱۷ / ۲۰</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "85%" }}
                      transition={{ delay: 1, duration: 1 }}
                      className="h-full bg-blue-500 rounded-full"
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-sm text-slate-500 mb-2">وضعیت تداخل</div>
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    بدون تداخل زمانی و امتحانی
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative background glow */}
        <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-20 blur-3xl -z-10 rounded-full" />
      </motion.div>
    </section>
  );
};
