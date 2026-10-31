import React, { useEffect, useMemo, useState } from 'react';
import { Check, GitBranch, Link2, MousePointer2, RotateCcw, RotateCw, Search, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import type { AcademicRule, Course, Curriculum } from '../types';
import { apiRequest } from '../utils/api';
import { analyzeCurriculumDependencies, type DependencyEdge } from '../domain/course-dependency-insights';
import { assessDependencyDraft, findRemovableDirectDependency, type VisualRelationship } from '../domain/dependency-editor';
import { freshConnectionHistory, recordConnectionDraft, undoConnectionDraft, redoConnectionDraft, previewDependencyImpact } from '../domain/dependency-draft-history';
import { layoutDependencyGraph, NODE_WIDTH, NODE_HEIGHT, COLUMN_WIDTH } from '../domain/dependency-graph-layout';

interface RuleHistoryEntry {
  id: string;
  kind: 'ADD' | 'DELETE';
  at: string;
  ruleId: string;
  sourceCourseId: string | null;
  targetCourseId: string;
  relationshipType: string;
  revertedEventId: string | null;
  canRevert: boolean;
}
interface RuleHistorySnapshot {
  revision: string;
  entries: RuleHistoryEntry[];
}

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
  const [draftHistory, setDraftHistory] = useState(freshConnectionHistory);
  const { sourceId, targetId, kind } = draftHistory.present;
  const reviseDraft = (next: { sourceId: string; targetId: string; kind: VisualRelationship }) => {
    setDraftHistory(current => recordConnectionDraft(current, next));
  };
  const resetDraft = () => setDraftHistory(freshConnectionHistory(kind));
  const [search, setSearch] = useState('');
  const [zoom, setZoom] = useState(1);
  const [layoutMode, setLayoutMode] = useState<'chain' | 'semester'>('chain');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedExisting, setSelectedExisting] = useState<DependencyEdge | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [historySnapshot, setHistorySnapshot] = useState<{ chartId: string; data: RuleHistorySnapshot } | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [revertConfirm, setRevertConfirm] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!curricula.some(chart => chart.id === curriculumId)) {
      setCurriculumId(curricula[0]?.id ?? '');
    }
  }, [curricula, curriculumId]);

  useEffect(() => {
    setDraftHistory(freshConnectionHistory());
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

  useEffect(() => {
    let active = true;
    setHistorySnapshot(null);
    setHistoryError('');
    setRevertConfirm(false);
    if (!curriculumId) return;
    apiRequest<RuleHistorySnapshot>('/api/curriculum/rules/history/' + encodeURIComponent(curriculumId))
      .then(response => {
        if (!active) return;
        if (response.success && response.data &&
          /^[a-f0-9]{64}$/.test(response.data.revision) && Array.isArray(response.data.entries)) {
          setHistorySnapshot({ chartId: curriculumId, data: response.data });
        } else {
          setHistoryError(response.error || 'نسخهٔ قابل‌اعتماد قوانین دریافت نشد؛ عملیات گراف موقتاً قفل است.');
        }
      })
      .catch(() => { if (active) setHistoryError('ارتباط برای دریافت تاریخچه برقرار نشد.'); });
    return () => { active = false; };
  }, [curriculumId, rules, historyRefresh]);

  const refreshGraph = async () => {
    if (saving || refreshing) return;
    setRefreshing(true);
    setHistorySnapshot(null);
    try {
      await onChanged();
      setHistoryRefresh(previous => previous + 1);
      setFeedback('داده‌های چارت و تاریخچه دوباره دریافت شدند.');
    } catch {
      setFeedback('تازه‌سازی کامل نشد؛ لطفاً دوباره تلاش کنید.');
    } finally {
      setRefreshing(false);
    }
  };

  const revision = historySnapshot?.chartId === curriculumId ? historySnapshot.data.revision : null;
  const recentChanges = revision ? historySnapshot?.data.entries ?? [] : [];
  const latestChange = recentChanges[0] ?? null;
  const canRevert = !!latestChange?.canRevert && !!revision && loadedId === curriculumId;

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
  const addImpact = useMemo(() => sourceId && targetId && assessment.valid && loadedId === curriculumId
    ? previewDependencyImpact(curriculumId, courseIds, rules, { direction: 'add', sourceId, targetId, kind })
    : null, [curriculumId, courseIds, rules, sourceId, targetId, kind, assessment.valid, loadedId]);
  const removeImpact = useMemo(() => selectedRule && loadedId === curriculumId
    ? previewDependencyImpact(curriculumId, courseIds, rules, { direction: 'remove', ruleId: selectedRule.id })
    : null, [curriculumId, courseIds, rules, selectedRule?.id, loadedId]);

  const layout = useMemo(
    () => layoutDependencyGraph(verified, courseMap, analysis, layoutMode),
    [verified, courseMap, analysis, layoutMode],
  );

  const nameOf = (id: string) => courseMap.get(id)?.name ?? 'درس نامشخص';
  const choose = (id: string) => {
    if (saving) return;
    setFeedback('');
    setSelectedExisting(null);
    setDeleteConfirm(false);
    if (!sourceId || targetId) {
      reviseDraft({ sourceId: id, targetId: '', kind });
    } else if (sourceId !== id) {
      reviseDraft({ sourceId, targetId: id, kind });
    }
  };

  const selectExistingEdge = (edge: DependencyEdge) => {
    setSelectedExisting(edge);
    reviseDraft({ sourceId: '', targetId: '', kind });
    setDeleteConfirm(false);
    setFeedback('');
  };

  const removeSelectedLink = async () => {
    if (!selectedRule || saving || !revision || loadedId !== curriculumId) return;
    setSaving(true);
    setFeedback('');
    try {
      const response = await apiRequest('/api/curriculum/rules/' + encodeURIComponent(selectedRule.id), {
        method: 'DELETE', headers: { 'If-Match': revision },
      });
      if (!response.success) {
        setFeedback(response.error || 'اتصال حذف نشد.');
        return;
      }
      setHistorySnapshot(null);
      try {
        await onChanged();
        setSelectedExisting(null);
        setDeleteConfirm(false);
        setFeedback('اتصال از چارت حذف شد؛ وابستگی‌های باقی‌مانده به‌روزرسانی شدند.');
      } catch {
        setFeedback('حذف روی سرور انجام شد، اما نقشه تازه نشد. صفحه را بارگذاری مجدد کنید.');
      }
    } catch {
      setFeedback('ارتباط با سرور برقرار نشد؛ حذف اتصال تأیید نشده است.');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (saving || !revision || !assessment.valid || loadedId !== curriculumId) return;
    setSaving(true);
    setFeedback('');
    try {
      const response = await apiRequest('/api/curriculum/rules', {
        method: 'POST', headers: { 'If-Match': revision },
        body: JSON.stringify({
          curriculumId, targetCourseId: targetId, relationshipType: kind,
          expression: { type: 'COURSE', courseId: sourceId },
        }),
      });
      if (!response.success) {
        setFeedback(response.error || 'اتصال ذخیره نشد. لطفاً دوباره تلاش کنید.');
        return;
      }
      setHistorySnapshot(null);
      try {
        await onChanged();
        setFeedback('اتصال با موفقیت ثبت شد و نقشه به‌روزرسانی شد.');
        resetDraft();
      } catch {
        setFeedback('اتصال ثبت شد، اما نوسازی نقشه موفق نبود. صفحه را تازه‌سازی کنید.');
      }
    } catch {
      setFeedback('ارتباط قطع شد؛ اتصال هنوز ثبت‌شده تلقی نمی‌شود.');
    } finally {
      setSaving(false);
    }
  };

  const revertLastPersisted = async () => {
    if (!canRevert || !revertConfirm || saving || !latestChange || !revision) return;
    setSaving(true);
    setFeedback('');
    try {
      const response = await apiRequest('/api/curriculum/rules/history/' +
        encodeURIComponent(curriculumId) + '/revert', {
        method: 'POST',
        body: JSON.stringify({ eventId: latestChange.id, expectedRevision: revision }),
      });
      if (!response.success) {
        setFeedback(response.error || 'بازگردانی انجام نشد. تاریخچه را تازه‌سازی کنید.');
        return;
      }
      setHistorySnapshot(null);
      setSelectedExisting(null);
      resetDraft();
      try {
        await onChanged();
        setFeedback('آخرین تغییر ثبت‌شده به شکل امن بازگردانده شد؛ عملیات در تاریخچه ثبت شد.');
      } catch {
        setFeedback('بازگردانی در سرور انجام شد، ولی نقشه تازه نشد؛ از «تازه‌سازی قوانین» استفاده کنید.');
      }
    } catch {
      setFeedback('بازگردانی تأیید نشده است؛ تاریخچه را دوباره دریافت کنید.');
    } finally {
      setSaving(false);
      setRevertConfirm(false);
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
          <select aria-label="انتخاب چارت برای ویرایش گرافیکی" disabled={saving} value={curriculumId}
            onChange={event => setCurriculumId(event.target.value)}
            className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            {!curricula.length && <option value="">چارتي موجود نیست</option>}
            {curricula.map(chart => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200">
          نوع اتصال
          <select aria-label="نوع رابطهٔ جدید" disabled={saving} value={kind}
            onChange={event => { reviseDraft({ sourceId, targetId, kind: event.target.value as VisualRelationship }); setFeedback(''); }}
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

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-2.5 dark:border-indigo-900 dark:bg-indigo-950/30">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-indigo-950 dark:text-indigo-100">چینش نقشه</p>
          <p className="mt-1 text-[11px] leading-6 text-indigo-800 dark:text-indigo-200">
            {layout.chainModeActive ? 'درس‌ها بر اساس سطح وابستگی در کل دوره مرتب شده‌اند؛ مسیرهای چندمرحله‌ای از راست به چپ نمایان هستند.' :
              'چیدمان بر اساس ترم پیشنهادی چارت است؛ فلش‌ها همچنان روابط واقعی‌اند.'}
            {!analysis.valid && layoutMode === 'chain' && ' به دلیل خطای زنجیره، نمای ترمی جایگزین شده است.'}
          </p>
        </div>
        <div className="inline-flex shrink-0 rounded-xl border border-indigo-200 bg-white p-1 dark:border-indigo-900 dark:bg-slate-900" role="group" aria-label="شیوهٔ چینش نقشهٔ پیش‌نیاز">
          <button type="button" aria-pressed={layoutMode === 'chain'} onClick={() => setLayoutMode('chain')}
            className={`min-h-11 rounded-lg px-3 text-xs font-bold transition-colors ${layoutMode === 'chain' ? 'bg-indigo-700 text-white' : 'text-indigo-800 dark:text-indigo-200'}`}>
            زنجیره
          </button>
          <button type="button" aria-pressed={layoutMode === 'semester'} onClick={() => setLayoutMode('semester')}
            className={`min-h-11 rounded-lg px-3 text-xs font-bold transition-colors ${layoutMode === 'semester' ? 'bg-indigo-700 text-white' : 'text-indigo-800 dark:text-indigo-200'}`}>
            ترم چارت
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
          تاریخچهٔ انتخاب و اتصالِ <strong>ذخیره‌نشده</strong> · بازگشت به انتخاب قبلی هیچ قانون ثبت‌شده‌ای را تغییر نمی‌دهد.
        </p>
        <div className="flex shrink-0 items-center gap-2" role="group" aria-label="تاریخچهٔ پیش‌نویس گراف">
          <button type="button" disabled={saving || !draftHistory.past.length}
            onClick={() => { setDraftHistory(undoConnectionDraft); setFeedback(''); setSelectedExisting(null); setDeleteConfirm(false); }}
            aria-label="بازگشت تغییر پیش‌نویس" title="Undo · پیش‌نویس"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">
            <RotateCcw size={16} aria-hidden="true" /> بازگشت
          </button>
          <button type="button" disabled={saving || !draftHistory.future.length}
            onClick={() => { setDraftHistory(redoConnectionDraft); setFeedback(''); setSelectedExisting(null); setDeleteConfirm(false); }}
            aria-label="انجام دوبارهٔ تغییر پیش‌نویس" title="Redo · پیش‌نویس"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200">
            <RotateCw size={16} aria-hidden="true" /> انجام دوباره
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
        <span>{selectedChart?.name ?? 'انتخاب چارت'} · {courseIds.length.toLocaleString('fa-IR')} درس · {analysis.edges.length.toLocaleString('fa-IR')} اتصال</span>
        <span>همهٔ درس‌های چارت، از ترم نخست تا پایان دوره</span>
      </div>

      {loading && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">در حال بارگیری درس‌های چارت…</p>}
      {fetchError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{fetchError}</p>}
      {historyError && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold leading-7 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        {historyError}
      </p>
      <div className="flex items-center justify-end">
        <button type="button" disabled={saving || refreshing} onClick={() => void refreshGraph()}
          aria-label="تازه‌سازی قوانین و تاریخچهٔ این چارت"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <RotateCw size={16} aria-hidden="true" /> {refreshing ? 'در حال دریافت…' : 'تازه‌سازی قوانین'}
        </button>
      </div>}
      {!loading && loadedId === curriculumId && courseIds.length > 0 && !analysis.valid &&
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold leading-7 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          زنجیرهٔ چارت معتبر نیست؛ تا اصلاح خطاهای زیر، رتبهٔ اهمیت درس‌ها نمایش داده نمی‌شود: {analysis.errors.join(' ')}
        </p>}
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
                          {(layout.chainModeActive ? 'سطح زنجیرهٔ ' : 'ترم پیشنهادی ') + term.toLocaleString('fa-IR')}
                        </text>
                      </g>;
                    })}
                    {analysis.edges.map(edge => {
                      const from = layout.positions.get(edge.from);
                      const to = layout.positions.get(edge.to);
                      if (!from || !to) return null;
                      const fromX = from.x;
                      const toX = to.x + NODE_WIDTH;
                      const bend = -28;
                      const d = 'M' + fromX + ' ' + (from.y + NODE_HEIGHT / 2) +
                        ' C' + (fromX + bend) + ' ' + (from.y + NODE_HEIGHT / 2) +
                        ' ' + (toX - bend) + ' ' + (to.y + NODE_HEIGHT / 2) +
                        ' ' + toX + ' ' + (to.y + NODE_HEIGHT / 2);
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
                      d={'M' + start.x + ' ' + (start.y + NODE_HEIGHT / 2) +
                        ' L' + (end.x + NODE_WIDTH) + ' ' + (end.y + NODE_HEIGHT / 2)}
                      stroke={assessment.valid ? '#059669' : '#e11d48'} strokeWidth={3} strokeDasharray="7 5" fill="none" />}
                  </svg>
                  {[...layout.positions].map(([id, point]) => {
                    const course = courseMap.get(id);
                    const highlight = !filter || (course?.name ?? '').toLocaleLowerCase('fa').includes(filter) ||
                      (course?.code ?? '').toLocaleLowerCase('fa').includes(filter);
                    const picked = sourceId === id || targetId === id;
                    const insight = insights.get(id);
                    return <button key={id} type="button" disabled={saving} draggable={!saving}
                      aria-label={(course?.name ?? 'درس نامشخص') + '؛ انتخاب برای اتصال'}
                      aria-pressed={picked}
                      title={(course?.name ?? '') + ' (' + (course?.code ?? '') + ')'}
                      onClick={() => choose(id)}
                      onDragStart={event => { event.dataTransfer.setData('text/plain', id); reviseDraft({ sourceId: id, targetId: '', kind }); setSelectedExisting(null); setDeleteConfirm(false); }}
                      onDragOver={event => { if (!saving) event.preventDefault(); }}
                      onDrop={event => {
                        event.preventDefault();
                        const from = event.dataTransfer.getData('text/plain');
                        if (!saving && memberIds.has(from) && from !== id) {
                          reviseDraft({ sourceId: from, targetId: id, kind });
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
                        {course?.code ?? 'بدون کد'} · {analysis.valid && insight
                          ? `${insight.downstreamCount.toLocaleString('fa-IR')} درس پایین‌دستی · عمق ${insight.longestChain.toLocaleString('fa-IR')}`
                          : 'اهمیت نیازمند بازبینی چارت'}
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
                  return <div role="listitem" key={edge.kind + edge.from + edge.to}>
                    <button type="button" aria-pressed={selected} onClick={() => selectExistingEdge(edge)}
                    className={'min-h-11 w-full rounded-xl border px-3 py-2 text-right text-xs leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ' +
                      (selected ? 'border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200' :
                        'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200')}>
                    {nameOf(edge.from)} — {edge.kind === 'PREREQUISITE' ? 'پیش‌نیازِ' : 'هم‌نیازِ'} — {nameOf(edge.to)}
                    </button>
                  </div>;
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
              {removeImpact?.valid && <p className="text-xs font-bold leading-7 text-amber-950 dark:text-amber-100">
                پیش‌نمایش حذف: اثر زنجیره‌ای ${removeImpact.impacted.length.toLocaleString('fa-IR')} درس تغییر خواهد کرد.
                این فقط یک برآورد ساختاری است؛ حذف واقعی پس از تأیید جداگانه انجام می‌شود.
              </p>}

                  {!deleteConfirm ? (
                    <button type="button" disabled={saving || !revision} onClick={() => setDeleteConfirm(true)}
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
                        <button type="button" disabled={saving || !revision} onClick={() => void removeSelectedLink()}
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

          {addImpact?.valid && (
            <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-7 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
              <strong>پیش‌نمایش اثر این اتصال روی کل چارت:</strong>
              {addImpact.impacted.length
                ? ` مسیر ${addImpact.impacted.length.toLocaleString('fa-IR')} درس تغییر می‌کند.`
                : ' تعداد درس‌های پایین‌دستی و عمق زنجیره تغییری نمی‌کند.'}
              {kind === 'COREQUISITE' && ' هم‌نیاز در اولویت زنجیرهٔ پیش‌نیاز امتیاز اضافه نمی‌کند.'}
              {analysis.hasChoices && ' برخی روابط چارت شرط «یا» دارند؛ مسیرهای احتمالی، مجوز یا الزام قطعی نیستند.'}
              {addImpact.impacted.length > 0 && <div className="mt-2 grid max-h-36 gap-1 overflow-y-auto sm:grid-cols-2">
                {addImpact.impacted.slice(0, 8).map(item => <span key={item.courseId}>
                  {nameOf(item.courseId)}: ${item.beforeCount.toLocaleString('fa-IR')} ← ${item.afterCount.toLocaleString('fa-IR')} درس آینده · عمق ${item.beforeDepth.toLocaleString('fa-IR')} ← ${item.afterDepth.toLocaleString('fa-IR')}
                </span>)}
                {addImpact.impacted.length > 8 && <span>و ${(addImpact.impacted.length - 8).toLocaleString('fa-IR')} درس دیگر…</span>}
              </div>}
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
              <button type="button" disabled={saving || (!sourceId && !targetId)} onClick={() => { reviseDraft({ sourceId: '', targetId: '', kind }); setFeedback(''); }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
                <RotateCcw size={16} aria-hidden="true" /> پاک‌کردن انتخاب
              </button>
              <button type="button" onClick={save} disabled={!pending || !assessment.valid || saving || !revision}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-indigo-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                <Check size={16} aria-hidden="true" /> {saving ? 'در حال ثبت…' : 'ثبت اتصال'}
              </button>
            </div>
          </div>
          <details className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-extrabold text-slate-900 dark:text-white">
              تاریخچهٔ تغییرات ثبت‌شدهٔ چارت
              <span className="mr-2 text-xs font-normal text-slate-500 dark:text-slate-400">بازگردانی مشروط و ثبت‌شده</span>
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs leading-7 text-slate-600 dark:text-slate-300">
                فقط آخرین تغییر بدون تداخل با مدیران دیگر قابل بازگردانی است. هر بازگردانی در سرور ثبت می‌شود و می‌توان آن را دوباره انجام داد.
              </p>
              {!revision && <p role="status" className="text-xs text-amber-700">در حال دریافت نسخهٔ قوانین یا نیازمند تازه‌سازی…</p>}
              {recentChanges.length === 0 && revision && <p className="text-xs text-slate-500">تغییر ثبت‌شده‌ای برای نمایش وجود ندارد.</p>}
              <ol className="max-h-48 space-y-1 overflow-y-auto text-xs leading-7">
                {recentChanges.slice(0,10).map(entry => <li key={entry.id}
                  className="rounded-xl border border-slate-100 p-2 dark:border-slate-800">
                  {entry.revertedEventId ? 'بازگردانی' : entry.kind === 'ADD' ? 'افزودن' : 'حذف'}
                  {' · '}{entry.sourceCourseId ? nameOf(entry.sourceCourseId) + ' ← ' : ''}
                  {nameOf(entry.targetCourseId)}
                  {entry.canRevert && <span className="mr-2 font-bold text-emerald-700 dark:text-emerald-300">قابل بازگردانی</span>}
                </li>)}
              </ol>
              {canRevert && !revertConfirm && <button type="button" disabled={saving}
                onClick={() => setRevertConfirm(true)}
                className="min-h-11 rounded-xl border border-amber-300 px-3 text-xs font-extrabold text-amber-900 dark:border-amber-900 dark:text-amber-200">
                {latestChange?.revertedEventId ? 'انجام دوبارهٔ تغییر ثبت‌شده' : 'بازگردانی آخرین تغییر ثبت‌شده'}
              </button>}
              {canRevert && revertConfirm && <div role="group" aria-label="تأیید بازگردانی تغییر ثبت‌شده"
                className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-xs font-bold leading-7 text-amber-950 dark:text-amber-100">
                  آیا آخرین تغییر این چارت بازگردانده شود؟ سرور دوباره نسخه و مجوز را کنترل می‌کند.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={saving} onClick={() => setRevertConfirm(false)}
                    className="min-h-11 rounded-xl border border-slate-300 px-3 text-xs font-bold dark:border-slate-700">انصراف</button>
                  <button type="button" disabled={saving} onClick={() => void revertLastPersisted()}
                    className="min-h-11 rounded-xl bg-amber-700 px-3 text-xs font-bold text-white disabled:opacity-50">
                    {saving ? 'در حال بازگردانی…' : 'تأیید بازگردانی'}
                  </button>
                </div>
              </div>}
            </div>
          </details>
          {feedback && <p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm leading-7 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">{feedback}</p>}
          {!analysis.valid && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{analysis.errors.join(' ')}</p>}
        </>
      )}
    </section>
  );
};
