import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { CheckCircle2, Lock } from 'lucide-react';

export const EligibilitySection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const node1Y = useTransform(scrollYProgress, [0.2, 0.4], [50, 0]);
  const node1Opacity = useTransform(scrollYProgress, [0.2, 0.4], [0, 1]);
  
  const node2Y = useTransform(scrollYProgress, [0.4, 0.6], [50, 0]);
  const node2Opacity = useTransform(scrollYProgress, [0.4, 0.6], [0, 1]);
  
  const lineProgress = useTransform(scrollYProgress, [0.4, 0.6], [0, 100]);

  return (
    <section ref={containerRef} className="py-32 px-4 sm:px-6 lg:px-8 relative bg-slate-50 dark:bg-slate-950/50 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
        <div className="flex-1 space-y-8">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white leading-tight">
            موتور بررسی قوانین آموزشی
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
            درس‌چین قبل از اینکه شما خطایی در سامانه دانشگاه دریافت کنید، تمام پیش‌نیازها، هم‌نیازها و سقف واحدهای شما را به‌صورت زنده تحلیل می‌کند.
          </p>
          
          <div className="space-y-4 pt-4">
            {[
              "تشخیص خودکار دانشجویان ترم آخر و حذف محدودیت‌ها",
              "محاسبه دروس مازاد بر سقف مجاز",
              "جلوگیری از انتخاب دروس تکراری یا پاس‌شده"
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <span className="font-medium text-slate-700 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 w-full max-w-md relative min-h-[400px] flex flex-col items-center justify-center">
          <motion.div style={{ opacity: node1Opacity, y: node1Y }} className="w-full">
            <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-2xl p-6 shadow-lg flex justify-between items-center z-10 relative">
              <div>
                <div className="text-emerald-600 dark:text-emerald-400 font-bold mb-1 text-sm">پاس شده</div>
                <div className="text-xl font-bold">ریاضی ۱</div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
          </motion.div>

          <div className="h-24 w-1 bg-slate-200 dark:bg-slate-800 my-2 relative overflow-hidden">
            <motion.div 
              className="absolute top-0 left-0 w-full bg-blue-500"
              style={{ height: useTransform(lineProgress, v => `${v}%`) }}
            />
          </div>

          <motion.div style={{ opacity: node2Opacity, y: node2Y }} className="w-full">
            <div className="bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-2xl p-6 shadow-lg flex justify-between items-center z-10 relative">
              <div>
                <div className="text-blue-600 dark:text-blue-400 font-bold mb-1 text-sm">مجاز برای اخذ</div>
                <div className="text-xl font-bold">ریاضی ۲</div>
              </div>
              <Lock className="w-8 h-8 text-slate-300 dark:text-slate-600 absolute left-6 opacity-0" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
