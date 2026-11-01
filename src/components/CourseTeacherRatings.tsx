import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Star, RefreshCw } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { RATING_DIMENSIONS, type RatingScores, type TeacherRatingSummary } from '../domain/teacher-ratings';

const labels = {
  teachingClarity: 'شفافیت تدریس',
  courseOrganization: 'نظم کلاس',
  assessmentFairness: 'انصاف ارزیابی',
  studentSupport: 'پشتیبانی آموزشی',
} satisfies Record<(typeof RATING_DIMENSIONS)[number], string>;

const freshScores = (): RatingScores => ({
  teachingClarity: 3, courseOrganization: 3, assessmentFairness: 3, studentSupport: 3,
});

/** No real rating is collected here. Only the isolated browser demo supports PUT. */
export const CourseTeacherRatings: React.FC<{ courseId: string; instructors: string[] }> = ({ courseId, instructors }) => {
  const isDemo = useLocation().pathname.startsWith('/demo/');
  const [summaries, setSummaries] = useState<TeacherRatingSummary[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState(instructors[0] || '');
  const [scores, setScores] = useState<RatingScores>(freshScores);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const instructorsKey = [...new Set(instructors.filter(Boolean))].join('|');
  useEffect(() => {
    if (!isDemo) return;
    let active = true;
    setLoading(true);
    setError(null);
    setSelectedInstructor(instructors[0] || '');
    void apiRequest<TeacherRatingSummary[]>(`/api/demo/teacher-ratings?courseId=${encodeURIComponent(courseId)}`)
      .then(response => {
        if (!active) return;
        if (response.success && Array.isArray(response.data)) setSummaries(response.data);
        else setError(response.error || 'دریافت نتایج ارزشیابی آزمایشی ممکن نشد.');
      })
      .catch(() => { if (active) setError('دریافت ارزشیابی آزمایشی ممکن نشد.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId, isDemo, instructorsKey]);

  const submit = async () => {
    if (!selectedInstructor || !instructors.includes(selectedInstructor) || loading) return;
    setLoading(true);
    setSaved(false);
    setError(null);
    try {
      const response = await apiRequest<TeacherRatingSummary[]>('/api/demo/teacher-ratings', {
        method: 'PUT',
        body: JSON.stringify({ courseId, instructor: selectedInstructor, scores }),
      });
      if (response.success && Array.isArray(response.data)) {
        setSummaries(response.data);
        setSaved(true);
      } else {
        setError(response.error || 'امتیاز نمونه ذخیره نشد.');
      }
    } catch {
      setError('ذخیره امتیاز نمونه با خطا مواجه شد.');
    } finally { setLoading(false); }
  };

  return (
    <section aria-label="ارزشیابی عددی اساتید این درس" className="my-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
          <Star aria-hidden="true" className="h-4 w-4 text-amber-500" /> مقایسه عددی اساتید همین درس
        </h4>
        <span className="text-xs font-semibold text-blue-800 dark:text-blue-200">{isDemo ? 'داده ساختگی — دمو' : 'در انتظار فعال‌سازی امن'}</span>
      </div>
      {!isDemo ? (
        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
          رتبه‌بندی واقعی پس از احراز سوابق شرکت در کلاس و تأیید هویت استاد فعال می‌شود. در حال حاضر امتیازی نمایش یا دریافت نمی‌شود.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs leading-6 text-slate-600 dark:text-slate-300">رتبه‌ها فقط بین استادان همین درس محاسبه می‌شوند؛ در صورت کمتر از سه رأی نمونه، امتیاز عمومی مخفی است.</p>
          {loading && <p role="status" className="flex items-center gap-2 text-xs"><RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin" />در حال به‌روزرسانی…</p>}
          {error && <p role="alert" className="my-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
          {saved && <p role="status" className="my-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">امتیاز ساختگی شما در همین مرورگر ثبت شد.</p>}
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {summaries.map(item => (
              <div key={item.instructor} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2 text-sm font-bold">
                  <span className="min-w-0 break-words text-slate-900 dark:text-white">{item.instructor}</span>
                  <span className="shrink-0 text-blue-700 dark:text-blue-300">{item.rank !== null ? `رتبه ${item.rank}` : 'بدون رتبه'}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span>{item.average === null ? 'داده کافی نیست' : `${item.average.toFixed(2)} از ۵`}</span>
                  <span>{item.sampleSize} رأی نمونه</span>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <h5 className="mb-3 text-sm font-bold text-slate-800 dark:text-slate-100">امتیازدهی آزمایشی بدون نظر متنی</h5>
            <label className="mb-3 block text-xs font-bold text-slate-600 dark:text-slate-300">
              استاد
              <select aria-label="استاد مورد ارزیابی" value={selectedInstructor} onChange={event => { setSelectedInstructor(event.target.value); setSaved(false); }}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                {[...new Set(instructors.filter(Boolean))].map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {RATING_DIMENSIONS.map(dimension => (
                <label key={dimension} className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {labels[dimension]}
                  <select aria-label={labels[dimension]} value={scores[dimension]} onChange={event => { setScores(prev => ({ ...prev, [dimension]: Number(event.target.value) })); setSaved(false); }}
                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                    {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} از ۵</option>)}
                  </select>
                </label>
              ))}
            </div>
            <button type="button" disabled={loading || !selectedInstructor} onClick={() => void submit()}
              className="mt-4 min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">
              ثبت / اصلاح امتیاز نمونه
            </button>
          </div>
        </>
      )}
    </section>
  );
};
