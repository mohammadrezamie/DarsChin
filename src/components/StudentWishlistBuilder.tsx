import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpenCheck, Plus, Search, Trash2 } from 'lucide-react';
import { apiRequest } from '../utils/api';
import type { CourseEligibilityResult, CourseRecommendation } from '../types';

interface BasketCourse {
  id: string;
  name: string;
  code: string;
  units: number;
  category: string;
  suggestedSemester?: number;
  graduationAnalysisValid?: boolean;
  noChoiceFutureCoursesCount?: number;
  choiceOnlyFutureCoursesCount?: number;
  longestRemainingPrerequisiteChain?: number;
}

interface Props {
  curriculumId: string | null;
  wishlistCourseIds: string[];
  evaluations: CourseEligibilityResult[];
  recommendations: CourseRecommendation[];
  onSave: (ids: string[]) => Promise<boolean>;
}

/** A wish list is NOT a registered plan. It can contain more units than a
 * student may ultimately take, allowing meaningful comparison before section choice. */
export const StudentWishlistBuilder: React.FC<Props> = ({
  curriculumId, wishlistCourseIds, evaluations, recommendations, onSave,
}) => {
  const [catalog, setCatalog] = useState<BasketCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    if (!curriculumId) { setCatalog([]); setError('ابتدا پرونده و چارت تحصیلی خود را تکمیل کن.'); return; }
    setLoading(true);
    setError('');
    void apiRequest<BasketCourse[]>('/api/student/wishlist/catalog')
      .then(response => {
        if (!active) return;
        if (response.success && Array.isArray(response.data)) setCatalog(response.data);
        else { setCatalog([]); setError(response.error || 'فهرست دروس چارت در دسترس نیست.'); }
      })
      .catch(() => { if (active) setError('اتصال برای دریافت درس‌های چارت برقرار نشد.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [curriculumId]);

  const byId = useMemo(() => new Map(catalog.map(c => [c.id, c])), [catalog]);
  const offered = useMemo(() => new Set(evaluations.map(e => e.courseId)), [evaluations]);
  const recByCourse = useMemo(() => new Map(recommendations.map(r => [r.courseId, r])), [recommendations]);
  const selected = wishlistCourseIds.map(id => byId.get(id)).filter((c): c is BasketCourse => !!c);
  const outdatedIds = wishlistCourseIds.filter(id => !byId.has(id));
  const totalUnits = selected.reduce((n, c) => n + c.units, 0);
  const normalized = search.trim().toLocaleLowerCase('fa');
  const available = catalog.filter(c => !wishlistCourseIds.includes(c.id) &&
    (!normalized || c.name.toLocaleLowerCase('fa').includes(normalized) || c.code.toLocaleLowerCase('fa').includes(normalized)))
    .sort((a, b) =>
      // Every outstanding chart course participates, including courses that
      // have no offering this term or are not yet eligible to register.
      (recByCourse.get(b.id)?.noChoiceFutureCoursesCount ?? b.noChoiceFutureCoursesCount ?? 0) -
      (recByCourse.get(a.id)?.noChoiceFutureCoursesCount ?? a.noChoiceFutureCoursesCount ?? 0) ||
      (recByCourse.get(b.id)?.longestNoChoiceRemainingChain ?? b.longestRemainingPrerequisiteChain ?? 0) -
      (recByCourse.get(a.id)?.longestNoChoiceRemainingChain ?? a.longestRemainingPrerequisiteChain ?? 0) ||
      (recByCourse.get(b.id)?.score ?? 0) - (recByCourse.get(a.id)?.score ?? 0) ||
      (recByCourse.get(b.id)?.unlockedFutureCoursesCount ?? 0) - (recByCourse.get(a.id)?.unlockedFutureCoursesCount ?? 0) ||
      (recByCourse.get(b.id)?.longestPrerequisiteChain ?? 0) - (recByCourse.get(a.id)?.longestPrerequisiteChain ?? 0) ||
      Number(a.suggestedSemester || 99) - Number(b.suggestedSemester || 99) ||
      a.name.localeCompare(b.name, 'fa'));

  const mutate = async (ids: string[]) => {
    if (saving || loading || error) return;
    setSaveError('');
    setSaving(true);
    const saved = await onSave(ids);
    setSaving(false);
    if (!saved) setSaveError('سبد ذخیره نشد؛ تغییر قبلی حفظ شده است. دوباره تلاش کن.');
  };

  return (
    <section dir="rtl" aria-labelledby="wishlist-heading" className="space-y-4">
      <header className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
        <h3 id="wishlist-heading" className="flex items-center gap-2 text-base font-extrabold text-indigo-950 dark:text-indigo-100">
          <BookOpenCheck className="h-5 w-5" aria-hidden="true" /> ۱. اول درس‌هایی را که می‌خواهی انتخاب کن
        </h3>
        <p className="mt-1 text-xs leading-7 text-indigo-900 dark:text-indigo-200">
          این فهرست انتخاب نام درس است؛ پیشنهادهای هوشمند کنار همان درس نمایش داده می‌شوند. حتی ۴۰ واحد یا بیشتر هم می‌توانی برای مقایسه نگه داری.
          این‌ها <strong>انتخاب واحد نهایی نیستند</strong>؛ پیش‌نیاز، ظرفیت، استاد، تداخل و سقف واحد هنگام ساخت برنامهٔ نهایی جداگانه بررسی می‌شوند.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-bold text-indigo-900 dark:text-indigo-200">
          <span>{selected.length.toLocaleString('fa-IR')} درس علاقه‌مندی</span>
          <span aria-hidden="true">·</span>
          <span>{totalUnits.toLocaleString('fa-IR')} واحد پیشنهادی، غیرالزام‌آور</span>
        </div>
      </header>

      {saveError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs dark:border-rose-900 dark:bg-rose-950/30">{saveError}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
      {!loading && !error && outdatedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p>{outdatedIds.length.toLocaleString('fa-IR')} درس سبد متعلق به چارت فعلی نیست یا قبلاً پاس شده؛ هیچ‌چیز خودکار پاک نشده است.</p>
          <button type="button" disabled={saving} onClick={() => void mutate(selected.map(item => item.id))}
            className="min-h-11 rounded-xl border border-amber-400 px-3 font-bold focus-visible:ring-2 focus-visible:ring-amber-500">
            پاک‌کردن موارد نامعتبر
          </button>
        </div>
      )}
      {loading && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">در حال دریافت درس‌های چارت…</p>}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <h4 className="mb-3 text-sm font-bold">درس‌های قابل افزودن به سبد</h4>
          <label className="mb-3 flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} aria-label="جست‌وجوی درس برای سبد"
              placeholder="جست‌وجوی نام یا کد درس" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto">
            {available.map(c => {
              const rec = recByCourse.get(c.id);
              return <div key={c.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-100 p-2.5 dark:border-slate-800">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold" title={c.name}>{c.name}</div>
                  <div className="text-[11px] leading-6 text-slate-500 dark:text-slate-400">
                    {c.units.toLocaleString('fa-IR')} واحد · {c.code}
                    {rec ? ' · پیشنهاد هوشمند: ' + (rec.priority === 'HIGH' ? 'اولویت بالا' : rec.priority === 'MEDIUM' ? 'اولویت متوسط' : 'اولویت عادی') : ''}
                    {!offered.has(c.id) ? ' · گروه ارائه‌شده یافت نشد' : ''}
                    {(rec?.choiceOnlyFutureCoursesCount ?? c.choiceOnlyFutureCoursesCount) ? ' · ' + (rec?.choiceOnlyFutureCoursesCount ?? c.choiceOnlyFutureCoursesCount ?? 0).toLocaleString('fa-IR') + ' درس در مسیر احتمالی «یا»' : ''}
                    {(rec?.noChoiceFutureCoursesCount ?? c.noChoiceFutureCoursesCount) ? ' · ' + (rec?.noChoiceFutureCoursesCount ?? c.noChoiceFutureCoursesCount ?? 0).toLocaleString('fa-IR') + ' درس در مسیر بدون «یا»' : ''}
                    {!c.graduationAnalysisValid ? ' · تحلیل زنجیره نیازمند بازبینی چارت' : ''}
                  </div>
                  {rec?.reasons?.length ? <p className="mt-1 text-[11px] leading-5 text-indigo-700 dark:text-indigo-300">{rec.reasons.slice(0,2).join('؛ ')}</p> :
                    c.graduationAnalysisValid && (c.noChoiceFutureCoursesCount || c.choiceOnlyFutureCoursesCount) ?
                      <p className="mt-1 text-[11px] leading-5 text-indigo-700 dark:text-indigo-300">
                        تحلیل زنجیرهٔ باقی‌مانده تا پایان چارت؛ صرفاً برای برنامه‌ریزی آینده است و به معنی مجاز بودن اخذ این درس نیست.
                      </p> : null}
                </div>
                <button type="button" disabled={saving || loading} onClick={() => void mutate([...wishlistCourseIds, c.id])}
                  aria-label={'افزودن ' + c.name + ' به سبد'}
                  className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50"><Plus className="h-5 w-5" aria-hidden="true" /></button>
              </div>;
            })}
            {!loading && !available.length && <p className="p-4 text-xs text-slate-500">درسی با این نام پیدا نشد یا همه به سبد افزوده شده‌اند.</p>}
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-indigo-200 bg-white p-3 dark:border-indigo-900 dark:bg-slate-900">
          <h4 className="mb-3 text-sm font-bold">ترتیب علاقه‌مندی‌ها</h4>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto">
            {selected.map((c, index) => (
              <div key={c.id} className="flex min-w-0 items-center gap-2 rounded-xl bg-indigo-50/70 p-2.5 dark:bg-indigo-950/30">
                <span className="w-5 shrink-0 text-xs font-bold text-indigo-700 dark:text-indigo-300">{(index + 1).toLocaleString('fa-IR')}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold" title={c.name}>{c.name}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">{c.units.toLocaleString('fa-IR')} واحد</div>
                  {recByCourse.get(c.id) && <details className="mt-1 text-[11px] leading-6 text-indigo-800 dark:text-indigo-200">
                    <summary className="min-h-8 cursor-pointer rounded-md font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                      علت پیشنهاد این درس در مسیر فارغ‌التحصیلی
                    </summary>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">
                      {recByCourse.get(c.id)!.reasons.join('؛ ')}
                    </p>
                  </details>}
                </div>
                <button type="button" disabled={saving || index === 0} aria-label={'بالابردن اولویت ' + c.name}
                  onClick={() => { const ids = [...wishlistCourseIds]; [ids[index-1], ids[index]] = [ids[index], ids[index-1]]; void mutate(ids); }}
                  className="grid min-h-11 min-w-9 place-items-center rounded-lg hover:bg-white disabled:opacity-30 dark:hover:bg-slate-800"><ArrowUp size={17} /></button>
                <button type="button" disabled={saving || index === selected.length - 1} aria-label={'پایین‌بردن اولویت ' + c.name}
                  onClick={() => { const ids = [...wishlistCourseIds]; [ids[index], ids[index+1]] = [ids[index+1], ids[index]]; void mutate(ids); }}
                  className="grid min-h-11 min-w-9 place-items-center rounded-lg hover:bg-white disabled:opacity-30 dark:hover:bg-slate-800"><ArrowDown size={17} /></button>
                <button type="button" disabled={saving} aria-label={'حذف ' + c.name + ' از سبد'}
                  onClick={() => void mutate(wishlistCourseIds.filter(id => id !== c.id))}
                  className="grid min-h-11 min-w-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:hover:bg-rose-950/40"><Trash2 size={17} /></button>
              </div>
            ))}
            {!selected.length && <p className="p-4 text-xs leading-7 text-slate-500">هنوز درسی اضافه نکرده‌ای. از فهرست کناری شروع کن؛ این کار هیچ درسی را در آموزشیار ثبت نمی‌کند.</p>}
          </div>
        </div>
      </div>
    </section>
  );
};
