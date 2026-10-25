import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FlaskConical, RotateCcw, ShieldCheck, GraduationCap, AlertTriangle } from 'lucide-react';
import { DemoAuthProvider } from '../context/AuthContext';
import { resetBrowserDemo } from '../demo/mock-api';
import { StudentDashboard } from '../components/StudentDashboard';
import { DemoFeedback } from '../components/DemoFeedback';
import { ThemeToggle } from '../components/ThemeToggle';
import { AdminDashboard } from '../components/AdminDashboard';

export const DemoWorkspace: React.FC<{ role: 'student' | 'admin' }> = ({ role }) => {
  const [resetConfirm, setResetConfirm] = useState(false);
  return (
    <DemoAuthProvider role={role}>
      <div dir="rtl" className="min-h-screen bg-slate-50 font-[Vazirmatn] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="relative z-50 border-b border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900 dark:bg-amber-950 md:sticky md:top-0 md:px-5">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-2 text-amber-950 dark:text-amber-100">
              <FlaskConical className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <div className="font-black">دموی پایلوت کارشناسی برق علوم و تحقیقات — {role === 'admin' ? 'مدیر آزمایشی' : 'دانشجوی آزمایشی'}</div>
                <p className="text-xs leading-6">
                  داده و نقش‌ها ساختگی‌اند؛ تغییرات فقط در همین مرورگر ذخیره می‌شوند. نتیجهٔ قوانین دانشگاه، مجوز واقعی نیست.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ThemeToggle />
              <Link to="/demo/student" aria-current={role==='student'?'page':undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold focus-visible:ring-2 focus-visible:ring-blue-500 ${role==='student'?'bg-blue-700 text-white':'bg-white text-blue-800 dark:bg-slate-900 dark:text-blue-200'}`}>
                <GraduationCap aria-hidden="true" className="h-4 w-4" /> دانشجو
              </Link>
              <Link to="/demo/admin" aria-current={role==='admin'?'page':undefined} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold focus-visible:ring-2 focus-visible:ring-blue-500 ${role==='admin'?'bg-blue-700 text-white':'bg-white text-blue-800 dark:bg-slate-900 dark:text-blue-200'}`}>
                <ShieldCheck aria-hidden="true" className="h-4 w-4" /> مدیر
              </Link>
              <Link to="/demo" className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-amber-400 px-3 text-xs font-bold text-amber-900 dark:text-amber-100">
                <ArrowRight aria-hidden="true" className="h-4 w-4" /> برنامه‌ریز ساده
              </Link>
              <DemoFeedback area={role} />
              <button type="button" onClick={() => setResetConfirm(true)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-amber-400 px-3 text-xs font-bold text-amber-900 dark:text-amber-100">
                <RotateCcw aria-hidden="true" className="h-4 w-4" /> بازنشانی دمو
              </button>
            </div>
          </div>
          {resetConfirm && (
            <div role="alertdialog" aria-label="تأیید بازنشانی" className="mx-auto mt-3 max-w-7xl rounded-xl border border-amber-300 bg-white p-3 dark:bg-slate-900">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> تمام تغییرات ساختگی این بخش از مرورگر پاک شوند؟</div>
              <div className="flex gap-2">
                <button type="button" className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white" onClick={() => { resetBrowserDemo(); window.location.reload(); }}>بله، بازنشانی</button>
                <button type="button" className="rounded-lg border px-4 py-2 text-xs font-bold" onClick={() => setResetConfirm(false)}>انصراف</button>
              </div>
            </div>
          )}
        </div>

        <main className="mx-auto max-w-7xl min-w-0 px-3 py-5 sm:px-6 sm:py-7">
          {role === 'student' ? <StudentDashboard /> : <AdminDashboard />}
        </main>
        <footer className="mx-auto max-w-7xl border-t border-slate-200 px-4 py-6 text-xs text-slate-500 dark:border-slate-800">
          این نسخه برای دیباگ رابط کاربری است. بخش‌های متصل به سرور واقعی ممکن است در شبیه‌ساز هنوز پشتیبانی نشوند.
          گزارش‌های این محیط به سرور ارسال نمی‌شوند.
        </footer>
      </div>
    </DemoAuthProvider>
  );
};
