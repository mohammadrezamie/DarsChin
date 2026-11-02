import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Sparkles } from 'lucide-react';
import type { CourseEligibilityResult } from '../types';
import { suggestSmartSchedules, type PresenceDays, type ScheduleCriterion } from '../domain/smart-schedule';

interface Props {
  chosenCourseIds: string[];
  coursePriorities: string[];
  evaluations: CourseEligibilityResult[];
  offeringPriorities: Record<string,string[]>;
  busy: boolean;
  onApply: (ids: string[]) => Promise<boolean>;
}
/** A suggestion is a local preview until the student explicitly confirms it. */
export const SmartScheduleBuilder: React.FC<Props> = ({
  chosenCourseIds,coursePriorities,evaluations,offeringPriorities,busy,onApply,
}) => {
  const [maxDays,setMaxDays]=useState<PresenceDays>(3);
  const [criterion,setCriterion]=useState<ScheduleCriterion>('fewest-days');
  const [show,setShow]=useState(false);
  const [applying,setApplying]=useState(false);
  const [feedback,setFeedback]=useState('');
  const results=useMemo(()=>show?suggestSmartSchedules({
    chosenCourseIds,coursePriorities,evaluations,offeringPriorities,maxDays,criterion,
  }):null,[show,chosenCourseIds,coursePriorities,evaluations,offeringPriorities,maxDays,criterion]);
  const apply=async(ids:string[])=>{
    if(busy||applying)return;
    setFeedback('');setApplying(true);
    try {
      const ok=await onApply(ids);
      setFeedback(ok?'ترکیب پیشنهادی با بررسی سرور در برنامه ذخیره شد.':'ترکیب ذخیره نشد؛ دلیل را در پیام خطای برنامه بررسی کن.');
    } catch {setFeedback('ذخیره انجام نشد؛ برنامهٔ قبلی حفظ شده است.');}
    finally {setApplying(false);}
  };
  return <section dir="rtl" aria-label="ساخت برنامهٔ پیشنهادی" className="rounded-2xl border border-teal-200 bg-teal-50/50 p-3 dark:border-teal-900 dark:bg-teal-950/20 sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-black text-teal-950 dark:text-teal-100">
          <Sparkles className="h-5 w-5"/> ساخت خودکار برنامهٔ پیشنهادی
        </h3>
        <p className="mt-1 text-xs leading-6 text-slate-700 dark:text-slate-300">
          ترکیب کامل درس‌های انتخابی را با حداقل روز حضور، فاصلهٔ کلاس و اولویت استاد خودت بررسی کن؛ بدون تداخل قطعی.
        </p>
      </div>
      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-teal-900 dark:bg-slate-900 dark:text-teal-200">بدون ثبت خودکار دانشگاه</span>
    </div>
    <fieldset className="mt-3 flex flex-wrap gap-1.5" aria-label="حداکثر روز حضور در هفته">
      {([2,3,4,5] as PresenceDays[]).map(n=><button key={n} type="button" disabled={busy||applying}
        aria-pressed={maxDays===n} onClick={()=>{setMaxDays(n);setFeedback('');}}
        className={'min-h-11 rounded-xl border px-3 text-xs font-black disabled:opacity-50 '+(maxDays===n?
          'border-teal-800 bg-teal-800 text-white':'border-teal-200 bg-white text-teal-900 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-200')}>
        حداکثر {n.toLocaleString('fa-IR')} روز
      </button>)}
    </fieldset>
    <label className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
      شیوهٔ اولویت‌بندی
      <select value={criterion} disabled={busy||applying}
        onChange={e=>{setCriterion(e.target.value as ScheduleCriterion);setFeedback('');}}
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-teal-300 bg-white px-3 text-xs text-slate-900 dark:border-teal-800 dark:bg-slate-900 dark:text-white">
        <option value="fewest-days">کمترین روز و فاصلهٔ بین کلاس‌ها</option>
        <option value="my-teachers">اولویت استادهایی که خودم تعیین کردم</option>
      </select>
    </label>
    <p className="mt-2 text-[11px] leading-6 text-slate-600 dark:text-slate-300">
      امتیاز عمومی معتبر استادها هنوز متصل نیست؛ این حالت فقط ترتیب استادهای انتخابی خودت را مبنا می‌گیرد.
      گروه بدون زمان کلاس تأییدشده وارد پیشنهاد قطعی نمی‌شود.
    </p>
    <button type="button" disabled={!chosenCourseIds.length||busy||applying}
      onClick={()=>{setShow(true);setFeedback('');}}
      className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-800 px-4 text-xs font-black text-white disabled:opacity-50">
      <CalendarDays className="h-4 w-4"/> پیشنهاد برنامه‌ها
    </button>
    {results&&<div className="mt-3 space-y-2" aria-live="polite">
      {(results.missingCourseIds.length>0||results.unverifiedTimeCourseIds.length>0)&&
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-6 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
          {results.missingCourseIds.length.toLocaleString('fa-IR')} درس گروه مجاز ندارد؛
          {results.unverifiedTimeCourseIds.length.toLocaleString('fa-IR')} درس هم زمان معتبر ندارد.
          اول این موارد را بررسی کن تا برنامهٔ کامل ساخته شود.
        </p>}
      {!results.options.length&&!results.missingCourseIds.length&&!results.unverifiedTimeCourseIds.length&&
        <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
          ترکیب کامل در این جستجوی محدود پیدا نشد. سقف روز حضور را افزایش بده؛ عدم نتیجه اثباتِ ناممکن‌بودن نیست.
        </p>}
      {results.approximate&&<p className="text-[11px] text-amber-800 dark:text-amber-200">برای سرعت موبایل، جستجو محدود شده؛ ممکن است گزینه‌های دیگری هم وجود داشته باشند.</p>}
      {results.options.map((option,index)=><article key={option.offeringIds.join('|')}
        className="rounded-xl border border-teal-200 bg-white p-3 dark:border-teal-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-xs text-slate-950 dark:text-white">گزینه {(index+1).toLocaleString('fa-IR')} · {option.days.length.toLocaleString('fa-IR')} روز حضور</strong>
          <span className="text-[11px] text-slate-600 dark:text-slate-300">{option.days.join('، ')} · فاصلهٔ بین کلاس‌ها {option.gapsMinutes.toLocaleString('fa-IR')} دقیقه</span>
        </div>
        <ol className="mt-2 space-y-1 text-[11px] leading-6 text-slate-700 dark:text-slate-200">
          {option.offerings.map(o=><li key={o.offeringId}>
            {o.courseName} — {o.instructor||'استاد نامشخص'}، گروه {o.groupCode}، {o.dayOfWeek} {o.startTime} تا {o.endTime}
          </li>)}
        </ol>
        <button type="button" disabled={busy||applying} onClick={()=>void apply(option.offeringIds)}
          className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-3 text-xs font-black text-white disabled:opacity-50">
          <CheckCircle2 className="h-4 w-4"/> اعمال این ترکیب در برنامه من
        </button>
      </article>)}
    </div>}
    {feedback&&<p role="status" className="mt-2 rounded-lg bg-white p-2 text-xs font-bold text-teal-900 dark:bg-slate-900 dark:text-teal-100">{feedback}</p>}
  </section>;
};
