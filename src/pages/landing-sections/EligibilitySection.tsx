import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { CheckCircle2, Lock } from 'lucide-react';

export const EligibilitySection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const node1Y = useTransform(scrollYProgress, [0.2, 0.4], [50, 0]);
  const node1Opacity = useTransform(scrollYProgress, [0.2, 0.4], [0, 1]);
  
  const node2Y = useTransform(scrollYProgress, [0.4, 0.6], [50, 0]);
  const node2Opacity = useTransform(scrollYProgress, [0.4, 0.6], [0, 1]);
  
  const lineProgress = useTransform(scrollYProgress, [0.4, 0.6], [0, 100]);
  const lineHeight = useTransform(lineProgress, value => `${value}%`);

  return (
    <section id="eligibility" ref={containerRef} className="scroll-mt-24 relative overflow-hidden bg-slate-50/80 px-4 py-16 dark:bg-slate-950/50 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col items-stretch gap-9 lg:flex-row lg:items-center lg:gap-16">
        <div className="min-w-0 flex-1 space-y-5 sm:space-y-7">
          <span className="inline-flex items-center rounded-full border border-teal-200 bg-white/80 px-3 py-1.5 text-xs font-extrabold text-teal-800 dark:border-teal-600/20 dark:bg-slate-900 dark:text-teal-300">شرایط درس‌ها، واضح و قابل پیگیری</span>
          <h2 className="max-w-xl break-words text-[clamp(1.8rem,5vw,3rem)] font-black leading-[1.35] tracking-tight text-slate-950 dark:text-white">
            هر درس، <span className="bg-gradient-to-l from-teal-700 to-amber-700 bg-clip-text text-transparent dark:from-teal-300 dark:to-amber-300">با دلیل مشخص</span>
          </h2>
          <p className="text-base leading-8 text-slate-600 dark:text-slate-400 sm:text-xl">
            درس‌چین قوانین و پیش‌نیازهایی را که برای چارت و ورودی تو ثبت شده‌اند بررسی می‌کند و نشان می‌دهد هر درس چرا قابل انتخاب است یا به بررسی آموزش نیاز دارد. نتیجه به اعتبار داده‌ها و مقررات تأییدشده وابسته است.
          </p>
          
          <div className="space-y-4 pt-4">
            {[
              "نمایش شفاف پیش‌نیاز و هم‌نیاز هر درس",
              "محاسبه واحدها بر اساس چارت و تنظیمات معتبر",
              "یادآوری درس‌های پاس‌شده و موارد نیازمند بررسی"
            ].map((text, i) => (
              <div key={i} className="flex min-w-0 items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <span className="min-w-0 break-words font-medium leading-7 text-slate-700 dark:text-slate-300">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto flex min-h-[300px] w-full min-w-0 max-w-md flex-1 flex-col items-center justify-center rounded-[2rem] bg-gradient-to-br from-teal-100/55 via-white/60 to-amber-100/50 p-4 dark:from-teal-950/25 dark:via-slate-900/50 dark:to-amber-950/30 sm:min-h-[400px] sm:p-7">
          <motion.div style={reduceMotion ? undefined : { opacity: node1Opacity, y: node1Y }} className="w-full">
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
              className="absolute top-0 left-0 w-full bg-teal-600"
              style={reduceMotion ? { height: '100%' } : { height: lineHeight }}
            />
          </div>

          <motion.div style={reduceMotion ? undefined : { opacity: node2Opacity, y: node2Y }} className="w-full">
            <div className="bg-white dark:bg-slate-900 border-2 border-teal-600 relative z-10 flex min-w-0 items-center justify-between rounded-2xl p-4 shadow-lg sm:p-6">
              <div>
                <div className="text-teal-700 dark:text-teal-400 font-bold mb-1 text-sm">مجاز برای اخذ</div>
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
