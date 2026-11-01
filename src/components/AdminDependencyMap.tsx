import React, { useMemo, useState } from 'react';
import { ArrowLeft, GitBranch, Link2, Plus, ShieldAlert } from 'lucide-react';
import type { AcademicRule, Course, CurriculumCourse, RelationshipType } from '../types';
import { analyzeCurriculumDependencies, type DependencyLink } from '../domain/course-dependency-impact';
import { apiRequest } from '../utils/api';

type Assigned = CurriculumCourse & { course?: Course };
type Props = {
  curriculumId: string;
  assignments: Assigned[];
  rules: AcademicRule[];
  onUpdated: () => Promise<void> | void;
};

type Position = { x: number; y: number };
const BOX_W = 218;
const BOX_H = 92;
const COLUMN_W = 264;
const ROW_H = 115;

const numberFa = (n: number) => new Intl.NumberFormat('fa-IR').format(n);

/** First safe, two-dimensional iteration: connectors + course click pairing.
 * Keep the existing advanced expression editor for AND/OR rules.
 */
export const AdminDependencyMap: React.FC<Props> = ({
  curriculumId, assignments, rules, onUpdated,
}) => {
  const [source, setSource] = useState<string>('');
  const [target, setTarget] = useState<string>('');
  const [kind, setKind] = useState<'PREREQUISITE' | 'COREQUISITE'>('PREREQUISITE');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const courseMap = useMemo(() => new Map(
    assignments.filter(a => a.course).map(a => [a.courseId, a.course!]),
  ), [assignments]);
  const ids = useMemo(() => [...courseMap.keys()], [courseMap]);
  const analysis = useMemo(() => {
    try {
      return { data: analyzeCurriculumDependencies(curriculumId, ids, rules), error: '' };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'گراف درس‌ها قابل تحلیل نیست.' };
    }
  }, [curriculumId, ids, rules]);
  const impacts = analysis.data?.impacts || [];
  const importance = new Map(impacts.map(x => [x.courseId, x]));
  const grouped = new Map<number, string[]>();
  for (const id of ids) {
    const semester = Math.max(1, Math.min(12,
      assignments.find(a => a.courseId === id)?.suggestedSemester || 1));
    const group = grouped.get(semester) || [];
    group.push(id);
    grouped.set(semester, group);
  }
  for (const group of grouped.values()) {
    group.sort((a,b) => (importance.get(b)?.score || 0) - (importance.get(a)?.score || 0) ||
      (courseMap.get(a)?.name || '').localeCompare(courseMap.get(b)?.name || '', 'fa'));
  }
  const semesters = [...grouped.keys()].sort((a,b) => a-b);
  const maxRows = Math.max(1, ...[...grouped.values()].map(g => g.length));
  const positions = new Map<string,Position>();
  semesters.forEach((semester, col) => grouped.get(semester)!.forEach((id, row) =>
    positions.set(id, { x: 22 + col*COLUMN_W, y: 38 + row*ROW_H })));
  const width = Math.max(520, semesters.length*COLUMN_W+38);
  const height = Math.max(260, maxRows*ROW_H+50);

  const selectCourse = (id:string) => {
    setMessage('');
    if (!source || (source && target)) {
      setSource(id); setTarget('');
    } else if (source === id) {
      setSource(''); setTarget('');
    } else {
      setTarget(id);
    }
  };
  const createLink = async () => {
    if (!source || !target || source === target || busy || !analysis.data) return;
    setBusy(true); setMessage('');
    try {
      const res = await apiRequest('/api/curriculum/rules', {
        method:'POST', body: JSON.stringify({
          curriculumId, targetCourseId: target, relationshipType: kind,
          expression: { type:'COURSE', courseId: source },
        }),
      });
      if (res.success) {
        setSource(''); setTarget('');
        await onUpdated();
        setMessage('رابطه ثبت و نقشه به‌روزرسانی شد.');
      } else {
        setMessage(res.error || 'خطا در تعریف رابطه؛ قوانین چارت را بررسی کنید.');
      }
    } catch {
      setMessage('ارتباط با سرور قطع شد؛ وضعیت قانون را دوباره بررسی کنید.');
    } finally {
      setBusy(false);
    }
  };
  const links = analysis.data?.links || [];

  return <section dir="rtl" aria-labelledby="dependency-map-title"
    className="min-w-0 space-y-4 rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-slate-50 p-3 shadow-sm sm:p-6 dark:border-blue-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 id="dependency-map-title" className="flex items-center gap-2 text-xl font-black text-slate-950 dark:text-white">
          <GitBranch aria-hidden="true" className="h-6 w-6 text-blue-600 dark:text-blue-400" /> نقشهٔ زنجیرهٔ پیش‌نیازها
        </h3>
        <p className="mt-2 max-w-3xl text-xs leading-7 text-slate-600 dark:text-slate-300 sm:text-sm">
          روی یک درس و سپس درس مقصد بزن تا ارتباط آن‌ها را تعریف کنی.
          فلش پیوسته یعنی پیش‌نیاز؛ خط‌چین یعنی هم‌نیاز. اهمیت نسبی بر اساس
          <strong> همهٔ درس‌های وابسته تا انتهای دوره </strong> محاسبه می‌شود، نه فقط ترم بعد.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        <span className="rounded-full border border-blue-200 bg-white px-3 py-2 text-blue-800 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-200">← پیش‌نیاز</span>
        <span className="rounded-full border border-amber-200 bg-white px-3 py-2 text-amber-800 dark:border-amber-800 dark:bg-slate-800 dark:text-amber-200">┄ هم‌نیاز</span>
      </div>
    </div>

    {analysis.error && <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
      <ShieldAlert className="h-5 w-5 shrink-0" /> {analysis.error}
    </p>}

    {analysis.data && <>
      {analysis.data.hasAlternativeRules && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-7 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        شرط‌های «یکی از چند درس» در این نقشه مسیر احتمالی محسوب شده‌اند؛ برای تصمیم قطعی اخذ باید منطق AND/OR را در ویرایشگر پیشرفته بررسی کنی.
      </p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500 dark:text-slate-400">درس‌های این چارت</span>
          <strong className="mt-1 block text-2xl font-black text-slate-900 dark:text-white">{numberFa(ids.length)}</strong>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500 dark:text-slate-400">ارتباط‌های شناسایی‌شده</span>
          <strong className="mt-1 block text-2xl font-black text-slate-900 dark:text-white">{numberFa(links.length)}</strong>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs text-slate-500 dark:text-slate-400">بیشترین وابستگی مستقیم و غیرمستقیم</span>
          <strong className="mt-1 block text-2xl font-black text-slate-900 dark:text-white">{numberFa(impacts[0]?.downstreamCount || 0)}</strong>
        </div>
      </div>

      {ids.length ? <>
        <div className="md:hidden" aria-label="لیست زنجیرهٔ دروس برای موبایل">
          <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">نمای فهرستی برای لمس آسان‌تر؛ نقش هر درس را انتخاب کن.</p>
          <div className="grid gap-2">
            {impacts.map(item => <button type="button" key={item.courseId} onClick={() => selectCourse(item.courseId)}
              aria-pressed={source===item.courseId||target===item.courseId}
              className={`flex min-h-14 items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${source===item.courseId?'border-blue-500 bg-blue-50 dark:bg-blue-950/40':target===item.courseId?'border-violet-500 bg-violet-50 dark:bg-violet-950/30':'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
              <span className="min-w-0 text-sm font-bold text-slate-900 dark:text-white">{courseMap.get(item.courseId)?.name}</span>
              <span className="shrink-0 rounded-lg bg-blue-100 px-2 py-1 text-xs text-blue-900 dark:bg-blue-950 dark:text-blue-200">{numberFa(item.downstreamCount)} درس وابسته</span>
            </button>)}
          </div>
        </div>

        <div className="hidden max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/80 md:block dark:border-slate-800 dark:bg-slate-950"
          aria-label="نقشهٔ گرافیکی ترم‌ها و ارتباط‌های درسی" tabIndex={0}>
          <div className="relative" style={{width, height}}>
            <svg viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true">
              <defs>
                <marker id="dep-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill="#2563eb"/>
                </marker>
              </defs>
              {links.map((link:DependencyLink,i) => {
                const a = positions.get(link.source), b = positions.get(link.target);
                if (!a || !b) return null;
                const x1=a.x+BOX_W, y1=a.y+BOX_H/2, x2=b.x, y2=b.y+BOX_H/2;
                const bend=Math.max(34,Math.abs(x2-x1)/2);
                return <path key={`${link.kind}-${link.source}-${link.target}-${i}`}
                  d={`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`}
                  fill="none" stroke={link.kind==='COREQUISITE'?'#d97706':'#2563eb'}
                  strokeWidth={link.conditional?1.5:2.3}
                  strokeDasharray={link.kind==='COREQUISITE'?'7 5':undefined}
                  opacity=".8" markerEnd={link.kind==='PREREQUISITE'?'url(#dep-arrow)':undefined} />;
              })}
            </svg>
            {semesters.map((s,col) => <span key={s} className="absolute top-2 text-xs font-extrabold text-slate-500 dark:text-slate-400"
              style={{left:22+col*COLUMN_W}}>ترم {numberFa(s)}</span>)}
            {ids.map(id => {
              const pos=positions.get(id)!;
              const item=importance.get(id);
              return <button type="button" key={id} onClick={() => selectCourse(id)}
                aria-pressed={source===id||target===id}
                title={`${courseMap.get(id)?.name} — ${item?.downstreamCount||0} درس پایین‌دستی`}
                className={`absolute flex flex-col items-start justify-center gap-1 rounded-2xl border px-3 text-right shadow-md transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/60 ${source===id?'border-blue-500 bg-blue-50 dark:bg-blue-950':target===id?'border-violet-500 bg-violet-50 dark:bg-violet-950':'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
                style={{left:pos.x,top:pos.y,width:BOX_W,height:BOX_H}}>
                <strong className="line-clamp-2 w-full text-xs leading-5 text-slate-900 dark:text-white">{courseMap.get(id)?.name}</strong>
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  {numberFa(item?.downstreamCount||0)} درس وابسته · زنجیره {numberFa(item?.longestChain||0)}
                </span>
              </button>;
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
          <h4 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"><Link2 className="h-4 w-4 text-blue-600"/> اتصال دو درس</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div>
              <label htmlFor="dep-source" className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">درس مبدأ</label>
              <select id="dep-source" value={source} onChange={e=>{setSource(e.target.value);setMessage('');}}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">انتخاب درس مبدأ</option>
                {ids.map(id=><option key={id} value={id}>{courseMap.get(id)?.name}</option>)}
              </select>
            </div>
            <ArrowLeft aria-hidden="true" className="hidden h-5 w-5 text-blue-600 sm:block" />
            <div>
              <label htmlFor="dep-target" className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">درس مقصد</label>
              <select id="dep-target" value={target} onChange={e=>{setTarget(e.target.value);setMessage('');}}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">انتخاب درس مقصد</option>
                {ids.filter(id=>id!==source).map(id=><option key={id} value={id}>{courseMap.get(id)?.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex min-h-11 items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
              نوع رابطه
              <select value={kind} onChange={e=>setKind(e.target.value as typeof kind)}
                aria-label="نوع رابطه" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
                <option value="PREREQUISITE">پیش‌نیاز ←</option>
                <option value="COREQUISITE">هم‌نیاز ┄</option>
              </select>
            </label>
            <button type="button" onClick={createLink} disabled={!source||!target||source===target||busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-blue-800">
              <Plus className="h-4 w-4"/> {busy?'در حال ثبت…':'ثبت ارتباط'}
            </button>
          </div>
          {message&&<p role="status" className="mt-3 text-xs font-semibold leading-6 text-blue-700 dark:text-blue-300">{message}</p>}
          <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
            ثبت ارتباط از مسیر API با کنترل مجوز و چرخه انجام می‌شود. برای شرط‌های چندگانهٔ AND/OR از فرم پیشرفتهٔ موجود استفاده کن.
          </p>
        </div>

        <div aria-label="رتبه‌بندی وابستگی درس‌ها" className="rounded-2xl bg-slate-100 p-3 sm:p-4 dark:bg-slate-900/70">
          <h4 className="text-sm font-black text-slate-900 dark:text-white">درس‌های اثرگذارتر در زنجیرهٔ برنامه</h4>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {impacts.slice(0,6).map((item,i) => <div key={item.courseId}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
              <strong className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200">{numberFa(i+1)}</strong>
              <div className="min-w-0">
                <div className="text-xs font-extrabold leading-6 text-slate-900 dark:text-white">{courseMap.get(item.courseId)?.name}</div>
                <div className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                  {numberFa(item.downstreamCount)} درس پایین‌دستیِ یکتا · {numberFa(item.longestChain)} گام زنجیره
                </div>
              </div>
            </div>)}
          </div>
        </div>
      </>:<p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
        هنوز درسی به چارت انتخاب‌شده اضافه نشده؛ ابتدا درس‌ها را در ساخت چارت ثبت کن.
      </p>}
    </>}
  </section>;
};
