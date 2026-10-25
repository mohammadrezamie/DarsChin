import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Check, CheckCheck, ClipboardCopy, LockKeyhole, RefreshCw, Zap } from 'lucide-react';
import type { AcademicRule, CourseEligibilityResult, StudentAcademicProfile, StudentPassedCourse } from '../types';
import { apiRequest } from '../utils/api';
import { buildRegistrationQueue } from '../domain/registration-queue';

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
  onReorderCourses: (orderedCourseIds: string[]) => void | Promise<void>;
}

async function copyToClipboard(value: string): Promise<boolean> {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return true; } }
  catch { /* Unsupported or denied in embedded/HTTP demos. */ }
  try {
    const input=document.createElement('textarea');
    input.value=value; input.dir='ltr'; input.style.position='fixed'; input.style.opacity='0';
    document.body.appendChild(input); input.select();
    const ok=document.execCommand('copy');input.remove();return ok;
  } catch { return false; }
}

export const RegistrationLaunchpad: React.FC<Props> = ({
  evaluations,selectedOfferingIds,coursePriorities,profile,curriculumId,onEditPriorities,onReorderCourses,
}) => {
  const [rules,setRules]=useState<AcademicRule[]>([]);
  const [passed,setPassed]=useState<StudentPassedCourse[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [copyState,setCopyState]=useState('');
  const [revision,setRevision]=useState(0);
  const progressKey=`darschin-reg-progress-${profile?.userId||'unknown'}-${profile?.currentTermId||'term'}-${curriculumId||'none'}`;
  const [doneIds,setDoneIds]=useState<string[]>([]);

  useEffect(()=>{
    try {
      const parsed=JSON.parse(window.sessionStorage.getItem(progressKey)||'[]');
      setDoneIds(Array.isArray(parsed)?parsed.filter((id:unknown):id is string=>typeof id==='string'):[]);
    }catch{setDoneIds([]);}
  },[progressKey]);
  useEffect(()=>{try{window.sessionStorage.setItem(progressKey,JSON.stringify(doneIds));}catch{/* private browsing */}},[doneIds,progressKey]);

  useEffect(()=>{
    let alive=true;
    if(!curriculumId){setLoading(false);setError('چارت ورودی مشخص نیست؛ اولویت‌ها صرفاً دستی هستند.');setRules([]);return;}
    setLoading(true);setError('');setRules([]);setPassed([]);
    void Promise.all([
      apiRequest<ChartRules>(`/api/curriculum/${encodeURIComponent(curriculumId)}/full`),
      apiRequest<{passedCourses:StudentPassedCourse[]}>('/api/student/passed-courses'),
    ]).then(([chart,history])=>{
      if(!alive)return;
      if(!chart.success||!history.success||!chart.data||!history.data||chart.data.curriculum?.id!==curriculumId){
        setError('دریافت قوانین و سوابق کامل نبود؛ اولویت‌های دستی نمایش داده می‌شوند.');return;
      }
      setRules([...(chart.data.prerequisites||[]),...(chart.data.corequisites||[])]);
      setPassed(history.data.passedCourses||[]);
    }).catch(()=>{if(alive)setError('ارتباط برای دریافت سوابق یا قوانین برقرار نشد.');})
      .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false};
  },[curriculumId,revision]);

  const queue=useMemo(()=>buildRegistrationQueue({
    evaluations,selectedOfferingIds,preferredCourseIds:coursePriorities,rules,passedCourses:passed,
    profile:{majorId:profile?.majorId||'',entryYearId:profile?.entryYearId||'',
      selectedTrackId:profile?.selectedTrackId||null},
  }),[evaluations,selectedOfferingIds,coursePriorities,rules,passed,profile?.majorId,profile?.entryYearId,profile?.selectedTrackId]);

  const stepIds=queue.steps.map(s=>s.courseId);
  const next=queue.steps.find(s=>!doneIds.includes(s.courseId)&&s.copyCode&&!s.dependencyCourseIds.some(id=>!doneIds.includes(id)));
  const copy=useCallback(async(value:string|null,courseName:string)=>{
    if(!value){setCopyState('کد معتبر در دسترس نیست.');return;}
    const ok=await copyToClipboard(value);
    setCopyState(ok?`کد «${courseName}» کپی شد.`:'کپی خودکار ممکن نیست؛ کد را انتخاب و دستی کپی کن.');
  },[]);
  const toggleDone=(id:string)=>setDoneIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const move=(index:number,direction:-1|1)=>{
    const target=index+direction;
    if(target<0||target>=stepIds.length)return;
    const order=[...stepIds];[order[index],order[target]]=[order[target],order[index]];
    // Persist the actual student's requested order. The dependency engine will
    // still enforce confirmed corequisite-before-target relations at render.
    void onReorderCourses(order);
    setCopyState('ترتیب دلخواه ذخیره شد؛ تقدم همنیازها در صورت نیاز رعایت می‌شود.');
  };

  return <section dir="rtl" aria-label="صف سریع ثبت دروس" className="darschin-page space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-3 dark:border-blue-900 dark:bg-blue-950/40">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-bold text-blue-950 dark:text-blue-100">
          <Zap className="h-4 w-4"/> صف سریع ثبت دروس
        </h2>
        <p className="mt-0.5 text-xs leading-6 text-blue-800 dark:text-blue-300">
          {queue.steps.length} درس · {doneIds.filter(id=>stepIds.includes(id)).length} ثبت‌شده به علامت خودت · یک لمس برای کپی
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>void copy(next?.copyCode||null,next?.courseName||'درس بعدی')}
          disabled={!next?.copyCode} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-blue-700 px-3 text-xs font-bold text-white disabled:opacity-50">
          <ClipboardCopy className="h-4 w-4"/> کپی بعدی
        </button>
        <button type="button" onClick={onEditPriorities} className="min-h-10 rounded-lg border border-blue-300 px-3 text-xs font-bold text-blue-900 dark:text-blue-100">برنامه</button>
      </div>
    </div>
    <p className="flex items-start gap-2 px-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
      <LockKeyhole className="mt-1 h-4 w-4 shrink-0"/>
      این فهرست ثبت خودکار در آموزشیار نیست؛ پس از ثبت واقعی هر درس، تیک همان ردیف را بزن. کدهای ساختگی دمو در آموزشیار معتبر نیستند.
    </p>
    {loading&&<p role="status" className="text-xs text-slate-500"><RefreshCw className="ml-1 inline h-4 w-4 animate-spin"/>در حال تطبیق قوانین…</p>}
    {!loading&&(error||rules.length===0)&&<p role="status" className="rounded-lg bg-amber-50 p-2 text-xs leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="ml-1 inline h-4 w-4"/>{error||'قانون معتبری برای ترتیب خودکار این چارت ثبت نشده؛ ترتیب فعلاً دستی است.'}
      <button type="button" onClick={()=>setRevision(x=>x+1)} className="mr-2 underline">بررسی مجدد</button>
    </p>}
    {copyState&&<p role="status" aria-live="polite" className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-200">{copyState}</p>}
    {queue.steps.length===0&&<p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm dark:border-slate-700">هنوز درسی انتخاب نکرده‌ای؛ ابتدا درس و گروه را از بخش دروس ارائه‌شده اضافه کن.</p>}
    <ol className="space-y-1.5" aria-label="ترتیب ثبت دروس">
      {queue.steps.map((step,index)=>{
        const done=doneIds.includes(step.courseId);
        const offering=evaluations.find(o=>o.offeringId===step.offeringId);
        const locked=step.dependencyCourseIds.some(id=>!doneIds.includes(id));
        const time=[offering?.dayOfWeek,offering?.startTime&&offering?.endTime?`${offering.startTime}–${offering.endTime}`:''].filter(Boolean).join(' · ');
        return <li key={step.courseId} className={`flex min-w-0 flex-wrap items-center gap-2 rounded-xl border px-2 py-2 sm:flex-nowrap ${done
          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
          <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-slate-500 dark:text-slate-300">{step.effectiveRank}</span>
          <div className="min-w-[9rem] flex-1 text-right">
            <strong className="block truncate text-[13px] font-bold leading-6 text-slate-900 dark:text-slate-100">{step.courseName}</strong>
            <span className="block truncate text-[11px] leading-5 text-slate-500 dark:text-slate-300">
              {offering?.instructor||'استاد نامشخص'} · {time||'ساعت نامشخص'} · گروه {step.groupCode||'؟'}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" disabled={index===0} onClick={()=>move(index,-1)} aria-label={`انتقال ${step.courseName} به بالا`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"><ArrowUp className="h-4 w-4"/></button>
            <button type="button" disabled={index===queue.steps.length-1} onClick={()=>move(index,1)} aria-label={`انتقال ${step.courseName} به پایین`}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"><ArrowDown className="h-4 w-4"/></button>
            <button type="button" disabled={!step.copyCode||locked} onClick={()=>void copy(step.copyCode,step.courseName)}
              aria-label={`کپی کد ${step.courseName}`}
              className="flex min-h-9 items-center gap-1 rounded-lg bg-blue-700 px-2.5 text-xs font-bold text-white disabled:opacity-45">
              <ClipboardCopy className="h-3.5 w-3.5"/><span>کپی</span>
            </button>
            <button type="button" onClick={()=>toggleDone(step.courseId)} disabled={!done&&locked} aria-pressed={done}
              aria-label={done?`لغو علامت ثبت ${step.courseName}`:`علامت ثبت ${step.courseName}`}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border disabled:opacity-40 ${done?'border-emerald-500 bg-emerald-100 text-emerald-800 dark:bg-emerald-900':'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}>
              {done?<CheckCheck className="h-4 w-4"/>:<Check className="h-4 w-4"/>}
            </button>
          </div>
          {(step.warnings.length>0||step.dependencyNames.length>0||step.copyCode?.startsWith('DEMO-'))&&
            <details className="w-full text-xs text-amber-800 dark:text-amber-300">
              <summary className="cursor-pointer px-8 py-1 font-semibold">جزئیات کد و وابستگی‌ها</summary>
              <div className="space-y-1 px-8 pb-2 leading-6">
                <p>کد: <code dir="ltr">{step.copyCode||'نامشخص'}</code> · گروه: <code dir="ltr">{step.groupCode||'نامشخص'}</code></p>
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
