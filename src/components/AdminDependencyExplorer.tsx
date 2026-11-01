import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, GitBranch, Search, Sparkles, Network, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../utils/api';
import type { AcademicRule, Course, Curriculum, CurriculumCourse } from '../types';
import { buildCourseDependencyGraph, rankCoursesByDependencyImpact } from '../domain/course-dependency-impact';

type FullChart = {
  curriculum: Curriculum;
  courses: Array<CurriculumCourse & { course?: Course }>;
  prerequisites: AcademicRule[];
  corequisites: AcademicRule[];
};
type Props = { curricula: Curriculum[]; courseCatalog: Course[] };

const number = (value: number) => new Intl.NumberFormat('fa-IR').format(value);

/**
 * Read-only, accessible first stage of the curriculum dependency graph editor.
 * A true drag/drop graph editor will use the same validated graph model and
 * server permission rules. No automatic change to academic eligibility occurs.
 */
export const AdminDependencyExplorer: React.FC<Props> = ({ curricula, courseCatalog }) => {
  const [chartId, setChartId] = useState('');
  const [chart, setChart] = useState<FullChart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [focusId, setFocusId] = useState('');

  useEffect(() => {
    if (!curricula.length) return;
    if (!chartId || !curricula.some(item => item.id === chartId)) setChartId(curricula[0].id);
  }, [curricula, chartId]);

  useEffect(() => {
    if (!chartId) return;
    let alive = true;
    setLoading(true);
    setChart(null);
    setError('');
    void apiRequest<FullChart>(`/api/curriculum/${encodeURIComponent(chartId)}/full`).then(result => {
      if (!alive) return;
      if (result.success && result.data) setChart(result.data);
      else setError(result.error || 'دریافت چارت برای نمایش گراف امکان‌پذیر نیست.');
    }).catch(() => {
      if (alive) setError('اتصال به سرویس چارت برقرار نشد.');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [chartId]);

  const result = useMemo(() => {
    if (!chart || chart.curriculum.id !== chartId) return null;
    try {
      const graph = buildCourseDependencyGraph(chartId, chart.courses, [
        ...chart.prerequisites, ...chart.corequisites,
      ]);
      return { graph, ranked: rankCoursesByDependencyImpact(graph.courseIds, graph.links), error: '' };
    } catch {
      return { graph: null, ranked: [], error: 'در روابط این چارت خطا یا چرخهٔ پیش‌نیازی وجود دارد؛ قبل از رتبه‌بندی باید اصلاح شود.' };
    }
  }, [chart, chartId]);

  const coursesById = useMemo(() => {
    const names = new Map(courseCatalog.map(item => [item.id, item.name]));
    for (const item of chart?.courses || []) {
      names.set(item.courseId, item.course?.name || names.get(item.courseId) || item.courseId);
    }
    return names;
  }, [chart, courseCatalog]);
  const activeFocus = result?.ranked.some(item => item.courseId === focusId)
    ? focusId : (result?.ranked[0]?.courseId || '');
  const impact = result?.ranked.find(item => item.courseId === activeFocus);
  const inbound = result?.graph?.links.filter(link => link.target === activeFocus) || [];
  const outbound = result?.graph?.links.filter(link => link.source === activeFocus) || [];
  const visible = (result?.ranked || []).filter(item =>
    (coursesById.get(item.courseId) || item.courseId).toLocaleLowerCase('fa')
      .includes(query.trim().toLocaleLowerCase('fa'))).slice(0, 40);

  const relation = (source: string, kind: 'prerequisite'|'corequisite', conditional: boolean, key: string) => (
    <li key={key} className={`flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs leading-6 ${kind === 'corequisite'
      ? 'border-dashed border-amber-400 bg-amber-50/50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100'
      : 'border-solid border-blue-200 bg-blue-50/70 text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100'}`}>
      <span className="min-w-0 break-words font-bold">{coursesById.get(source) || source}</span>
      <span className="shrink-0 text-[10px] font-bold opacity-80">
        {kind === 'corequisite' ? 'هم‌نیاز ⋯' : conditional ? 'پیش‌نیاز انتخابی' : 'پیش‌نیاز ←'}
      </span>
    </li>
  );

  return (
    <section dir="rtl" aria-label="کاوشگر گراف پیش‌نیاز و هم‌نیاز"
      className="min-w-0 space-y-5 rounded-3xl border border-blue-200 bg-gradient-to-bl from-blue-50/80 via-white to-white p-4 shadow-sm sm:p-6 dark:border-blue-900 dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900">
      <div className="flex min-w-0 flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-lg font-black leading-8 text-slate-950 dark:text-white">
            <Network aria-hidden="true" className="h-5 w-5 text-blue-700 dark:text-blue-300" />
            نقشهٔ وابستگی درس‌ها
          </h3>
          <p className="mt-1 text-xs leading-7 text-slate-600 dark:text-slate-300">
            مسیر پیش‌نیازها را تا انتهای چارت دنبال کن؛ هر درس می‌تواند چندین درس بعدی را باز کند.
          </p>
        </div>
        <label className="block w-full min-w-0 md:max-w-sm">
          <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">چارت مورد بررسی</span>
          <select value={chartId} onChange={event => setChartId(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            {curricula.length === 0 && <option value="">چارتي ثبت نشده است</option>}
            {curricula.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>
      {loading && <p role="status" className="rounded-xl bg-white/90 p-4 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">در حال بارگذاری روابط چارت…</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
      {result?.error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200"><ShieldAlert className="mt-1 h-4 w-4 shrink-0" />{result.error}</p>}
      {result?.graph && <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-3">
          <p className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <Sparkles aria-hidden="true" className="h-4 w-4 text-indigo-600" />
            تأثیر درس‌ها در کل زنجیرهٔ چارت
          </p>
          <label className="relative block">
            <span className="sr-only">جست‌وجوی درس در گراف</span>
            <Search className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
            <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
              placeholder="جست‌وجوی نام درس…"
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </label>
          <div className="max-h-[410px] space-y-2 overflow-y-auto overscroll-contain rounded-xl p-0.5" role="list" aria-label="دروس بر اساس تأثیر در ادامهٔ تحصیل">
            {visible.map(row => <button type="button" role="listitem" key={row.courseId}
              onClick={()=>setFocusId(row.courseId)}
              aria-current={row.courseId===activeFocus?'true':undefined}
              className={`flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-right text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${row.courseId === activeFocus
                ? 'border-blue-500 bg-blue-100 text-blue-950 dark:border-blue-500 dark:bg-blue-950 dark:text-white'
                : 'border-slate-200 bg-white text-slate-800 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'}`}>
              <span className="min-w-0 truncate font-bold">{coursesById.get(row.courseId) || row.courseId}</span>
              <span className="shrink-0 rounded-lg bg-blue-50 px-2 py-1 text-xs font-extrabold text-blue-800 dark:bg-slate-800 dark:text-blue-200">{number(row.downstreamCourses)} درس بعدی</span>
            </button>)}
            {!visible.length && <p className="rounded-xl bg-white p-4 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">درسی با این نام یافت نشد.</p>}
          </div>
          {result.ranked.length > 40 && <p className="text-xs leading-6 text-slate-500">برای دیدن درس‌های دیگر نام آنها را جست‌وجو کن.</p>}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-indigo-200 bg-white/90 p-4 dark:border-indigo-900 dark:bg-slate-950/70">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-300">درس انتخاب‌شده</p>
            <h4 className="mt-2 break-words text-lg font-black text-slate-900 dark:text-white">{coursesById.get(activeFocus) || activeFocus}</h4>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/40"><span className="block text-slate-600 dark:text-slate-300">مستقیم</span><strong className="mt-1 block text-base text-blue-900 dark:text-blue-100">{number(impact?.directlyUnlocks || 0)}</strong></div>
              <div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950/40"><span className="block text-slate-600 dark:text-slate-300">تمام مسیرها</span><strong className="mt-1 block text-base text-indigo-900 dark:text-indigo-100">{number(impact?.downstreamCourses || 0)}</strong></div>
              <div className="col-span-2 rounded-xl bg-slate-50 p-3 sm:col-span-1 dark:bg-slate-900"><span className="block text-slate-600 dark:text-slate-300">بیشترین عمق زنجیره</span><strong className="mt-1 block text-base text-slate-900 dark:text-white">{number(impact?.longestChain || 0)}</strong></div>
            </div>
            {Boolean(impact?.conditionalDownstream) && <p className="mt-3 text-xs leading-6 text-amber-800 dark:text-amber-200">
              {number(impact?.conditionalDownstream || 0)} وابستگی از مسیرهای انتخابی «یکی از چند درس» است و قطعی محسوب نمی‌شود.
            </p>}
          </div>
          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            <section aria-label="درس‌های لازم پیش از درس انتخاب‌شده" className="min-w-0 rounded-2xl border border-slate-200 bg-white/75 p-3 dark:border-slate-800 dark:bg-slate-950/70">
              <h5 className="mb-3 flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200"><ArrowRight aria-hidden="true" className="h-4 w-4 text-blue-600" /> ورودی این درس</h5>
              <ul className="space-y-2">{inbound.map(link=>relation(link.source,link.kind,link.conditional,`${link.source}:${link.kind}`))}</ul>
              {!inbound.length && <p className="text-xs leading-6 text-slate-500">وابستگی ثبت‌شده‌ای ندارد.</p>}
            </section>
            <section aria-label="درس‌هایی که به درس انتخاب‌شده وابسته‌اند" className="min-w-0 rounded-2xl border border-slate-200 bg-white/75 p-3 dark:border-slate-800 dark:bg-slate-950/70">
              <h5 className="mb-3 flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-200"><ArrowLeft aria-hidden="true" className="h-4 w-4 text-indigo-600" /> خروجی این درس</h5>
              <ul className="space-y-2">{outbound.map(link=>relation(link.target,link.kind,link.conditional,`${link.target}:${link.kind}`))}</ul>
              {!outbound.length && <p className="text-xs leading-6 text-slate-500">درس مستقیم وابسته‌ای ثبت نشده است.</p>}
            </section>
          </div>
          <p className="flex items-start gap-2 text-xs leading-7 text-slate-500 dark:text-slate-300">
            <BookOpen aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
            خط پیوسته یعنی پیش‌نیاز؛ خط‌چین یعنی هم‌نیاز. این نقشه فعلاً خواندنی است؛ امتیاز تحلیلی هیچ مجوز اخذ درس صادر نمی‌کند.
          </p>
        </div>
      </div>}
      {!chartId && !loading && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">ابتدا یک چارت تحصیلی تعریف کن.</p>}
    </section>
  );
};
