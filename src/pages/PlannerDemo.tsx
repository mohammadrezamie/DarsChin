import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DemoFeedback } from '../components/DemoFeedback';
import { FluidWeekTimetable } from '../components/FluidWeekTimetable';
import { ThemeToggle } from '../components/ThemeToggle';
import { AlertTriangle, ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Clock3, GraduationCap, RotateCcw } from 'lucide-react';
import {
  DEMO_COURSES,
  DEMO_DAYS,
  DEMO_INITIAL_IDS,
  DEMO_STORAGE_KEY,
  getDemoTimeConflicts,
  getDemoTotalUnits,
  getSelectedCourses,
  readDemoSelection,
  type DemoDay,
} from '../demo/course-planner';

const fa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

export const PlannerDemo: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    try {
      return readDemoSelection(typeof window === 'undefined' ? undefined : window.localStorage);
    } catch {
      return [...DEMO_INITIAL_IDS];
    }
  });
  const [search, setSearch] = useState('');
  const [dayFilter, setDayFilter] = useState<DemoDay | 'all'>('all');

  useEffect(() => {
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(selectedIds));
    } catch {
      // Private browsing / storage restrictions should not break this local playground.
    }
  }, [selectedIds]);

  const selectedCourses = useMemo(() => getSelectedCourses(selectedIds), [selectedIds]);
  const conflicts = useMemo(() => getDemoTimeConflicts(selectedIds), [selectedIds]);
  const conflictIds = useMemo(() => new Set(conflicts.flatMap(({ first, second }) => [first.id, second.id])), [conflicts]);
  const filtered = DEMO_COURSES.filter((course) =>
    (dayFilter === 'all' || course.day === dayFilter) &&
    (course.name.includes(search.trim()) || course.code.toLowerCase().includes(search.trim().toLowerCase())),
  );

  const toggleCourse = (id: string) => {
    setSelectedIds((old) => old.includes(id) ? old.filter((item) => item !== id) : [...old, id]);
  };

  return (
    <div dir="rtl" className="darschin-page min-h-screen bg-slate-50 font-[Vazirmatn] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 font-extrabold text-blue-700 hover:underline dark:text-blue-300">
            <GraduationCap className="h-6 w-6" aria-hidden="true" /> درس‌چین
          </Link>
          <div className="flex flex-wrap items-center gap-2"><ThemeToggle /><DemoFeedback area="planner" /></div>
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800">
            بازگشت به صفحهٔ اصلی <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900 dark:bg-slate-900">
          <h2 className="font-black text-slate-950 dark:text-white">می‌خواهی پنل‌های اصلی درس‌چین را تست کنی؟</h2>
          <p className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">نسخهٔ ساختگیِ همان رابط کاربری دانشجو و مدیر برای بررسی تب‌ها، فرم‌ها و ذخیرهٔ محلی آماده است. به سرور وصل نمی‌شود.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/demo/student" className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 text-sm font-black text-white focus-visible:ring-2 focus-visible:ring-blue-500">آزمایش میز کار دانشجو</Link>
            <Link to="/demo/admin" className="inline-flex min-h-11 items-center rounded-xl border border-blue-400 px-5 text-sm font-black text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-200">آزمایش پنل مدیریت</Link>
          </div>
        </div>

        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
            <BookOpen aria-hidden="true" className="h-4 w-4" /> محیط تعاملیِ آزمایشی
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">برنامه‌ریز هفتگی درس‌چین را امتحان کن</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
            درس‌های نمونه را انتخاب یا حذف کن و هم‌پوشانی ساعت کلاس‌ها را ببین. برنامه فقط در همین مرورگر ذخیره می‌شود؛
            به حساب کاربری یا سرور وصل نیست و هیچ قانون آموزشی یا مجوز انتخاب واحد را تأیید نمی‌کند.
          </p>
        </div>

        <div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
          <strong>اطلاعات ساختگی:</strong> کد درس‌ها، استادها و ساعت‌ها فقط برای آزمایش رابط کاربری هستند. این بخش انتخاب واحد رسمی نیست و نباید برای تصمیم تحصیلی واقعی استفاده شود.
        </div>

        <section aria-label="خلاصه برنامه" className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm text-slate-500 dark:text-slate-400">دروس انتخاب‌شده</div>
            <div className="mt-2 text-3xl font-black">{fa(selectedCourses.length)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm text-slate-500 dark:text-slate-400">مجموع واحدها (فقط نمایشی)</div>
            <div className="mt-2 text-3xl font-black">{fa(getDemoTotalUnits(selectedIds))}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm text-slate-500 dark:text-slate-400">تداخل‌های زمانی</div>
            <div className={`mt-2 text-3xl font-black ${conflicts.length ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{fa(conflicts.length)}</div>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section aria-labelledby="demo-catalogue" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="demo-catalogue" className="text-xl font-black">فهرست درس‌های نمونه</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">برای افزودن یا حذف هر درس، روی دکمهٔ همان ردیف بزن.</p>
              </div>
              <button type="button" onClick={() => setSelectedIds([...DEMO_INITIAL_IDS])} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:hover:bg-slate-800">
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> بازنشانی نمونه
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">جست‌وجوی درس</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="نام درس یا کد DEMO" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">روز هفته</span>
                <select value={dayFilter} onChange={(event) => setDayFilter(event.target.value as DemoDay | 'all')} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950">
                  <option value="all">همهٔ روزها</option>
                  {DEMO_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-5 space-y-3">
              {filtered.length === 0 && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500 dark:bg-slate-800">درسی با این جست‌وجو پیدا نشد.</p>}
              {filtered.map((course) => {
                const isSelected = selectedIds.includes(course.id);
                const conflictsHere = conflictIds.has(course.id);
                return (
                  <div key={course.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm sm:text-base">{course.name}</strong>
                        {conflictsHere && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">تداخل</span>}
                      </div>
                      <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">{course.code} · {fa(course.units)} واحد · {course.instructor}</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300"><Clock3 aria-hidden="true" className="h-4 w-4" /> {course.day}، {course.start} تا {course.end}</p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? 'حذف' : 'افزودن'} ${course.name}`}
                      onClick={() => toggleCourse(course.id)}
                      className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${isSelected ? 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                      {isSelected ? 'حذف از برنامه' : 'افزودن به برنامه'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="demo-schedule" className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="demo-schedule" className="inline-flex items-center gap-2 text-xl font-black">
                  <CalendarDays aria-hidden="true" className="h-5 w-5 text-blue-600" /> جدول هفتگی من
                </h2>
                <button type="button" onClick={() => setSelectedIds([])} disabled={selectedCourses.length === 0} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-950">
                  حذف همهٔ درس‌ها
                </button>
              </div>
              <div className="mt-5">
                <FluidWeekTimetable
                  entries={selectedCourses.map(course => ({
                    id: course.id,
                    title: course.name,
                    day: course.day,
                    start: course.start,
                    end: course.end,
                    subtitle: course.instructor,
                    conflict: conflictIds.has(course.id),
                  }))}
                  onRemove={toggleCourse}
                />
              </div>
            </div>

            <div aria-live="polite" className={`rounded-2xl border p-4 ${conflicts.length ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100' : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100'}`}>
              <div className="flex items-start gap-2">
                {conflicts.length ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <h3 className="font-black">{conflicts.length ? 'تداخل زمانی پیدا شد' : 'تداخل زمانی در برنامهٔ نمونه دیده نشد'}</h3>
                  {conflicts.length ? <ul className="mt-2 list-inside list-disc space-y-1 text-sm">{conflicts.map(({ first, second }) => <li key={first.id + second.id}>{first.name} و {second.name} در {first.day}</li>)}</ul> : <p className="mt-2 text-sm leading-6">این نتیجه فقط برای ساعت‌های نمونه است؛ مجاز بودن اخذ درس بررسی نشده است.</p>}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <aside role="note" aria-label="محدودیت محیط آزمایشی"
        className="border-t border-slate-200 px-4 py-5 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        محیط دمو · اطلاعات نمونه · ذخیرهٔ محلی روی همین دستگاه، نه پایگاه دادهٔ درس‌چین
      </aside>
    </div>
  );
};
