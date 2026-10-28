import React, { useEffect, useMemo, useState } from 'react';
import { GitBranch, Layers3, AlertTriangle, ArrowLeft, Info } from 'lucide-react';
import type { AcademicRule, Course, Curriculum } from '../types';
import { apiRequest } from '../utils/api';
import { analyzeCurriculumDependencies, type DependencyEdge } from '../domain/course-dependency-insights';

interface Props {
  rules: AcademicRule[];
  courses: Course[];
  curricula: Curriculum[];
}

export const AdminDependencyMap: React.FC<Props> = ({ rules, courses, curricula }) => {
  const [curriculumId, setCurriculumId] = useState('');
  const [assigned, setAssigned] = useState<string[]>([]);
  const [loadedChartId, setLoadedChartId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (!curricula.length) { setCurriculumId(''); return; }
    if (!curricula.some(curriculum => curriculum.id === curriculumId)) {
      setCurriculumId(curricula[0].id);
    }
  }, [curricula, curriculumId]);

  useEffect(() => {
    if (!curriculumId) { setAssigned([]); setLoadedChartId(''); return; }
    let alive = true;
    setAssigned([]);
    setLoadedChartId('');
    setLoading(true);
    setError('');
    setSelectedId('');
    apiRequest<{ courses: { courseId: string }[] }>(`/api/curriculum/${encodeURIComponent(curriculumId)}/full`)
      .then(response => {
        if (!alive) return;
        if (!response.success || !response.data || !Array.isArray(response.data.courses)) {
          setError(response.error || 'دروس چارت انتخابی دریافت نشدند.');
          return;
        }
        setAssigned(response.data.courses.map(row => row.courseId));
        setLoadedChartId(curriculumId);
      })
      .catch(() => { if (alive) setError('ارتباط با سرویس چارت برقرار نشد.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [curriculumId]);

  const courseNames = useMemo(() => new Map(courses.map(course => [course.id, course.name])), [courses]);
  // Never render another curriculum's previous response while selection changes.
  const verifiedAssigned = loadedChartId === curriculumId ? assigned : [];
  const analysis = useMemo(() => analyzeCurriculumDependencies(curriculumId, verifiedAssigned, rules),
    [curriculumId, loadedChartId, assigned, rules]);
  const ranking = analysis.insights;
  const connected = new Set(analysis.edges.flatMap(edge => [edge.from, edge.to]));
  const visibleIds = ranking.map(item => item.courseId).filter(id => connected.has(id)).slice(0, 36);
  const positions = new Map<string, { x: number; y: number }>();
  const columns = new Map<number, string[]>();
  for (const id of visibleIds) {
    const depth = ranking.find(item => item.courseId === id)?.depth ?? 0;
    const column = columns.get(depth) ?? [];
    column.push(id);
    columns.set(depth, column);
  }
  for (const [depth, column] of columns) {
    column.forEach((id, idx) => positions.set(id, { x: 24 + depth * 270, y: 35 + idx * 106 }));
  }
  const width = Math.max(420, 280 + Math.max(0, ...columns.keys()) * 270);
  const height = Math.max(180, 72 + Math.max(0, ...[...columns.values()].map(ids => ids.length)) * 106);
  const selected = ranking.find(item => item.courseId === selectedId);
  const label = (id: string) => courseNames.get(id) ?? 'درس نامشخص';
  const related = new Set(selectedId ? [selectedId, ...(selected?.downstreamIds ?? [])] : []);
  const visibleEdges = analysis.edges.filter(edge => positions.has(edge.from) && positions.has(edge.to));

  return (
    <section dir="rtl" aria-labelledby="dependency-map-heading" className="darschin-surface min-w-0 space-y-5 rounded-3xl border border-blue-200/70 bg-white p-3 shadow-sm sm:p-6 dark:border-blue-900/60 dark:bg-slate-900">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="dependency-map-heading" className="flex items-center gap-2 text-lg font-black text-slate-950 sm:text-xl dark:text-white">
            <GitBranch aria-hidden="true" className="h-5 w-5 shrink-0 text-blue-600" />
            نقشهٔ وابستگی درس‌ها
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            مسیرهای پیش‌نیاز تا پایان چارت را ببین؛ فلش پیوسته یعنی پیش‌نیاز و خط‌چین یعنی هم‌نیاز. این نسخه نمای تحلیلی است و ویرایش مستقیم اتصال‌ها هنوز فعال نشده.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
          <Layers3 aria-hidden="true" className="h-4 w-4" /> تحلیل کل دوره
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
          چارت موردنظر
          <select className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={curriculumId} onChange={event => setCurriculumId(event.target.value)} aria-label="انتخاب چارت نقشهٔ وابستگی">
            {curricula.length === 0 && <option value="">هیچ چارتی تعریف نشده</option>}
            {curricula.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="block min-w-0 text-sm font-semibold text-slate-700 dark:text-slate-200">
          بررسی مسیر یک درس
          <select className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            value={selectedId} onChange={event => setSelectedId(event.target.value)}
            disabled={!analysis.valid || !ranking.length} aria-label="انتخاب درس برای نمایش وابستگی‌های آینده">
            <option value="">همهٔ درس‌ها</option>
            {ranking.map(item => <option key={item.courseId} value={item.courseId}>{label(item.courseId)}</option>)}
          </select>
        </label>
      </div>

      {loading && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">در حال دریافت درس‌های همین چارت…</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
      {!loading && !error && !!curriculumId && (
        <>
          {!analysis.valid && <div role="alert" className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-7 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <AlertTriangle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0" />
            <div><strong>چارت نیاز به اصلاح دارد؛ رتبه‌بندی محاسبه نشد.</strong>
              <ul className="mt-1 list-inside list-disc">{analysis.errors.map(message => <li key={message}>{message}</li>)}</ul></div>
          </div>}
          {analysis.valid && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60"><strong className="block text-xl font-black tabular-nums text-slate-950 dark:text-white">{ranking.length.toLocaleString('fa-IR')}</strong><span className="text-xs text-slate-600 dark:text-slate-300">درس در چارت</span></div>
                <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60"><strong className="block text-xl font-black tabular-nums text-slate-950 dark:text-white">{analysis.edges.length.toLocaleString('fa-IR')}</strong><span className="text-xs text-slate-600 dark:text-slate-300">رابطهٔ ثبت‌شده</span></div>
                <div className="col-span-2 rounded-2xl bg-blue-50 p-3 sm:col-span-1 dark:bg-blue-950/50"><strong className="block text-xl font-black tabular-nums text-blue-800 dark:text-blue-300">{Math.max(0, ...ranking.map(item => item.longestChain)).toLocaleString('fa-IR')}</strong><span className="text-xs text-blue-700 dark:text-blue-200">طولانی‌ترین مسیر آینده</span></div>
              </div>

              {analysis.hasChoices && <p className="flex gap-2 text-xs leading-6 text-amber-700 dark:text-amber-300">
                <Info aria-hidden="true" className="h-4 w-4 shrink-0" />
                بعضی قوانین «یا» (OR) دارند؛ اتصال آن‌ها مسیر احتمالی است، نه پیش‌نیاز قطعی. این تحلیل مجوز اخذ درس صادر نمی‌کند.
              </p>}

              {selected && <p role="status" className="rounded-xl bg-blue-50 px-4 py-3 text-sm leading-7 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                <strong>{label(selected.courseId)}</strong> روی مسیر {selected.downstreamCount.toLocaleString('fa-IR')} درس آینده است؛ طولانی‌ترین زنجیرهٔ بعدی {selected.longestChain.toLocaleString('fa-IR')} اتصال دارد. اگر درسی در چند مسیر تکرار شود فقط یک‌بار شمرده می‌شود.
              </p>}

              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-8 bg-blue-600" /> فلش: پیش‌نیاز</span>
                  <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="w-8 border-t-2 border-dashed border-amber-500" /> خط‌چین: هم‌نیاز</span>
                  <span className="text-slate-500 dark:text-slate-400">نقشه فقط برای مشاهده و بررسی است</span>
                </div>
                <div role="region" aria-label="نقشهٔ قابل پیمایش افقی درس‌ها" tabIndex={0}
                  className="max-h-[480px] overflow-auto bg-slate-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:bg-slate-950/40">
                  {visibleIds.length === 0 ? (
                    <p className="p-6 text-sm leading-7 text-slate-600 dark:text-slate-300">برای این چارت هنوز پیش‌نیاز یا هم‌نیازی ثبت نشده است.</p>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
                      role="img" aria-label="نمای بصری ارتباط درس‌ها؛ جزئیات متنی در پایین نقشه موجود است" className="block max-w-none">
                      <defs><marker id="dependency-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                        <path d="M0,0 L7,3.5 L0,7 Z" fill="#2563eb" /></marker></defs>
                      {visibleEdges.map((edge: DependencyEdge) => {
                        const start = positions.get(edge.from)!;
                        const end = positions.get(edge.to)!;
                        const emphasized = !selectedId || related.has(edge.from) && related.has(edge.to);
                        return <path key={`${edge.kind}:${edge.from}:${edge.to}`}
                          d={`M ${start.x + 200} ${start.y + 33} C ${start.x + 220} ${start.y + 33}, ${end.x - 20} ${end.y + 33}, ${end.x} ${end.y + 33}`}
                          fill="none" stroke={edge.kind === 'COREQUISITE' ? '#d97706' : '#2563eb'}
                          strokeWidth={emphasized ? 2.5 : 1} strokeOpacity={emphasized ? 0.9 : 0.23}
                          strokeDasharray={edge.kind === 'COREQUISITE' || edge.optional ? '6 5' : undefined}
                          markerEnd={edge.kind === 'PREREQUISITE' ? 'url(#dependency-arrow)' : undefined} />;
                      })}
                      {visibleIds.map(id => {
                        const p = positions.get(id)!;
                        const metric = ranking.find(item => item.courseId === id)!;
                        const highlighted = !selectedId || related.has(id);
                        const name = label(id);
                        return <g key={id} opacity={highlighted ? 1 : 0.35}>
                          <title>{`${name}؛ ${metric.downstreamCount} درس آینده`}</title>
                          <rect x={p.x} y={p.y} width="200" height="66" rx="12" fill={id === selectedId ? '#dbeafe' : '#fff'}
                            stroke={id === selectedId ? '#2563eb' : '#cbd5e1'} strokeWidth={id === selectedId ? 2.5 : 1} />
                          <text x={p.x + 190} y={p.y + 26} textAnchor="end" direction="rtl"
                            fontFamily="Vazirmatn,Tahoma,sans-serif" fontSize="13" fontWeight="700" fill="#0f172a">
                            {name.length > 25 ? `${name.slice(0, 24)}…` : name}
                          </text>
                          <text x={p.x + 190} y={p.y + 49} textAnchor="end" direction="rtl"
                            fontFamily="Vazirmatn,Tahoma,sans-serif" fontSize="11" fill="#475569">
                            {metric.downstreamCount.toLocaleString('fa-IR')} درس بعدی
                          </text>
                        </g>;
                      })}
                    </svg>
                  )}
                </div>
              </div>

              {ranking.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-extrabold text-slate-900 dark:text-white">درس‌های اثرگذار در کل زنجیره</h4>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {ranking.slice(0, 6).map((item, idx) => (
                      <button type="button" key={item.courseId} onClick={() => setSelectedId(item.courseId)}
                        className="flex min-h-14 min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100 font-black text-blue-800 dark:bg-blue-950 dark:text-blue-200">{(idx + 1).toLocaleString('fa-IR')}</span>
                        <span className="min-w-0 flex-1"><strong className="block break-words text-slate-950 dark:text-white">{label(item.courseId)}</strong>
                          <small className="block text-slate-600 dark:text-slate-300">{item.downstreamCount.toLocaleString('fa-IR')} درس وابسته · عمق {item.longestChain.toLocaleString('fa-IR')}</small></span>
                        <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <details className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-slate-900 dark:text-white">فهرست متنی و قابل‌دسترسی رابطه‌ها</summary>
                <ul className="mt-2 space-y-2 text-sm leading-7 text-slate-700 dark:text-slate-300">
                  {analysis.edges.map(edge => <li key={`${edge.kind}-${edge.from}-${edge.to}`}>
                    {label(edge.from)} ← {edge.kind === 'PREREQUISITE' ? 'پیش‌نیاز' : 'هم‌نیاز'} {edge.optional ? '(در یکی از مسیرهای اختیاری)' : ''} ← {label(edge.to)}
                  </li>)}
                </ul>
              </details>
              {visibleIds.length < connected.size && <p className="text-xs leading-6 text-amber-700 dark:text-amber-300">
                برای روان‌ماندن نقشه، فقط {visibleIds.length.toLocaleString('fa-IR')} درس متصل نمایش داده شد؛ محاسبهٔ اهمیت برای کل چارت انجام شده است.
              </p>}
              <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">امتیاز اهمیت صرفاً از تعداد وابستگی‌های یکتا و طول زنجیره محاسبه می‌شود؛ هم‌نیازها وارد رتبهٔ پیش‌نیازی نمی‌شوند و تصمیم نهایی تابع مقررات و پروندهٔ دانشجوست.</p>
            </>
          )}
        </>
      )}
    </section>
  );
};
