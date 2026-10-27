import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Check, CheckCheck, ClipboardCopy, LockKeyhole, RefreshCw, Zap } from 'lucide-react';
import type { AcademicRule, CourseEligibilityResult, StudentAcademicProfile, StudentPassedCourse } from '../types';
import { apiRequest } from '../utils/api';
import { buildRegistrationQueue } from '../domain/registration-queue';
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
  profile: StudentAcademicProfile | null;
  curriculumId: string | null;
  onEditPriorities: () => void;
  onReorderCourses: (orderedCourseIds: string[]) => void | boolean | Promise<void | boolean>;
}

export const RegistrationLaunchpad: React.FC<Props> = ({
  evaluations,selectedOfferingIds,coursePriorities,profile,curriculumId,onEditPriorities,onReorderCourses,
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
  const [revision,setRevision]=useState(0);
  const academicContextKey=`${profile?.userId||'unknown'}|${profile?.currentTermId||'none'}|${curriculumId||'none'}|${revision}`;
  // Async clipboard/reorder responses from another account never show on this one.
  const copyState=copyNotice?.contextKey===academicContextKey?copyNotice.message:'';
  const setCopyState=(message:string)=>setCopyNotice({contextKey:academicContextKey,message});
  const progressKey=`darschin-reg-progress-${profile?.userId||'unknown'}-${profile?.currentTermId||'term'}-${curriculumId||'none'}`;
  const [doneIds,setDoneIds]=useState<string[]>([]);
  // Wait for hydration of this exact term/chart before persisting; otherwise the
  // initial [] state could overwrite a student's previously checked progress.
  const [progressLoadedKey,setProgressLoadedKey]=useState<string|null>(null);
  useEffect(()=>{setSortMode(false);},[profile?.userId,profile?.currentTermId]);
  // Never render completion marks from the previous student's session during
  // the render immediately after switching profiles.
  const progressReady=progressLoadedKey===progressKey;
  const activeDoneIds=progressReady?doneIds:[];

  useEffect(()=>{
    try {
      const parsed=JSON.parse(window.sessionStorage.getItem(progressKey)||'[]');
      setDoneIds(Array.isArray(parsed)?parsed.filter((id:unknown):id is string=>typeof id==='string'):[]);
    }catch{setDoneIds([]);}
    setProgressLoadedKey(progressKey);
  },[progressKey]);
  useEffect(()=>{
    if(progressLoadedKey!==progressKey)return;
    try{window.sessionStorage.setItem(progressKey,JSON.stringify(doneIds));}catch{/* private browsing */}
  },[doneIds,progressKey,progressLoadedKey]);

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

  const queue=useMemo(()=>buildRegistrationQueue({
    evaluations,selectedOfferingIds,preferredCourseIds:coursePriorities,rules,passedCourses:passed,
    profile:{majorId:profile?.majorId||'',entryYearId:profile?.entryYearId||'',
      selectedTrackId:profile?.selectedTrackId||null},
  }),[evaluations,selectedOfferingIds,coursePriorities,rules,passed,profile?.majorId,profile?.entryYearId,profile?.selectedTrackId]);

  // Do not advertise a safe copy/order while its chart and passed-course data
  // are pending or failed. Raw codes remain visible for manual verification.
  const rulesReady=Boolean(curriculumId)&&Boolean(profile?.userId)&&
    verifiedContextKey===academicContextKey&&!loading&&!error;
  const stepIds=queue.steps.map(s=>s.courseId);
  const next=rulesReady&&progressReady?queue.steps.find(s=>s.ready&&!activeDoneIds.includes(s.courseId)&&s.copyCode&&!s.dependencyCourseIds.some(id=>!activeDoneIds.includes(id))):undefined;
  const copy=useCallback(async(value:string|null,courseName:string)=>{
    if(!value){setCopyState('کد معتبر در دسترس نیست.');return;}
    const ok=await copyTextWithFallback(value);
    setCopyState(ok?`کد «${courseName}» کپی شد.`:`کپی خودکار ممکن نیست؛ کد ${value} را انتخاب و دستی کپی کن.`);
  },[academicContextKey]);
  const toggleDone=(id:string)=>{
    if(!progressReady)return;
    setDoneIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  };
  const move=async(index:number,direction:-1|1)=>{
    const target=index+direction;
    if(reorderLock.current||target<0||target>=stepIds.length)return;
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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 dark:border-blue-900 dark:bg-blue-950/40">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-bold text-blue-950 dark:text-blue-100">
          <Zap className="h-4 w-4"/> صف سریع ثبت دروس
        </h2>
        <p className="mt-0.5 text-xs leading-6 text-blue-800 dark:text-blue-300">
          {queue.steps.length} درس · {activeDoneIds.filter(id=>stepIds.includes(id)).length} ثبت‌شده به علامت خودت · یک لمس برای کپی
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="کپی کد درس بعدی" onClick={()=>void copy(next?.copyCode||null,next?.courseName||'درس بعدی')}
          disabled={!rulesReady||!next?.copyCode} className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-blue-700 px-3 text-xs font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
          <ClipboardCopy className="h-4 w-4"/> کپی بعدی
        </button>
        <button type="button" aria-pressed={sortMode} aria-controls="registration-queue-list"
          onClick={()=>setSortMode(value=>!value)} disabled={reordering||queue.steps.length<2}
          className={`min-h-11 rounded-lg border px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-45 ${sortMode?'border-blue-700 bg-blue-700 text-white':'border-blue-300 text-blue-900 dark:text-blue-100'}`}>
          {sortMode?'اتمام چیدمان':'چیدمان'}
        </button>
        <button type="button" onClick={onEditPriorities} className="min-h-11 rounded-lg border border-blue-300 px-3 text-xs font-bold text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-100">برنامه</button>
      </div>
    </div>
    <p className="flex items-start gap-2 px-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
      <LockKeyhole className="mt-1 h-4 w-4 shrink-0"/>
      این فهرست ثبت خودکار در آموزشیار نیست؛ پس از ثبت واقعی هر درس، تیک همان ردیف را بزن. کدهای ساختگی دمو در آموزشیار معتبر نیستند.
    </p>
    {loading&&<p role="status" className="text-xs text-slate-600 dark:text-slate-300"><RefreshCw aria-hidden="true" className="ml-1 inline h-4 w-4 animate-spin motion-reduce:animate-none"/>در حال تطبیق قوانین… کپی سریع پس از بررسی فعال می‌شود.</p>}
    {!loading&&(error||rules.length===0)&&<p role="status" className="rounded-lg bg-amber-50 p-2 text-xs leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="ml-1 inline h-4 w-4"/>{error||'قانون معتبری برای ترتیب خودکار این چارت ثبت نشده؛ ترتیب فعلاً دستی است.'}
      <button type="button" onClick={()=>setRevision(x=>x+1)} className="mr-2 underline">بررسی مجدد</button>
    </p>}
    {copyState&&<p role="status" aria-live="polite" className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-200">{copyState}</p>}
    {queue.steps.length===0&&<p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm dark:border-slate-700">هنوز درسی انتخاب نکرده‌ای؛ ابتدا درس و گروه را از بخش دروس ارائه‌شده اضافه کن.</p>}
    <ol id="registration-queue-list" className="space-y-1.5" aria-label="ترتیب ثبت دروس">
      {queue.steps.map((step,index)=>{
        const done=activeDoneIds.includes(step.courseId);
        const offering=evaluations.find(o=>o.offeringId===step.offeringId);
        const locked=step.dependencyCourseIds.some(id=>!activeDoneIds.includes(id));
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
            <button type="button" disabled={reordering||index===0} onClick={()=>void move(index,-1)} aria-label={`انتقال ${step.courseName} به بالا`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><ArrowUp className="h-4 w-4"/></button>
            <button type="button" disabled={reordering||index===queue.steps.length-1} onClick={()=>void move(index,1)} aria-label={`انتقال ${step.courseName} به پایین`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><ArrowDown className="h-4 w-4"/></button>
            </> : <>
            <button type="button" disabled={!rulesReady||!step.ready||!step.copyCode||locked} onClick={()=>void copy(step.copyCode,step.courseName)}
              aria-label={`کپی کد ${step.courseName}`}
              className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-lg bg-blue-700 px-2 text-xs font-bold text-white disabled:opacity-45">
              <ClipboardCopy className="h-4 w-4"/><span className="hidden sm:inline">کپی</span>
            </button>
            <button type="button" onClick={()=>toggleDone(step.courseId)} disabled={!progressReady||(!done&&locked)} aria-pressed={done}
              aria-label={done?`لغو علامت ثبت ${step.courseName}`:`علامت ثبت ${step.courseName}`}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 ${done?'border-emerald-500 bg-emerald-100 text-emerald-800 dark:bg-emerald-900':'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>
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
          {(step.warnings.length>0||step.dependencyNames.length>0||step.copyCode?.startsWith('DEMO-')||Boolean(step.groupCode && step.copyCode!==step.groupCode))&&
            <details className="w-full border-t border-amber-100 text-xs text-amber-800 dark:border-amber-900/60 dark:text-amber-300">
              <summary className="cursor-pointer px-8 py-1 font-semibold">جزئیات کد و وابستگی‌ها</summary>
              <div className="space-y-1 px-8 pb-2 leading-6">
                <p>کد: <code dir="ltr">{step.copyCode||'نامشخص'}</code> · گروه: <code dir="ltr">{step.groupCode||'نامشخص'}</code></p>
                {step.groupCode && (
                  <button type="button"
                    disabled={!rulesReady||!step.ready||locked}
                    onClick={()=>void copy(step.groupCode,`شمارهٔ گروه ${step.courseName}`)}
                    aria-label={`کپی شماره گروه ${step.courseName}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-bold text-amber-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-45 dark:border-amber-900 dark:bg-slate-900 dark:text-amber-200">
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
