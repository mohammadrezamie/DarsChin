import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Check, CheckCheck, ClipboardCopy, LockKeyhole, RefreshCw, Zap } from 'lucide-react';
import type { AcademicRule, CourseEligibilityResult, StudentAcademicProfile, StudentPassedCourse } from '../types';
import { apiRequest } from '../utils/api';
import { buildRegistrationQueue } from '../domain/registration-queue';
import { activeRegistrationOfferingIds, canPrioritizeOffering } from '../domain/student-flow-stage';
import type { RegistrationStep } from '../domain/registration-queue';
import { completedRegistrationCourseIds, parseStoredRegistrationTokens, pruneRegistrationTokens, registrationProgressToken } from '../domain/registration-progress';
import { copyTextWithFallback } from '../utils/clipboard';

interface ChartRules {
  curriculum: { id: string; name: string; version: string };
  prerequisites: AcademicRule[];
  corequisites: AcademicRule[];
}
interface Props {
  evaluations: CourseEligibilityResult[];
  selectedOfferingIds: string[];
  coursePriorities: string[];
  offeringPriorities?: Record<string, string[]>;
  chosenCourseIds?: string[];
  planBusy?: boolean;
  onSelectPrimaryOffering?: (courseId: string, offeringId: string) => void;
  profile: StudentAcademicProfile | null;
  curriculumId: string | null;
  onEditPriorities: () => void;
  onReorderCourses: (orderedCourseIds: string[]) => void | boolean | Promise<void | boolean>;
}

export const RegistrationLaunchpad: React.FC<Props> = ({
  evaluations,selectedOfferingIds,coursePriorities,offeringPriorities = {},chosenCourseIds,planBusy = false,onSelectPrimaryOffering,profile,curriculumId,onEditPriorities,onReorderCourses,
}) => {
  const [rules,setRules]=useState<AcademicRule[]>([]);
  const [passed,setPassed]=useState<StudentPassedCourse[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  // A successful fetch authorizes only the exact student, term and chart used
  // for that fetch. Changing profiles must invalidate the previous proof
  // synchronously, before React's effects run.
  const [verifiedContextKey,setVerifiedContextKey]=useState<string|null>(null);
  const [copyNotice,setCopyNotice]=useState<{contextKey:string;message:string}|null>(null);
  const [reordering,setReordering]=useState(false);
  // Default to the student's real task: see a course and copy its code.
  // Reordering is an explicit compact mode, not four permanent row buttons.
  const [sortMode,setSortMode]=useState(false);
  const reorderLock=useRef(false);
  // An empty queue during the initial API fetch must not erase previously
  // marked groups before the actual saved plan arrives.
  const hasObservedLoadedQueue=useRef(false);
  const [revision,setRevision]=useState(0);
  const academicContextKey=`${profile?.userId||'unknown'}|${profile?.currentTermId||'none'}|${curriculumId||'none'}|${revision}`;
  // Async clipboard/reorder responses from another account never show on this one.
  const copyState=copyNotice?.contextKey===academicContextKey?copyNotice.message:'';
  const setCopyState=(message:string)=>setCopyNotice({contextKey:academicContextKey,message});
  const progressKey=`darschin-reg-progress-${profile?.userId||'unknown'}-${profile?.currentTermId||'term'}-${curriculumId||'none'}`;
  const [doneTokens,setDoneTokens]=useState<string[]>([]);
  // Wait for hydration of this exact term/chart before persisting; otherwise the
  // initial [] state could overwrite a student's previously checked progress.
  const [progressLoadedKey,setProgressLoadedKey]=useState<string|null>(null);
  useEffect(()=>{
    setSortMode(false);
    hasObservedLoadedQueue.current=false;
  },[profile?.userId,profile?.currentTermId,curriculumId]);
  // Never render completion marks from the previous student's session during
  // the render immediately after switching profiles.
  const progressReady=progressLoadedKey===progressKey;
  const activeDoneTokens=progressReady?doneTokens:[];

  useEffect(()=>{
    try {
      setDoneTokens(parseStoredRegistrationTokens(window.sessionStorage.getItem(progressKey)));
    }catch{setDoneTokens([]);}
    setProgressLoadedKey(progressKey);
  },[progressKey]);
  useEffect(()=>{
    if(progressLoadedKey!==progressKey)return;
    try{window.sessionStorage.setItem(progressKey,JSON.stringify(doneTokens));}catch{/* private browsing */}
  },[doneTokens,progressKey,progressLoadedKey]);

  useEffect(()=>{
    let alive=true;
    setVerifiedContextKey(null);
    setRules([]);setPassed([]);
    if(!curriculumId||!profile?.userId){
      setLoading(false);
      setError('هویت دانشجو یا چارت ورودی مشخص نیست؛ نمایش دستی ممکن است اما کپی سریع تا تعیین آن‌ها فعال نمی‌شود.');
      return ()=>{alive=false;};
    }
    setLoading(true);setError('');
    void Promise.all([
      apiRequest<ChartRules>(`/api/curriculum/${encodeURIComponent(curriculumId)}/full`),
      apiRequest<{passedCourses:StudentPassedCourse[]}>('/api/student/passed-courses'),
    ]).then(([chart,history])=>{
      if(!alive)return;
      if(!chart.success||!history.success||!chart.data||!history.data||
          chart.data.curriculum?.id!==curriculumId||
          !Array.isArray(chart.data.prerequisites)||!Array.isArray(chart.data.corequisites)||
          !Array.isArray(history.data.passedCourses)){
        setError('دریافت قوانین و سوابق کامل نبود؛ کدها نمایش داده می‌شوند، اما کپی سریع تا دریافت اطلاعات غیرفعال است.');
        return;
      }
      setRules([...chart.data.prerequisites,...chart.data.corequisites]);
      setPassed(history.data.passedCourses);
      setVerifiedContextKey(academicContextKey);
    }).catch(()=>{if(alive)setError('ارتباط برای دریافت سوابق یا قوانین برقرار نشد؛ کپی سریع تا بررسی دوباره غیرفعال است.');})
      .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false};
  },[academicContextKey]);

  const activeSelectedIds=activeRegistrationOfferingIds(selectedOfferingIds,evaluations,chosenCourseIds);
  const queue=useMemo(()=>buildRegistrationQueue({
    evaluations,selectedOfferingIds:activeSelectedIds,preferredCourseIds:coursePriorities,rules,passedCourses:passed,
    profile:{majorId:profile?.majorId||'',entryYearId:profile?.entryYearId||'',
      selectedTrackId:profile?.selectedTrackId||null},
  }),[evaluations,selectedOfferingIds,chosenCourseIds,coursePriorities,rules,passed,profile?.majorId,profile?.entryYearId,profile?.selectedTrackId]);

  // Do not advertise a safe copy/order while its chart and passed-course data
  // are pending or failed. Raw codes remain visible for manual verification.
  const rulesReady=Boolean(curriculumId)&&Boolean(profile?.userId)&&
    verifiedContextKey===academicContextKey&&!loading&&!error;
  // Once the actual academic context is loaded, discard progress for replaced
  // offerings. Otherwise switching A → B → A could resurrect A's old mark.
  useEffect(()=>{
    if(!rulesReady||!progressReady)return;
    if(queue.steps.length>0)hasObservedLoadedQueue.current=true;
    if(!hasObservedLoadedQueue.current)return;
    setDoneTokens(previous=>{
      const current=pruneRegistrationTokens(queue.steps,previous);
      return current.length===previous.length?previous:current;
    });
  },[rulesReady,progressReady,queue.steps]);
  const stepIds=queue.steps.map(s=>s.courseId);
  // A checked item is valid only for its exact currently selected group and
  // course code. Changing a group's offering invalidates its old check mark.
  const completedCourses=completedRegistrationCourseIds(queue.steps,activeDoneTokens);
  const next=rulesReady&&progressReady?queue.steps.find(s=>s.ready&&!completedCourses.has(s.courseId)&&s.copyCode&&!s.dependencyCourseIds.some(id=>!completedCourses.has(id))):undefined;
  const copy=useCallback(async(value:string|null,courseName:string)=>{
    if(planBusy){setCopyState('برنامه در حال ذخیره است؛ پس از پایان، کد معتبر را کپی کن.');return;}
    if(!value){setCopyState('کد معتبر در دسترس نیست.');return;}
    const ok=await copyTextWithFallback(value);
    setCopyState(ok?`کد «${courseName}» کپی شد.`:`کپی خودکار ممکن نیست؛ کد ${value} را انتخاب و دستی کپی کن.`);
  },[academicContextKey,planBusy]);
  const toggleDone=(step:RegistrationStep)=>{
    if(!progressReady||planBusy)return;
    const token=registrationProgressToken(step);
    setDoneTokens(prev=>prev.includes(token)?prev.filter(x=>x!==token):[...prev,token]);
  };
  const move=async(index:number,direction:-1|1)=>{
    const target=index+direction;
    if(reorderLock.current||planBusy||target<0||target>=stepIds.length)return;
    const order=[...stepIds];[order[index],order[target]]=[order[target],order[index]];
    reorderLock.current=true;
    setReordering(true);
    setCopyState('در حال ذخیرهٔ ترتیب دلخواه…');
    try {
      // The live dashboard returns false if saving failed. Demo callbacks may
      // return void; they must never be mistaken for a rejected save.
      const saved=await onReorderCourses(order);
      if(saved===false)throw new Error('save rejected');
      setCopyState('ترتیب دلخواه ذخیره شد؛ تقدم همنیازها در صورت نیاز رعایت می‌شود.');
    } catch {
      setCopyState('ترتیب ذخیره نشد؛ چیدمان قبلی حفظ شده است. دوباره تلاش کن.');
    } finally {
      reorderLock.current=false;
      setReordering(false);
    }
  };

  return <section dir="rtl" aria-label="صف سریع ثبت دروس" className="darschin-page space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-3 dark:border-teal-950 dark:bg-teal-950/40">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-bold text-teal-950 dark:text-teal-100">
          <Zap className="h-4 w-4"/> صف ثبت و اولویت‌ها
        </h2>
        <p className="mt-0.5 text-xs leading-6 text-teal-900 dark:text-teal-300">
          {queue.steps.length} درس · {completedCourses.size} گروه علامت‌خورده در همین مرورگر · یک لمس برای کپی
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="کپی کد درس بعدی" onClick={()=>void copy(next?.copyCode||null,next?.courseName||'درس بعدی')}
          disabled={!rulesReady||!next?.copyCode||planBusy} className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-teal-800 px-3 text-xs font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:cursor-not-allowed disabled:opacity-50">
          <ClipboardCopy className="h-4 w-4"/> کپی بعدی
        </button>
        <button type="button" aria-pressed={sortMode} aria-controls="registration-queue-list"
          onClick={()=>setSortMode(value=>!value)} disabled={reordering||planBusy||queue.steps.length<2}
          className={`min-h-11 rounded-lg border px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-45 ${sortMode?'border-teal-800 bg-teal-800 text-white':'border-teal-300 text-teal-950 dark:text-teal-100'}`}>
          {sortMode?'اتمام چیدمان':'چیدمان'}
        </button>
        <button type="button" disabled={planBusy} onClick={onEditPriorities} className="min-h-11 rounded-lg border border-teal-300 px-3 text-xs font-bold text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:text-teal-100">ویرایش درس‌ها</button>
      </div>
    </div>
    <p className="flex items-start gap-2 px-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
      <LockKeyhole className="mt-1 h-4 w-4 shrink-0"/>
      این فهرست ثبت خودکار در آموزشیار نیست؛ فقط بعد از ثبت واقعی همان گروه، تیکش را بزن. با تغییر گروه یا کد ارائه، تیک قبلی معتبر نیست. کدهای ساختگی دمو هم معتبر نیستند.
    </p>
    {loading&&<p role="status" className="text-xs text-slate-600 dark:text-slate-300"><RefreshCw aria-hidden="true" className="ml-1 inline h-4 w-4 animate-spin motion-reduce:animate-none"/>در حال تطبیق قوانین… کپی سریع پس از بررسی فعال می‌شود.</p>}
    {!loading&&(error||rules.length===0)&&<p role="status" className="rounded-lg bg-amber-50 p-2 text-xs leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="ml-1 inline h-4 w-4"/>{error||'قانون معتبری برای ترتیب خودکار این چارت ثبت نشده؛ ترتیب فعلاً دستی است.'}
      <button type="button" onClick={()=>setRevision(x=>x+1)} className="mr-2 underline">بررسی مجدد</button>
    </p>}
    {copyState&&<p role="status" aria-live="polite" className="rounded-lg bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-950 dark:bg-teal-950 dark:text-teal-200">{copyState}</p>}
    {queue.steps.length===0&&<p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm leading-7 dark:border-slate-700">
      {chosenCourseIds?.length
        ? 'درس‌ها را انتخاب کرده‌ای؛ حالا برای تشکیل صف ثبت، استاد و گروه اول هر درس را از کارت‌های بالای همین صفحه مشخص کن.'
        : 'هنوز درسی انتخاب نکرده‌ای؛ ابتدا از مرحلهٔ انتخاب درس‌ها شروع کن.'}
    </p>}
    <ol id="registration-queue-list" className="space-y-1.5" aria-label="ترتیب ثبت دروس">
      {queue.steps.map((step,index)=>{
        const done=activeDoneTokens.includes(registrationProgressToken(step));
        const offering=evaluations.find(o=>o.offeringId===step.offeringId);
        const locked=step.dependencyCourseIds.some(id=>!completedCourses.has(id));
        const time=[offering?.dayOfWeek,offering?.startTime&&offering?.endTime?`${offering.startTime}–${offering.endTime}`:''].filter(Boolean).join(' · ');
        return <li key={step.courseId} className={`min-w-0 rounded-xl border ${done
          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
          <div className="flex min-w-0 items-center gap-1.5 px-2 py-1.5 sm:gap-2">
          <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-slate-500 dark:text-slate-300">{step.effectiveRank}</span>
          <div className="min-w-0 flex-1 text-right">
            <strong title={step.courseName} className="block break-words text-[13px] font-bold leading-5 text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100">{step.courseName}</strong>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1">
            {sortMode ? <>
            <button type="button" disabled={reordering||planBusy||index===0} onClick={()=>void move(index,-1)} aria-label={`انتقال ${step.courseName} به بالا`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><ArrowUp className="h-4 w-4"/></button>
            <button type="button" disabled={reordering||planBusy||index===queue.steps.length-1} onClick={()=>void move(index,1)} aria-label={`انتقال ${step.courseName} به پایین`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><ArrowDown className="h-4 w-4"/></button>
            </> : <>
            <button type="button" disabled={!rulesReady||!step.ready||!step.copyCode||locked||planBusy} onClick={()=>void copy(step.copyCode,step.courseName)}
              aria-label={`کپی کد ${step.courseName}`}
              className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg bg-teal-800 px-2 text-xs font-bold text-white disabled:opacity-45">
              <ClipboardCopy className="h-4 w-4"/><span className="hidden sm:inline">کپی</span>
            </button>
            <button type="button" onClick={()=>toggleDone(step)} disabled={!progressReady||(!done&&locked)||planBusy} aria-pressed={done}
              aria-label={done?`لغو علامت ثبت ${step.courseName} گروه ${step.groupCode}`:`علامت ثبت ${step.courseName} گروه ${step.groupCode}`}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-40 ${done?'border-emerald-500 bg-emerald-100 text-emerald-800 dark:bg-emerald-900':'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>
              {done?<CheckCheck className="h-4 w-4"/>:<Check className="h-4 w-4"/>}
            </button>
            </>}
          </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 px-3 pb-1.5 text-[11px] leading-5">
            <span className="min-w-0 break-words text-slate-500 [overflow-wrap:anywhere] dark:text-slate-300">
              {offering?.instructor||'استاد نامشخص'} · {time||'ساعت نامشخص'} · گروه {step.groupCode||'؟'}
            </span>
            <span className="min-w-0 break-all text-slate-600 dark:text-slate-300">
              کد {step.codeFromOffering ? 'ارائه' : 'تأییدنشده'}: <code dir="ltr" className="font-mono">{step.copyCode||'نامشخص'}</code>
            </span>
          </div>
          {(() => {
            const alternatives = [...new Set(offeringPriorities[step.courseId] || [])]
              .filter(id => id !== step.offeringId)
              .map(id => evaluations.find(item => item.offeringId === id && item.courseId === step.courseId))
              .filter((item): item is CourseEligibilityResult => Boolean(item));
            if (!alternatives.length) return null;
            return <details className="border-t border-amber-100 text-xs dark:border-amber-900/60">
              <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 font-bold text-amber-900 dark:text-amber-200">
                گروه‌های جایگزین به ترتیب ({alternatives.length.toLocaleString('fa-IR')})
              </summary>
              <ol className="space-y-1.5 px-3 pb-3">
                {alternatives.map((alternative,rank) => {
                  const eligible=canPrioritizeOffering(alternative);
                  return <li key={alternative.offeringId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-2.5 py-2 dark:bg-amber-950/30">
                    <span className="min-w-0 text-[11px] leading-6 text-amber-950 dark:text-amber-100">
                      {(rank+2).toLocaleString('fa-IR')}. {alternative.instructor || 'استاد نامشخص'} · گروه {alternative.groupCode}
                      {!eligible && <span className="block text-rose-700 dark:text-rose-300">
                        {alternative.primaryReason || 'این گروه در ارزیابی فعلی مجاز نیست'}</span>}
                    </span>
                    {onSelectPrimaryOffering && <button type="button"
                      disabled={planBusy || !eligible}
                      aria-label={`انتخاب ${alternative.instructor || 'استاد نامشخص'} به‌عنوان استاد اول درس ${step.courseName}`}
                      onClick={() => onSelectPrimaryOffering(step.courseId,alternative.offeringId)}
                      className="min-h-10 rounded-lg border border-amber-400 bg-white px-2.5 font-extrabold text-teal-900 disabled:opacity-45 dark:bg-slate-900 dark:text-teal-200">
                      تبدیل به استاد اول
                    </button>}
                  </li>;
                })}
              </ol>
            </details>;
          })()}
          {(step.warnings.length>0||step.dependencyNames.length>0||step.copyCode?.startsWith('DEMO-')||Boolean(step.groupCode && step.copyCode!==step.groupCode))&&
            <details className="w-full border-t border-amber-100 text-xs text-amber-800 dark:border-amber-900/60 dark:text-amber-300">
              <summary className="cursor-pointer px-8 py-1 font-semibold">جزئیات کد و وابستگی‌ها</summary>
              <div className="space-y-1 px-8 pb-2 leading-6">
                <p>کد: <code dir="ltr">{step.copyCode||'نامشخص'}</code> · گروه: <code dir="ltr">{step.groupCode||'نامشخص'}</code></p>
                {step.groupCode && (
                  <button type="button"
                    disabled={!rulesReady||!step.ready||locked||planBusy}
                    onClick={()=>void copy(step.groupCode,`شمارهٔ گروه ${step.courseName}`)}
                    aria-label={`کپی شماره گروه ${step.courseName}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-bold text-amber-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 disabled:cursor-not-allowed disabled:opacity-45 dark:border-amber-900 dark:bg-slate-900 dark:text-amber-200">
                    <ClipboardCopy aria-hidden="true" className="h-4 w-4"/> کپی شماره گروه
                  </button>
                )}
                {step.copyCode?.startsWith('DEMO-')&&<p>کد آزمایشی است، برای ثبت واقعی استفاده نکن.</p>}
                {step.dependencyNames.length>0&&<p>ابتدا همنیاز: {step.dependencyNames.join('، ')}</p>}
                {step.warnings.map((text,i)=><p key={i}>{text}</p>)}
              </div>
            </details>}
        </li>
      })}
    </ol>
  </section>;
};
