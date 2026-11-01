import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowLeft, CheckCircle2, Chrome, Database, RefreshCw, ShieldCheck } from 'lucide-react';

export const SyncSection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start end', 'center center'] });
  const arrowOpacity = useTransform(scrollYProgress, [0.25, 0.55], [0.25, 1]);
  const arrowX = useTransform(scrollYProgress, [0.25, 0.55], [-24, 0]);

  const steps = [
    { icon: ShieldCheck, title: 'اعتبارسنجی', description: 'ساختار و کامل‌بودن داده پیش از پذیرش بررسی می‌شود.' },
    { icon: Database, title: 'تطبیق و آماده‌سازی', description: 'کد درس، گروه، زمان و ظرفیت باید با داده‌های معتبر تطبیق داده شوند.' },
    { icon: CheckCircle2, title: 'ثبت نتیجه', description: 'وضعیت دریافت، تطبیق موفق یا خطای پردازش جداگانه ثبت می‌شود؛ دریافت داده به معنی تأیید آن نیست.' },
  ];

  return (
    <section id="data-flow" ref={containerRef} dir="rtl" className="scroll-mt-24 relative mx-auto max-w-7xl overflow-hidden px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300"><RefreshCw className="h-3.5 w-3.5" /> مسیر ورود داده</span>
        <h2 className="mb-5 text-3xl font-black text-slate-900 dark:text-white sm:text-4xl md:text-5xl">از داده خام تا برنامه‌ریزی قابل اتکا</h2>
        <p className="text-base leading-8 text-slate-600 dark:text-slate-400 sm:text-lg">
          افزونه یکی از مسیرهای ورود داده به درس‌چین است. داده دریافتی باید اعتبارسنجی و با اطلاعات آموزشی تطبیق داده شود؛ صرف دریافت فایل به معنی تأیید نهایی یا به‌روز بودن اطلاعات نیست.
        </p>
      </div>

      <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr] md:gap-5">
        <div className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/75 sm:p-7">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-800 dark:bg-teal-600/10 dark:text-teal-300"><Chrome className="h-7 w-7" /></div>
            <div><h3 className="text-lg font-black text-slate-900 dark:text-white">منبع داده</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">افزونه یا منبع مجاز دیگر</p></div>
          </div>
          <div className="space-y-2.5">
            {['شناسه و نام درس', 'گروه و اطلاعات ارائه', 'زمان دریافت و ترم'].map((label) => <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300"><span className="h-2 w-2 rounded-full bg-teal-600" />{label}</div>)}
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">این موارد، نمونه فیلدهای داده هستند؛ داده زنده آموزشیار در این پیش‌نمایش نمایش داده نمی‌شود.</p>
        </div>

        <motion.div style={{ opacity: arrowOpacity, x: arrowX }} className="flex items-center justify-center py-1 text-teal-700 dark:text-teal-400">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-teal-200 bg-teal-50 shadow-sm dark:border-teal-400/20 dark:bg-teal-600/10"><ArrowLeft className="h-5 w-5" /></div>
        </motion.div>

        <div className="rounded-3xl border border-teal-200/80 bg-gradient-to-br from-teal-50/80 to-white p-6 shadow-sm dark:border-teal-600/20 dark:from-teal-950/30 dark:to-slate-900 sm:p-7">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-700/20"><Database className="h-7 w-7" /></div>
            <div><h3 className="text-lg font-black text-slate-900 dark:text-white">پردازش در درس‌چین</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">مراحل لازم برای داده معتبر</p></div>
          </div>
          <div className="space-y-3">
            {steps.map(({ icon: Icon, title, description }, index) => <div key={title} className="flex gap-3 rounded-2xl border border-white/90 bg-white/80 p-3.5 dark:border-slate-700/70 dark:bg-slate-900/70"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><Icon className="h-4 w-4" /></div><div><div className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white"><span className="text-xs text-slate-400">۰{index + 1}</span>{title}</div><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">{description}</p></div></div>)}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-100">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
        <p className="text-sm leading-6">در این مسیر، «دریافت شد» با «با موفقیت تطبیق داده شد» یکسان نیست. رکورد ناقص یا مبهم باید خطا بگیرد و تا زمان تأیید کامل، نباید جایگزین داده‌های معتبر قبلی شود. این بخش توضیح فرایند است و وضعیت زنده‌ای از آموزشیار نمایش نمی‌دهد.</p>
      </div>
    </section>
  );
};
