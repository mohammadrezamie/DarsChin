import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownUp, Check, CheckCheck, ClipboardCopy, GraduationCap, LockKeyhole, RefreshCw, Zap } from 'lucide-react';
import type {
  AcademicRule, CourseEligibilityResult, StudentAcademicProfile, StudentPassedCourse,
} from '../types';
import { apiRequest } from '../utils/api';
import { buildRegistrationQueue } from '../domain/registration-queue';

interface ChartRules {
  curriculum: { id: string; name: string; version: string };
  prerequisites: AcademicRule[];
  corequisites: AcademicRule[];
}
interface PassedResponse { passedCourses: StudentPassedCourse[] }
interface Props {
  evaluations: CourseEligibilityResult[];
  selectedOfferingIds: string[];
  coursePriorities: string[];
  profile: StudentAcademicProfile | null;
  curriculumId: string | null;
  onEditPriorities: () => void;
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* HTTPS permission denied; try legacy copy. */ }
  // On local http://IP VPS deployments clipboard APIs may be unavailable.
  try {
    const field = document.createElement('textarea');
    field.value = value;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    field.dir = 'ltr';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  } catch { return false; }
}

export const RegistrationLaunchpad: React.FC<Props> = ({
  evaluations, selectedOfferingIds, coursePriorities, profile, curriculumId, onEditPriorities,
}) => {
  const [rules, setRules] = useState<AcademicRule[]>([]);
  const [passed, setPassed] = useState<StudentPassedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [copyState, setCopyState] = useState('');
  // Session-only, per student/term/chart: switching between planning and quick
  // registration must not silently erase the student's manual progress.
  const progressKey = `darschin-reg-progress-${profile?.userId || 'unknown'}-${profile?.currentTermId || 'term'}-${curriculumId || 'missing-chart'}`;
  const [doneIds, setDoneIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(progressKey) || '[]');
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    try { window.sessionStorage.setItem(progressKey, JSON.stringify(doneIds)); }
    catch { /* In private browsing, progress remains available in React state only. */ }
  }, [doneIds, progressKey]);

  useEffect(() => {
    let alive = true;
    if (!curriculumId) { setLoading(false); setDataError('برای محاسبهٔ وابستگی‌ها ابتدا چارت دقیق ورودی خودت را در پرونده تحصیلی مشخص کن.'); setRules([]); return; }
    setLoading(true); setDataError(''); setRules([]); setPassed([]);
    void Promise.all([
      apiRequest<ChartRules>(`/api/curriculum/${encodeURIComponent(curriculumId)}/full`),
      apiRequest<PassedResponse>('/api/student/passed-courses'),
    ]).then(([chart, history]) => {
      if (!alive) return;
      if (!chart.success || !history.success || !chart.data || !history.data ||
          chart.data.curriculum?.id !== curriculumId) {
        setDataError('قوانین چارت یا سوابق قبولی به‌طور کامل دریافت نشد؛ ترتیب خودکار معتبر نیست. دوباره تلاش کن.');
        return;
      }
      setRules([...(chart.data.prerequisites || []), ...(chart.data.corequisites || [])]);
      setPassed(history.data.passedCourses || []);
    }).catch(() => { if (alive) setDataError('ارتباط برای دریافت قوانین قطع شد؛ ترتیب وابستگی‌ها تأیید نشده است.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [curriculumId, revision]);

  const queue = useMemo(() => buildRegistrationQueue({
    evaluations, selectedOfferingIds, preferredCourseIds: coursePriorities,
    rules, passedCourses: passed,
    profile: { majorId: profile?.majorId || '', entryYearId: profile?.entryYearId || '',
      selectedTrackId: profile?.selectedTrackId || null },
  }), [evaluations, selectedOfferingIds, coursePriorities, rules, passed, profile?.majorId, profile?.entryYearId, profile?.selectedTrackId]);

  const todo = queue.steps.filter(step => !doneIds.includes(step.courseId));
  const nextReady = todo.find(step => step.ready && step.copyCode &&
    step.dependencyCourseIds.every(id => doneIds.includes(id)));
  const copied = useCallback(async (value: string | null, label: string) => {
    if (!value) { setCopyState('کد قابل اطمینان موجود نیست.'); return; }
    const ok = await copyToClipboard(value);
    setCopyState(ok ? `کد ${label} کپی شد: ${value}` : 'کپی خودکار انجام نشد. کد را انتخاب و دستی کپی کن.');
  }, []);

  const confirmed = (courseId: string) => setDoneIds(old =>
    old.includes(courseId) ? old.filter(id => id !== courseId) : [...old, courseId]);

  return (
    <section dir="rtl" className="darschin-page space-y-4" aria-label="آماده‌باش انتخاب واحد در آموزشیار">
      <div className="overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-l from-blue-900 to-slate-950 p-4 text-white shadow-lg sm:p-6 dark:border-blue-800">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-100">
          <Zap className="h-4 w-4" /> حالت سریع زمان انتخاب واحد
        </span>
        <h2 className="mt-3 text-xl font-black leading-relaxed sm:text-2xl">صف آمادهٔ ثبت درس در آموزشیار</h2>
        <p className="mt-2 max-w-3xl text-sm leading-8 text-blue-100">
          درس‌ها بر اساس اولویت تو چیده می‌شوند؛ همنیازهای لازم در صورت امکان جلوتر می‌آیند.
          کد درس یا گروه را لمس کن، در آموزشیار پیست کن و پس از ثبت موفق، مورد را دستی علامت بزن.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black">{queue.steps.length} درس در صف</span>
          <span className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black">{doneIds.filter(id => queue.steps.some(s=>s.courseId===id)).length} مورد علامت‌خورده</span>
          <button type="button" onClick={onEditPriorities}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-3 text-xs font-bold hover:bg-white/10">
            <ArrowDownUp className="h-4 w-4" /> ویرایش اولویت‌ها
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-7 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex items-start gap-2 font-black"><LockKeyhole className="mt-1 h-4 w-4 shrink-0" />
          <span>این صفحه به آموزشیار وصل نیست و ثبت‌نام انجام نمی‌دهد.</span>
        </div>
        <p className="mt-1">علامت «ثبت شد» فقط چک‌لیست شخصی این تب مرورگر است و تا بستن تب نگه داشته می‌شود؛ ظرفیت‌ها و تأیید نهایی را در خود آموزشیار کنترل کن.
          ترتیب همنیازها بر اساس قوانینِ واردشده در چارت است، نه تضمین رسمی پذیرش توسط آموزشیار.</p>
      </div>

      {loading && <p role="status" className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm dark:bg-slate-900">
        <RefreshCw className="h-4 w-4 animate-spin" /> در حال دریافت چارت و دروس پاس‌شده…</p>}
      {!loading && (dataError || rules.length === 0) && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
          <AlertTriangle className="ml-2 inline h-4 w-4" />
          {dataError || 'برای این چارت قانون پیش‌نیاز/همنیاز ثبت نشده است؛ ترتیب نمایش فقط مطابق اولویت دستی است و از نظر قوانین دانشگاه تأیید نشده.'}
          <button type="button" onClick={()=>setRevision(x=>x+1)}
            className="mr-3 min-h-10 rounded-xl border border-rose-300 px-3 font-bold dark:border-rose-800">دریافت دوباره</button>
        </div>
      )}
      {!loading && !dataError && rules.length > 0 && queue.hasUnresolvedRules && (
        <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-7 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          تعدادی وابستگی ناقص یا مبهم‌اند؛ هشدار هر درس را بخوان. برای این موارد ترتیب بی‌خطر را نمی‌توان قطعی دانست.
        </p>
      )}
      {queue.steps.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <button type="button"
            disabled={loading || Boolean(dataError) || rules.length===0 || !nextReady}
            onClick={()=>void copied(nextReady?.copyCode || null,'درس بعدی')}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50 sm:flex-none">
            <ClipboardCopy className="h-4 w-4" /> کپی کد درس بعدی
          </button>
          <button type="button" onClick={()=>setDoneIds([])}
            className="min-h-11 rounded-xl border border-slate-300 px-4 text-xs font-bold dark:border-slate-700">پاک‌کردن تیک‌ها</button>
          <span className="text-xs text-slate-500 dark:text-slate-300">برای سرعت بیشتر این صفحه را کنار آموزشیار باز نگه دار.</span>
        </div>
      )}
      {copyState && <p role="status" aria-live="polite" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">{copyState}</p>}

      {queue.steps.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-right text-sm leading-7 dark:border-slate-700">
        هنوز درس انتخاب‌شده‌ای در برنامه نیست. ابتدا از «دروس ارائه‌شده» درس و گروه مدنظرت را اضافه کن.
      </div>}

      <ol className="space-y-3">
        {queue.steps.map(step=>{
          const done=doneIds.includes(step.courseId);
          const alternatives=evaluations.filter(e=>e.courseId===step.courseId && e.offeringId!==step.offeringId);
          const pendingDependencies=step.dependencyCourseIds.filter(id => !doneIds.includes(id));
          const locked=pendingDependencies.length>0;
          return <li key={step.courseId} className={`darschin-surface min-w-0 p-4 sm:p-5 ${done?'opacity-65':''}`}>
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-700 font-black text-white">{step.effectiveRank}</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black leading-8 text-slate-950 dark:text-white">{step.courseName}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                  گروه انتخابی {step.groupCode || 'نامشخص'} · اولویت دلخواه {step.requestedRank}
                </p>
                {step.advancedForCorequisite && <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                  <ArrowDownUp className="h-4 w-4 shrink-0" /> جایگاه ثبت به‌خاطر وابستگی همنیاز تنظیم شد.
                </p>}
              </div>
              <button type="button" onClick={()=>confirmed(step.courseId)} aria-pressed={done} disabled={locked && !done}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-black ${done
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                {done?<CheckCheck className="h-4 w-4"/>:<Check className="h-4 w-4"/>}{done?'علامت‌خورده':locked?'در انتظار همنیاز':'ثبت شد (دستی)'}
              </button>
            </div>
            {step.dependencyNames.length>0 && <p className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
              <GraduationCap className="mt-1 h-4 w-4 shrink-0" /> اول این همنیازها را در آموزشیار ثبت کن و اینجا علامت بزن: {step.dependencyNames.join('، ')}
            </p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">کد درس برای جست‌وجوی آموزشیار</span>
                <code dir="ltr" className="my-2 block break-all text-left text-lg font-black text-slate-950 dark:text-white">{step.copyCode || 'نامشخص'}</code>
                <button type="button" disabled={!step.copyCode || locked} onClick={()=>void copied(step.copyCode,'درس')}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 text-sm font-black text-white disabled:opacity-50">
                  <ClipboardCopy className="h-4 w-4" /> کپی کد درس
                </button>
                {step.copyCode?.startsWith('DEMO-') && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs font-black leading-6 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">کد کاملاً ساختگی است؛ در آموزشیار واقعی استفاده نکن.</p>}
                <p className="mt-2 text-xs leading-6 text-amber-700 dark:text-amber-300">{step.codeFromOffering
                  ? 'کد از اطلاعات ارائه دریافت شده، ولی پذیرش آن در آموزشیار تضمین نشده است.'
                  : 'کد فقط از کاتالوگ درس آمده؛ با کد جست‌وجوی آموزشیار تطبیق بده.'}</p>
              </div>
              <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <span className="block text-xs font-bold text-slate-600 dark:text-slate-300">گروه موردنظر</span>
                <code dir="ltr" className="my-2 block text-left text-lg font-black text-slate-950 dark:text-white">{step.groupCode||'نامشخص'}</code>
                <button type="button" disabled={!step.groupCode || locked} onClick={()=>void copied(step.groupCode,'گروه')}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-300 px-3 text-sm font-black text-blue-800 disabled:opacity-50 dark:border-blue-800 dark:text-blue-200">
                  <ClipboardCopy className="h-4 w-4" /> کپی شماره گروه
                </button>
                {alternatives.length>0 && <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                  جایگزین‌ها: {alternatives.map(x=>x.groupCode).filter(Boolean).join('، ')} (قبل از انتخاب تطبیق بده)
                </p>}
              </div>
            </div>
            {step.warnings.length>0 && <ul className="mt-3 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              {step.warnings.map((message,i)=><li key={i} className="flex gap-2"><AlertTriangle className="mt-1 h-4 w-4 shrink-0"/>{message}</li>)}
            </ul>}
          </li>;
        })}
      </ol>
    </section>
  );
};
