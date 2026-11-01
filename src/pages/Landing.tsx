import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Menu, X } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { HeroSection } from './landing-sections/HeroSection';
import { EligibilitySection } from './landing-sections/EligibilitySection';
import { RecommendationSection } from './landing-sections/RecommendationSection';
import { ScheduleSection } from './landing-sections/ScheduleSection';
import { SyncSection } from './landing-sections/SyncSection';
import { DashboardShowcaseSection } from './landing-sections/DashboardShowcaseSection';
import { GettingStartedSection } from './landing-sections/GettingStartedSection';

const Landing: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const closeMenu = () => setMenuOpen(false);
  useEffect(() => {
    if (!menuOpen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
        triggerRef.current?.focus();
      }
      if (event.key !== 'Tab') return;
      const elements = menuRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div dir="rtl" className="darschin-page min-h-screen bg-slate-50 font-[Vazirmatn] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/85">
        <div className="mx-auto flex h-[4.25rem] max-w-7xl min-w-0 items-center justify-between gap-1.5 px-2.5 min-[380px]:px-3 sm:gap-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              ref={triggerRef}
              type="button"
              aria-label="بازکردن منوی اصلی"
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-navigation"
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 xl:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </button>
          <Link to="/" aria-label="صفحه اصلی درس‌چین" className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20 sm:h-10 sm:w-10"><GraduationCap className="h-5 w-5" /></span>
            <span><span className="block text-lg font-black leading-tight text-slate-950 dark:text-white">درس‌چین</span><span className="hidden text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:block">دستیار برنامه‌ریزی تحصیلی</span></span>
          </Link>
          </div>

          <nav aria-label="ناوبری صفحه" className="hidden items-center gap-1 xl:flex">
            <Link to="/help" className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-slate-800">مرکز راهنما</Link>
            <a href="#getting-started" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">راهنمای شروع</a>
            <a href="#eligibility" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">قوانین آموزشی</a>
            <a href="#recommendations" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">پیشنهاد درس</a>
            <a href="#schedule" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">برنامه هفتگی</a>
            <a href="#data-flow" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">ورود داده</a>
            <a href="#workspaces" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">امکانات سامانه</a>
          </nav>

          <div className="flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-2">
            <ThemeToggle />
            <Link to="/demo/student" className="hidden lg:inline-flex min-h-10 items-center rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-extrabold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">تست رایگان دمو</Link>
            <Link to="/login" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-3 sm:text-sm dark:text-slate-200 dark:hover:bg-slate-800">ورود</Link>
            <Link to="/register" className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-extrabold text-white shadow-md shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 sm:px-4">
              ثبت‌نام <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>
      {menuOpen && (
        <div className="fixed inset-0 z-[80] xl:hidden" dir="rtl">
          <div role="presentation" className="absolute inset-0 bg-slate-950/60"
            onClick={() => { closeMenu(); triggerRef.current?.focus(); }} />
          <nav
            ref={menuRef}
            id="landing-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="منوی اصلی صفحه"
            className="darschin-drawer absolute inset-y-0 right-0 flex w-[min(90vw,360px)] max-w-full flex-col overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-700">
              <strong className="text-lg font-black text-slate-950 dark:text-white">منوی درس‌چین</strong>
              <button ref={closeRef} type="button" aria-label="بستن منوی اصلی" onClick={() => { closeMenu(); triggerRef.current?.focus(); }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-800">
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1 text-sm font-bold">
              {[
                { href: '#getting-started', label: 'راهنمای شروع و سؤالات' },
                { href: '#eligibility', label: 'قوانین آموزشی' },
                { href: '#recommendations', label: 'پیشنهاد درس' },
                { href: '#schedule', label: 'برنامه هفتگی' },
                { href: '#data-flow', label: 'ورود داده' },
                { href: '#workspaces', label: 'امکانات سامانه' },
              ].map(item => (
                <a key={item.href} href={item.href} onClick={closeMenu}
                  className="flex min-h-12 items-center rounded-xl px-4 text-slate-800 hover:bg-blue-50 dark:text-slate-100 dark:hover:bg-slate-800">
                  {item.label}
                </a>
              ))}
              <Link to="/help" onClick={closeMenu} className="mt-2 flex min-h-12 items-center rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">مرکز آموزش و سؤالات متداول</Link>
              <div className="mt-4 space-y-2 rounded-xl bg-blue-50 p-3 dark:bg-blue-950/40">
                <p className="text-xs font-bold text-blue-900 dark:text-blue-200">تجربهٔ محیط دانشجو بدون شماره، رمز یا ثبت‌نام</p>
                <Link to="/demo/student" onClick={closeMenu} className="flex min-h-11 items-center justify-center rounded-xl bg-blue-700 text-white">دموی دانشجو</Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <Link to="/login" onClick={closeMenu} className="flex min-h-12 items-center justify-center rounded-xl border border-slate-300 text-slate-900 dark:border-slate-700 dark:text-white">ورود</Link>
                <Link to="/register" onClick={closeMenu} className="flex min-h-12 items-center justify-center rounded-xl bg-blue-600 text-white">ثبت‌نام</Link>
              </div>
            </div>
          </nav>
        </div>
      )}

      <main>
        <HeroSection />
        <section aria-label="انتخاب دسترسی دمو" className="darschin-demo-entry relative mx-auto -mt-3 mb-10 max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="darschin-demo-entry__body grid min-w-0 gap-4 rounded-[1.75rem] border border-blue-200/80 bg-gradient-to-br from-white via-blue-50/80 to-indigo-50/60 p-4 shadow-[0_22px_60px_-32px_rgba(37,99,235,0.35)] sm:grid-cols-[1fr_auto] sm:items-center sm:p-7 dark:border-blue-900/70 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/40">
            <div>
              <p className="text-xs font-black tracking-wide text-blue-700 dark:text-blue-300">پایلوت دانشگاه آزاد · مهندسی برق کارشناسی · علوم و تحقیقات</p>
              <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl dark:text-white">بدون ساخت حساب، درس‌چین را امتحان کن</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">داده‌های دمو ساختگی‌اند. تغییرات صرفاً در مرورگر تو ذخیره می‌شوند؛ هیچ اطلاعاتی در دانشگاه ثبت نمی‌شود.</p>
            </div>
            <div className="darschin-demo-entry__actions sm:justify-end">
              <Link to="/demo/student" className="inline-flex min-h-12 min-w-0 flex-[1_1_130px] items-center justify-center rounded-xl bg-blue-700 px-4 text-center text-sm font-black leading-6 text-white shadow-lg shadow-blue-700/15 transition hover:-translate-y-0.5 hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex-none sm:px-5">ورود دمو دانشجو</Link>
              <Link to="/demo" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300 sm:flex-none">برنامه‌ریز ساده</Link>
            </div>
          </div>
        </section>
        <GettingStartedSection />
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
          <div className="flex flex-wrap items-center justify-center gap-4"><a href="/guide/" className="transition hover:text-white">راهنمای انتخاب واحد</a><Link to="/help" className="transition hover:text-white">راهنمای استفاده</Link><Link to="/login" className="transition hover:text-white">ورود</Link><Link to="/register" className="transition hover:text-white">ثبت‌نام</Link></div>
        </div>
      </footer>
    </div>
  );
};

export { Landing };
