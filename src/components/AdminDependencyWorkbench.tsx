import React, { useEffect, useMemo, useState } from 'react';
import { Check, GitBranch, Link2, MousePointer2, RotateCcw, Search, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import type { AcademicRule, Course, Curriculum } from '../types';
import { apiRequest } from '../utils/api';
import { analyzeCurriculumDependencies, type DependencyEdge } from '../domain/course-dependency-insights';
import { assessDependencyDraft, findRemovableDirectDependency, type VisualRelationship } from '../domain/dependency-editor';

interface ChartAssignment {
  courseId: string;
  suggestedSemester?: number;
}

interface Props {
  rules: AcademicRule[];
  courses: Course[];
  curricula: Curriculum[];
  onChanged: () => Promise<void>;
}

const NODE_WIDTH = 208;
const NODE_HEIGHT = 68;
const COLUMN_WIDTH = 252;
const ROW_HEIGHT = 88;

/**
 * Private admin workbench. Connect two actual curriculum courses either by
 * dragging a source node onto a target (desktop) or tapping both (touch/keyboard).
 * The final action is an explicit, permission-checked server save.
 */
export const AdminDependencyWorkbench: React.FC<Props> = ({ rules, courses, curricula, onChanged }) => {
  const [curriculumId, setCurriculumId] = useState('');
  const [assignments, setAssignments] = useState<ChartAssignment[]>([]);
  const [loadedId, setLoadedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [kind, setKind] = useState<VisualRelationship>('PREREQUISITE');
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedExisting, setSelectedExisting] = useState<DependencyEdge | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!curricula.some(chart => chart.id === curriculumId)) {
      setCurriculumId(curricula[0]?.id ?? '');
    }
  }, [curricula, curriculumId]);

  useEffect(() => {
    setSourceId('');
    setTargetId('');
    setFeedback('');
    setSelectedExisting(null);
    setDeleteConfirm(false);
    setAssignments([]);
    setLoadedId('');
    setFetchError('');
    if (!curriculumId) return;
    let active = true;
    setLoading(true);
    apiRequest<{ courses: ChartAssignment[] }>('/api/curriculum/' + encodeURIComponent(curriculumId) + '/full')
      .then(response => {
        if (!active) return;
        if (!response.success || !response.data || !Array.isArray(response.data.courses)) {
          setFetchError(response.error || 'دروس چارت دریافت نشدند.');
          return;
        }
        setAssignments(response.data.courses);
        setLoadedId(curriculumId);
      })
      .catch(() => { if (active) setFetchError('خطا در ارتباط با سرویس چارت.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [curriculumId]);

  const verified = loadedId === curriculumId ? assignments : [];
  const courseIds = useMemo(() => [...new Set(verified.map(row => row.courseId))], [verified]);
  const memberIds = useMemo(() => new Set(courseIds), [courseIds]);
  const courseMap = useMemo(() => new Map(courses.map(course => [course.id, course])), [courses]);
  const analysis = useMemo(
    () => analyzeCurriculumDependencies(curriculumId, courseIds, rules),
    [curriculumId, courseIds, rules],
  );
  const insights = useMemo(() => new Map(analysis.insights.map(item => [item.courseId, item])), [analysis]);
  const assessment = useMemo(() => assessDependencyDraft(
    curriculumId, courseIds, rules, sourceId, targetId, kind,
  ), [curriculumId, courseIds, rules, sourceId, targetId, kind]);
  const selectedRule = selectedExisting ? findRemovableDirectDependency(
    rules, curriculumId, selectedExisting.from, selectedExisting.to, selectedExisting.kind,
  ) : null;

  const layout = useMemo(() => {
    const terms = new Map<number, string[]>();
    for (const row of verified) {
      if (!courseMap.has(row.courseId)) continue;
      const term = Math.max(1, Math.min(16, Math.round(Number(row.suggestedSemester) || 1)));
      const list = terms.get(term) ?? [];
      if (!list.includes(row.courseId)) list.push(row.courseId);
      terms.set(term, list);
    }
    const positions = new Map<string, { x: number; y: number }>();
    const sortedTerms = [...terms.keys()].sort((a, b) => a - b);
    sortedTerms.forEach((term, column) => {
      (terms.get(term) ?? []).sort((a, b) =>
        (courseMap.get(a)?.name ?? '').localeCompare(courseMap.get(b)?.name ?? '', 'fa'))
        .forEach((id, row) => positions.set(id, {
          x: 24 + column * COLUMN_WIDTH,
          y: 64 + row * ROW_HEIGHT,
        }));
    });
    return {
      positions,
      width: Math.max(500, sortedTerms.length * COLUMN_WIDTH + 32),
      height: Math.max(220, 88 + Math.max(0, ...[...terms.values()].map(items => items.length)) * ROW_HEIGHT),
      terms,
      sortedTerms,
    };
  }, [verified, courseMap]);

  const nameOf = (id: string) => courseMap.get(id)?.name ?? 'درس نامشخص';
  const choose = (id: string) => {
    setFeedback('');
    setSelectedExisting(null);
    setDeleteConfirm(false);
    if (!sourceId || targetId) {
      setSourceId(id);
      setTargetId('');
    } else if (sourceId !== id) {
      setTargetId(id);
    }
  };

  const selectExistingEdge = (edge: DependencyEdge) => {
    setSelectedExisting(edge);
    setSourceId('');
    setTargetId('');
    setDeleteConfirm(false);
    setFeedback('');
  };

  const removeSelectedLink = async () => {
    if (!selectedRule || saving || loadedId !== curriculumId) return;
    setSaving(true);
    setFeedback('');
    const response = await apiRequest('/api/curriculum/rules/' + encodeURIComponent(selectedRule.id), { method: 'DELETE' });
    if (!response.success) {
      setFeedback(response.error || 'اتصال حذف نشد.');
      setSaving(false);
      return;
    }
    try {
      await onChanged();
      setSelectedExisting(null);
      setDeleteConfirm(false);
      setFeedback('اتصال از چارت حذف شد؛ وابستگی‌های باقی‌مانده به‌روزرسانی شدند.');
    } catch {
      setFeedback('حذف روی سرور انجام شد، اما نقشه تازه نشد. صفحه را بارگذاری مجدد کنید.');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (saving || !assessment.valid || loadedId !== curriculumId) return;
    setSaving(true);
    setFeedback('');
    const response = await apiRequest('/api/curriculum/rules', {
      method: 'POST',
      body: JSON.stringify({
        curriculumId,
        targetCourseId: targetId,
        relationshipType: kind,
        expression: { type: 'COURSE', courseId: sourceId },
      }),
    });
    if (!response.success) {
      setFeedback(response.error || 'اتصال ذخیره نشد. لطفاً دوباره تلاش کنید.');
      setSaving(false);
      return;
    }
    try {
      await onChanged();
      setFeedback('اتصال با موفقیت ثبت شد و نقشه به‌روزرسانی شد.');
      setSourceId('');
      setTargetId('');
    } catch {
      setFeedback('اتصال ثبت شد، اما نوسازی نقشه موفق نبود. صفحه را تازه‌سازی کنید.');
    } finally {
      setSaving(false);
    }
  };

  const selectedChart = curricula.find(chart => chart.id === curriculumId);
  const filter = search.trim().toLocaleLowerCase('fa');
  const pending = sourceId && targetId && layout.positions.has(sourceId) && layout.positions.has(targetId);
  const start = layout.positions.get(sourceId);
  const end = layout.positions.get(targetId);

  return (
    <section dir="rtl" aria-labelledby="visual-dependency-heading"
      className="min-w-0 space-y-4 rounded-3xl border border-indigo-200 bg-gradient-to-b from-indigo-50/70 to-white p-3 shadow-sm sm:p-6 dark:border-indigo-900 dark:from-indigo-950/40 dark:to-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="visual-dependency-heading" className="flex items-center gap-2 text-lg font-black text-slate-950 sm:text-xl dark:text-white">
            <GitBranch aria-hidden="true" className="h-5 w-5 text-indigo-600" /> کارگاه اتصال درس‌ها
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            درس پیش‌نیاز را به درس مقصد وصل کن. روی رایانه گرهٔ اول را روی گرهٔ دوم بکش؛ روی موبایل یا با صفحه‌کلید دو گره را به‌ترتیب انتخاب کن.
            فلش آبی پیش‌نیاز است و خط‌چین طلایی هم‌نیاز. تا پیش از زدن «ثبت اتصال» چیزی ذخیره نمی‌شود.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/80 px-3 py-2 text-xs font-semibold text-indigo-800 dark:bg-slate-800 dark:text-indigo-200">
          <MousePointer2 aria-hidden="true" className="h-4 w-4" /> ویژهٔ مدیران مجاز
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200">
          چارت تحصیلی
          <select aria-label="انتخاب چارت برای ویرایش گرافیکی" value={curriculumId}
            onChange={event => setCurriculumId(event.target.value)}
            className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            {!curricula.length && <option value="">چارتي موجود نیست</option>}
            {curricula.map(chart => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200">
          نوع اتصال
          <select aria-label="نوع رابطهٔ جدید" value={kind}
            onChange={event => { setKind(event.target.value as VisualRelationship); setFeedback(''); }}
            className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            <option value="PREREQUISITE">پیش‌نیاز · فلش پیوسته</option>
            <option value="COREQUISITE">هم‌نیاز · خط‌چین</option>
          </select>
        </label>
        <label className="min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200">
          پیدا کردن درس
          <span className="relative mt-1 block">
            <Search aria-hidden="true" className="absolute right-3 top-3 h-4 w-4 text-slate-500" />
            <input aria-label="جست‌وجوی درس در نقشه" value={search}
              onChange={event => setSearch(event.target.value)} placeholder="نام یا کد درس"
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </span>
        </label>
        <div className="flex items-end gap-2">
          <button type="button" aria-label="کوچک‌نمایی" onClick={() => setZoom(value => Math.max(.65, +(value - .15).toFixed(2)))}
            className="grid min-h-11 flex-1 place-items-center rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"><ZoomOut size={18} /></button>
          <span className="min-w-11 pb-3 text-center text-xs font-bold text-slate-600 dark:text-slate-300">{Math.round(zoom * 100)}٪</span>
          <button type="button" aria-label="بزرگ‌نمایی" onClick={() => setZoom(value => Math.min(1.4, +(value + .15).toFixed(2)))}
            className="grid min-h-11 flex-1 place-items-center rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"><ZoomIn size={18} /></button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
        <span>{selectedChart?.name ?? 'انتخاب چارت'} · {courseIds.length.toLocaleString('fa-IR')} درس · {analysis.edges.length.toLocaleString('fa-IR')} اتصال</span>
        <span>همهٔ درس‌های چارت، از ترم نخست تا پایان دوره</span>
      </div>

      {loading && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">در حال بارگیری درس‌های چارت…</p>}
      {fetchError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{fetchError}</p>}
      {!loading && !fetchError && loadedId === curriculumId && (
        <>
          {courseIds.length === 0 ? (
            <p className="rounded-xl bg-white p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-white">ابتدا درس‌ها را در بخش «چارت تحصیلی» به این چارت اضافه کن.</p>
          ) : (
            <div role="region" tabIndex={0} aria-label="محیط گرافیکی قابل اسکرول اتصال درس‌ها"
              className="max-h-[580px] min-w-0 overflow-auto rounded-2xl border border-indigo-200 bg-slate-50 shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 dark:border-indigo-900 dark:bg-slate-950">
              <div style={{ width: layout.width * zoom, height: layout.height * zoom }}>
                <div className="relative" style={{ width: layout.width, height: layout.height, transform: 'scale(' + zoom + ')', transformOrigin: 'top left' }}>
                  <svg aria-hidden="true" className="pointer-events-none absolute inset-0" width={layout.width} height={layout.height}>
                    <defs>
                      <marker id="visual-editor-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M0 0 L8 4 L0 8 Z" fill="#2563eb" />
                      </marker>
                    </defs>
                    {layout.sortedTerms.map(term => {
                      const column = layout.sortedTerms.indexOf(term);
                      return <g key={term}>
                        <rect x={12 + column * COLUMN_WIDTH} y={10} width={COLUMN_WIDTH - 8} height={layout.height - 24}
                          rx={16} fill={column % 2 ? '#e2e8f033' : '#c7d2fe24'} />
                        <text x={24 + column * COLUMN_WIDTH} y={36} fill="#64748b" fontSize={13} fontWeight={700}>
                          {'ترم پیشنهادی ' + term.toLocaleString('fa-IR')}
                        </text>
                      </g>;
                    })}
                    {analysis.edges.map(edge => {
                      const from = layout.positions.get(edge.from);
                      const to = layout.positions.get(edge.to);
                      if (!from || !to) return null;
                      const d = 'M' + (from.x + NODE_WIDTH) + ' ' + (from.y + NODE_HEIGHT / 2) +
                        ' C' + (from.x + NODE_WIDTH + 28) + ' ' + (from.y + NODE_HEIGHT / 2) +
                        ' ' + (to.x - 24) + ' ' + (to.y + NODE_HEIGHT / 2) +
                        ' ' + to.x + ' ' + (to.y + NODE_HEIGHT / 2);
                      const selected = selectedExisting?.from === edge.from &&
                        selectedExisting?.to === edge.to && selectedExisting?.kind === edge.kind;
                      return <React.Fragment key={edge.kind + edge.from + edge.to}>
                        <path d={d} fill="none"
                          stroke={edge.kind === 'PREREQUISITE' ? '#2563eb' : '#d97706'}
                          strokeWidth={selected ? 4 : 2} strokeOpacity={selected ? 1 : .7}
                          strokeDasharray={edge.kind === 'COREQUISITE' || edge.optional ? '6 5' : undefined}
                          markerEnd={edge.kind === 'PREREQUISITE' ? 'url(#visual-editor-arrow)' : undefined} />
                        <path d={d} fill="none" stroke="transparent" strokeWidth={18}
                          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                          onClick={() => selectExistingEdge(edge)} />
                      </React.Fragment>;
                    })}
                    {pending && start && end && <path
                      d={'M' + (start.x + NODE_WIDTH) + ' ' + (start.y + NODE_HEIGHT / 2) +
                        ' L' + end.x + ' ' + (end.y + NODE_HEIGHT / 2)}
                      stroke={assessment.valid ? '#059669' : '#e11d48'} strokeWidth={3} strokeDasharray="7 5" fill="none" />}
                  </svg>
                  {[...layout.positions].map(([id, point]) => {
                    const course = courseMap.get(id);
                    const highlight = !filter || (course?.name ?? '').toLocaleLowerCase('fa').includes(filter) ||
                      (course?.code ?? '').toLocaleLowerCase('fa').includes(filter);
                    const picked = sourceId === id || targetId === id;
                    const importance = insights.get(id)?.downstreamCount ?? 0;
                    return <button key={id} type="button" draggable={!saving}
                      aria-label={(course?.name ?? 'درس نامشخص') + '؛ انتخاب برای اتصال'}
                      aria-pressed={picked}
                      title={(course?.name ?? '') + ' (' + (course?.code ?? '') + ')'}
                      onClick={() => choose(id)}
                      onDragStart={event => { event.dataTransfer.setData('text/plain', id); setSourceId(id); setTargetId(''); setSelectedExisting(null); setDeleteConfirm(false); }}
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => {
                        event.preventDefault();
                        const from = event.dataTransfer.getData('text/plain');
                        if (memberIds.has(from) && from !== id) {
                          setSourceId(from);
                          setTargetId(id);
                          setFeedback('');
                        }
                      }}
                      style={{ position: 'absolute', left: point.x, top: point.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                      className={'flex flex-col justify-center gap-0.5 rounded-xl border-2 px-3 text-right shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400 ' +
                        (picked ? 'border-indigo-600 bg-indigo-100 text-indigo-950 dark:bg-indigo-900 dark:text-white ' :
                          'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white ') +
                        (!highlight ? 'opacity-25' : 'hover:border-indigo-400')}>
                      <span className="block w-full truncate text-xs font-extrabold">{course?.name ?? 'درس نامشخص'}</span>
                      <span className="block w-full truncate text-[11px] text-slate-500 dark:text-slate-300">
                        {course?.code ?? 'بدون کد'} · {importance.toLocaleString('fa-IR')} درس در ادامهٔ زنجیره
                      </span>
                    </button>;
                  })}
                </div>
              </div>
            </div>
          )}

          {analysis.edges.length > 0 && (
            <details className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-slate-800 dark:text-white">
                مدیریت اتصال‌های ثبت‌شده ({analysis.edges.length.toLocaleString('fa-IR')})
              </summary>
              <p className="mb-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                برای مشاهده یا حذف یک اتصال، روی خط داخل نقشه یا نام رابطه در این فهرست بزن.
              </p>
              <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2" role="list">
                {analysis.edges.filter(edge => !filter || [nameOf(edge.from), nameOf(edge.to)]
                  .some(name => name.toLocaleLowerCase('fa').includes(filter))).map(edge => {
                  const selected = selectedExisting?.kind === edge.kind &&
                    selectedExisting.from === edge.from && selectedExisting.to === edge.to;
                  return <button type="button" role="listitem" key={edge.kind + edge.from + edge.to}
                    aria-pressed={selected} onClick={() => selectExistingEdge(edge)}
                    className={'min-h-11 rounded-xl border px-3 py-2 text-right text-xs leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ' +
                      (selected ? 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200' :
                        'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200')}>
                    {nameOf(edge.from)} — {edge.kind === 'PREREQUISITE' ? 'پیش‌نیازِ' : 'هم‌نیازِ'} — {nameOf(edge.to)}
                  </button>;
                })}
              </div>
            </details>
          )}
          {selectedExisting && (
            <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
              <p className="font-extrabold leading-7 text-amber-950 dark:text-amber-100">
                {nameOf(selectedExisting.from)} — {selectedExisting.kind === 'PREREQUISITE' ? 'پیش‌نیازِ' : 'هم‌نیازِ'} — {nameOf(selectedExisting.to)}
              </p>
              {selectedRule ? (
                <>
                  {!deleteConfirm ? (
                    <button type="button" disabled={saving} onClick={() => setDeleteConfirm(true)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300 bg-white px-3 text-xs font-bold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300">
                      <Trash2 size={16} aria-hidden="true" /> حذف همین اتصال
                    </button>
                  ) : (
                    <div role="group" aria-label="تأیید حذف اتصال" className="space-y-2">
                      <p className="text-sm leading-7 text-rose-800 dark:text-rose-200">
                        این رابطه از قوانین چارت حذف شود؟ این عمل فقط همین قانون مستقل را پاک می‌کند.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={saving} onClick={() => setDeleteConfirm(false)}
                          className="min-h-11 rounded-xl border border-slate-300 px-4 text-xs font-bold dark:border-slate-600">انصراف</button>
                        <button type="button" disabled={saving} onClick={() => void removeSelectedLink()}
                          className="min-h-11 rounded-xl bg-rose-700 px-4 text-xs font-bold text-white disabled:opacity-50">
                          {saving ? 'در حال حذف…' : 'تأیید حذف اتصال'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p role="status" className="text-xs leading-7 text-amber-900 dark:text-amber-200">
                  این اتصال از قانون ترکیبی یا چند قانون مشترک آمده است؛ حذف آن از اینجا امن نیست. برای اصلاح از ویرایشگر پیشرفتهٔ قوانین استفاده کن.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-end dark:border-slate-700 dark:bg-slate-800">
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
                <Link2 aria-hidden="true" className="h-4 w-4" /> اتصال در انتظار تأیید
              </p>
              <p className="break-words text-sm leading-7 text-slate-700 dark:text-slate-200">
                {sourceId ? nameOf(sourceId) : 'درس پیش‌نیاز را انتخاب کن'}
                {'  ← ' + (kind === 'PREREQUISITE' ? 'پیش‌نیازِ' : 'هم‌نیازِ') + ' ←  '}
                {targetId ? nameOf(targetId) : 'درس مقصد را انتخاب کن'}
              </p>
              {pending && <p role="status" className={'text-xs leading-6 ' +
                (assessment.valid ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>
                {assessment.valid ? 'اتصال معتبر است و پس از تأیید ثبت می‌شود.' : assessment.error}
              </p>}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                قوانین ترکیبی «و/یا» و هم‌نیاز مشروط همچنان در ویرایشگر پیشرفتهٔ پایین صفحه مدیریت می‌شوند.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setSourceId(''); setTargetId(''); setFeedback(''); }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
                <RotateCcw size={16} aria-hidden="true" /> پاک‌کردن انتخاب
              </button>
              <button type="button" onClick={save} disabled={!pending || !assessment.valid || saving}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-indigo-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                <Check size={16} aria-hidden="true" /> {saving ? 'در حال ثبت…' : 'ثبت اتصال'}
              </button>
            </div>
          </div>
          {feedback && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm leading-7 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">{feedback}</p>}
          {!analysis.valid && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{analysis.errors.join(' ')}</p>}
        </>
      )}
    </section>
  );
};
