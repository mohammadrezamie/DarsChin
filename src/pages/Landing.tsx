import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { HeroSection } from './landing-sections/HeroSection';
import { EligibilitySection } from './landing-sections/EligibilitySection';
import { RecommendationSection } from './landing-sections/RecommendationSection';
import { ScheduleSection } from './landing-sections/ScheduleSection';
import { SyncSection } from './landing-sections/SyncSection';
import { DashboardShowcaseSection } from './landing-sections/DashboardShowcaseSection';

const Landing: React.FC = () => {
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 font-[Vazirmatn] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/85">
        <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="صفحه اصلی درس‌چین" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"><GraduationCap className="h-5 w-5" /></span>
            <span><span className="block text-lg font-black leading-tight text-slate-950 dark:text-white">درس‌چین</span><span className="hidden text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:block">دستیار برنامه‌ریزی تحصیلی</span></span>
          </Link>

          <nav aria-label="ناوبری صفحه" className="hidden items-center gap-1 lg:flex">
            <a href="#eligibility" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">قوانین آموزشی</a>
            <a href="#recommendations" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">پیشنهاد درس</a>
            <a href="#schedule" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">برنامه هفتگی</a>
            <a href="#data-flow" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">ورود داده</a>
            <a href="#workspaces" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">امکانات سامانه</a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">ورود</Link>
            <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-extrabold text-white shadow-md shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 sm:px-4">
              ثبت‌نام <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <HeroSection />
        <EligibilitySection />
        <RecommendationSection />
        <ScheduleSection />
        <SyncSection />
        <DashboardShowcaseSection />

        <section className="relative overflow-hidden bg-slate-950 px-4 py-20 text-center text-white sm:px-6 sm:py-28 lg:px-8">
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-l from-blue-900/70 via-slate-950 to-violet-950/50" />
          <div className="relative mx-auto max-w-4xl">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-blue-200">قدم بعدی، برنامه‌ریزی دقیق‌تر</span>
            <h2 className="mb-6 text-3xl font-black leading-tight sm:text-4xl md:text-5xl">مسیر تحصیلی‌ات را یک‌جا ببین</h2>
            <p className="mx-auto mb-9 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              سوابق درسی، وضعیت ارائه‌ها و انتخاب‌های برنامه هفتگی را در یک فضای منظم دنبال کن. نتیجه نهایی به کامل‌بودن و صحت اطلاعات آموزشی وابسته است.
            </p>
            <Link to="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-black text-blue-700 transition hover:-translate-y-0.5 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30">
              ساخت حساب کاربری <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 px-4 py-10 text-center text-sm text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Link to="/" className="inline-flex items-center gap-2 font-extrabold text-white"><GraduationCap className="h-5 w-5 text-blue-400" /> درس‌چین</Link>
          <p>© ۲۰۲۶ درس‌چین · دستیار برنامه‌ریزی تحصیلی</p>
          <div className="flex items-center gap-4"><Link to="/login" className="transition hover:text-white">ورود</Link><Link to="/register" className="transition hover:text-white">ثبت‌نام</Link></div>
        </div>
      </footer>
    </div>
  );
};

export { Landing };
