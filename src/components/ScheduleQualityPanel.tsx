import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, GraduationCap, Info, Sparkles } from 'lucide-react';
import type { CourseEligibilityResult } from '../types';
import { apiRequest } from '../utils/api';
import { evaluateScheduleQuality } from '../domain/schedule-quality';
import type { TeacherRatingSummary } from '../domain/teacher-ratings';

interface Props {
  evaluations:CourseEligibilityResult[];
  selectedOfferingIds:string[];
  onApplySuggestedSchedule?: (offeringIds:string[])=>Promise<boolean>;
  demo?:boolean;
}
const btn='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-bold dark:border-slate-700';

export const ScheduleQualityPanel:React.FC<Props>=({
  evaluations,selectedOfferingIds,onApplySuggestedSchedule,demo=false,
})=>{
  const [ratings,setRatings]=useState<TeacherRatingSummary[]>([]);
  const [ratingLoading,setRatingLoading]=useState(false);
  const [ratingProblem,setRatingProblem]=useState('');
  const [mode,setMode]=useState<'days'|'teachers'>('days');
  const [applying,setApplying]=useState(false);
  const [message,setMessage]=useState('');
  const selectedCourses=useMemo(()=>[...new Set(evaluations.filter(e=>selectedOfferingIds.includes(e.offeringId))
    .map(e=>e.courseId))],[evaluations,selectedOfferingIds]);
  const selectedKey=selectedCourses.join('|');
  useEffect(()=>{
    if(!demo){setRatings([]);setRatingProblem('ارزشیابی معتبر اساتید هنوز در نسخهٔ واقعی به سامانه متصل نیست؛ امتیاز جعلی نمایش نمی‌دهیم.');return;}
    if(!selectedCourses.length){setRatings([]);setRatingProblem('');return;}
    let mounted=true;
    setRatingLoading(true);
    setRatingProblem('');
    void Promise.all(selectedCourses.map(courseId=>
      apiRequest<TeacherRatingSummary[]>(`/api/demo/teacher-ratings?courseId=${encodeURIComponent(courseId)}`)))
      .then(responses=>{
        if(!mounted)return;
        const failed=responses.some(r=>!r.success||!Array.isArray(r.data));
        setRatings(responses.flatMap(r=>r.success&&Array.isArray(r.data)?r.data:[]));
        if(failed)setRatingProblem('بخشی از ارزشیابی‌های آزمایشی دریافت نشد؛ همان بخش در امتیاز محاسبه نشده است.');
      }).catch(()=>{if(mounted){setRatings([]);setRatingProblem('خطا در دریافت ارزشیابی آزمایشی.');}})
      .finally(()=>{if(mounted)setRatingLoading(false);});
    return()=>{mounted=false};
  },[demo,selectedKey]);
  const quality=useMemo(()=>evaluateScheduleQuality(
    evaluations,selectedOfferingIds,ratings,
  ),[evaluations,selectedOfferingIds,ratings]);
  const suggested=mode==='days'?quality.recommendedFewestDays:quality.recommendedTeachers;
  const changed=suggested.length>0&&(
    suggested.length!==selectedOfferingIds.length||
    suggested.some(id=>!selectedOfferingIds.includes(id)));
  const proposal=suggested.map(id=>evaluations.find(e=>e.offeringId===id)).filter(
    (e):e is CourseEligibilityResult=>!!e);
  const apply=async()=>{
    if(!onApplySuggestedSchedule||!changed||applying)return;
    setApplying(true);setMessage('');
    try {
      const applied=await onApplySuggestedSchedule(suggested);
      setMessage(applied?'پیشنهاد در برنامه ذخیره شد؛ زمان‌ها و تداخل‌ها را دوباره بررسی کن.':
        'پیشنهاد ذخیره نشد؛ برنامهٔ قبلی محفوظ مانده است.');
    } catch {
      setMessage('اتصال برای ذخیره‌سازی برقرار نشد؛ برنامهٔ قبلی محفوظ است.');
    } finally {setApplying(false);}
  };

  return <section dir="rtl" aria-label="ارزیابی کیفیت برنامه" className="min-w-0 space-y-3 rounded-2xl border border-blue-200 bg-white p-3 dark:border-blue-900 dark:bg-slate-900 sm:p-4">
    <header>
      <h3 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white">
        <Sparkles className="h-5 w-5 text-blue-600"/> کیفیت چیدمان انتخاب واحد
      </h3>
      <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
        دو معیار مستقل برای بهترچیدن گروه‌های همین درس‌ها؛ امتیازِ برنامه است، نه نمرهٔ دانشجو یا مجوز آموزشی.
      </p>
    </header>
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-950/30">
        <p className="flex items-center gap-1 text-xs font-bold text-blue-950 dark:text-blue-100">
          <CalendarDays className="h-4 w-4"/> فشردگی روزهای دانشگاه
        </p>
        <p className="mt-2 text-2xl font-black tabular-nums text-blue-800 dark:text-blue-200">
          {quality.dayScore===null?'نامشخص':`${quality.dayScore} / ۱۰۰`}
        </p>
        <p className="mt-1 text-xs leading-6 text-blue-900 dark:text-blue-100">
          روزهای فعلی: {quality.activeDays??'؟'} · کمترین: {quality.minimumDays??'؟'} · بیشترین: {quality.maximumDays??'؟'}
          {!quality.searchedExactly&&quality.minimumDays!==null?' (برآورد)':''}
        </p>
      </div>
      <div className="rounded-xl bg-violet-50 p-3 dark:bg-violet-950/30">
        <p className="flex items-center gap-1 text-xs font-bold text-violet-950 dark:text-violet-100">
          <GraduationCap className="h-4 w-4"/> امتیاز استادهای منتخب
        </p>
        <p className="mt-2 text-2xl font-black tabular-nums text-violet-800 dark:text-violet-200">
          {ratingLoading?'در حال بررسی':quality.professorScore===null?'بدون داده':`${quality.professorScore} / ۱۰۰`}
        </p>
        <p className="mt-1 text-xs leading-6 text-violet-900 dark:text-violet-100">
          پوشش: {quality.ratedCount} از {quality.selectedCount} درس · {quality.ratingVotes} رأی منتشرشده
        </p>
      </div>
    </div>
    <p className="text-xs leading-7 text-slate-600 dark:text-slate-300">
      <Info className="ml-1 inline h-3.5 w-3.5"/> {quality.dayReason} {quality.teacherReason}
    </p>
    {ratingProblem&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{ratingProblem}</p>}
    {demo&&<p className="text-xs font-bold text-amber-700 dark:text-amber-300">ارزشیابی استادها فقط دادهٔ ساختگیِ محیط دمو است؛ دربارهٔ استادان واقعی قضاوت نمی‌کند.</p>}
    <div className="flex flex-wrap gap-2" role="group" aria-label="نوع پیشنهاد چیدمان">
      <button type="button" aria-pressed={mode==='days'} onClick={()=>setMode('days')}
        className={btn+(mode==='days'?' border-blue-700 bg-blue-700 text-white':'')}>کمترین روز حضور</button>
      <button type="button" aria-pressed={mode==='teachers'} onClick={()=>setMode('teachers')}
        className={btn+(mode==='teachers'?' border-blue-700 bg-blue-700 text-white':'')}>استادهای با امتیاز بالاتر</button>
    </div>
    {suggested.length>0?<div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
      <p className="text-xs font-black">پیشنهاد بر پایهٔ {mode==='days'?'کمترین روز حضور':'امتیاز منتشرشدهٔ استادها'}</p>
      {mode==='days'&&<p className="text-xs text-slate-500 dark:text-slate-300">
        {quality.suggestedDays} روز حضور {quality.searchedExactly?'در بررسی کامل گروه‌های دارای ساعت':'در جست‌وجوی محدود'}
      </p>}
      {mode==='teachers'&&<p className="text-xs text-slate-500 dark:text-slate-300">
        امتیاز پیشنهادی استادها: {quality.suggestedProfessorScore??'نامشخص'} / ۱۰۰
      </p>}
      <ul className="grid gap-1 text-xs sm:grid-cols-2">
        {proposal.map(e=><li key={e.offeringId} className="min-w-0 rounded-lg bg-white px-3 py-2 leading-6 dark:bg-slate-900">
          <strong className="block break-words">{e.courseName}</strong>
          <span className="break-words text-slate-600 dark:text-slate-300">{e.instructor||'استاد نامشخص'} · {e.dayOfWeek} {e.startTime}–{e.endTime} · گروه {e.groupCode}</span>
        </li>)}
      </ul>
      {onApplySuggestedSchedule&&<button type="button" onClick={()=>void apply()}
        disabled={!changed||applying} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-bold text-white disabled:opacity-50">
        <Check className="h-4 w-4"/>{applying?'در حال ذخیره…':changed?'اعمال این ترکیب در برنامه':'همین ترکیب اکنون انتخاب شده'}
      </button>}
    </div>:<p className="rounded-xl border border-dashed border-slate-300 p-3 text-xs leading-7 text-slate-600 dark:border-slate-700 dark:text-slate-300">
      {mode==='teachers'?'برای پیشنهاد براساس استاد، باید همهٔ درس‌های انتخابی امتیاز معتبر و منتشرشده داشته باشند.':
        'تا وقتی زمان همهٔ گروه‌های اصلی مشخص و بدون تداخل نباشد، پیشنهاد خودکار کم‌روز نمایش داده نمی‌شود.'}
    </p>}
    {message&&<p role="status" className="text-xs font-bold text-blue-700 dark:text-blue-300">{message}</p>}
  </section>;
};
