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
    <section id="eligibility" ref={containerRef} className="scroll-mt-24 relative overflow-hidden bg-slate-50 px-3 py-16 dark:bg-slate-950/50 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col items-stretch gap-8 md:flex-row md:items-center md:gap-16">
        <div className="min-w-0 flex-1 space-y-5 sm:space-y-8">
          <h2 className="break-words text-3xl font-black leading-snug text-slate-900 dark:text-white sm:text-4xl md:text-5xl">
            موتور بررسی قوانین آموزشی
          </h2>
          <p className="text-base leading-8 text-slate-600 dark:text-slate-400 sm:text-xl">
            درس‌چین قبل از اینکه شما خطایی در سامانه دانشگاه دریافت کنید، تمام پیش‌نیازها، هم‌نیازها و سقف واحدهای شما را به‌صورت زنده تحلیل می‌کند.
          </p>
          
          <div className="space-y-4 pt-4">
            {[
              "تشخیص خودکار دانشجویان ترم آخر و حذف محدودیت‌ها",
              "محاسبه دروس مازاد بر سقف مجاز",
              "جلوگیری از انتخاب دروس تکراری یا پاس‌شده"
            ].map((text, i) => (
              <div key={i} className="flex min-w-0 items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <span className="min-w-0 break-words font-medium leading-7 text-slate-700 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex min-h-[300px] w-full min-w-0 max-w-md flex-1 flex-col items-center justify-center sm:min-h-[400px]">
          <motion.div style={{ opacity: node1Opacity, y: node1Y }} className="w-full">
            <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500 relative z-10 flex min-w-0 items-center justify-between rounded-2xl p-4 shadow-lg sm:p-6">
              <div>
                <div className="text-emerald-600 dark:text-emerald-400 font-bold mb-1 text-sm">پاس شده</div>
                <div className="break-words text-lg font-bold sm:text-xl">ریاضی ۱</div>
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
            <div className="bg-white dark:bg-slate-900 border-2 border-blue-500 relative z-10 flex min-w-0 items-center justify-between rounded-2xl p-4 shadow-lg sm:p-6">
              <div>
                <div className="text-blue-600 dark:text-blue-400 font-bold mb-1 text-sm">مجاز برای اخذ</div>
                <div className="break-words text-lg font-bold sm:text-xl">ریاضی ۲</div>
              </div>
              <Lock className="w-8 h-8 text-slate-300 dark:text-slate-600 absolute left-6 opacity-0" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
