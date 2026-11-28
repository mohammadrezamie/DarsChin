import React, { useState } from 'react';
import type { Curriculum, CurriculumCourse, Course, Track } from '../types';
import { buildCurriculumSemesterPreview, type PreviewCourse } from '../domain/curriculum-semester-preview';

const labels={MAJOR_REQUIRED:'رشته‌ای اجباری',MAJOR_ELECTIVE:'رشته‌ای اختیاری',TRACK_REQUIRED:'گرایشی اجباری',TRACK_ELECTIVE:'گرایشی اختیاری'};
const fa=(value:number)=>value.toLocaleString('fa-IR');

export function CurriculumSemesterPreview({chart,assignments,courses,tracks}:{
  chart:Curriculum;assignments:CurriculumCourse[];courses:Course[];tracks:Track[];
}){
  const [trackId,setTrackId]=useState<string|null>(null);
  const relevant=tracks.filter(t=>t.majorId===chart.majorId&&t.active);
  const preview=buildCurriculumSemesterPreview(chart.id,chart.majorId,assignments,courses,relevant,trackId);
  const row=(item:PreviewCourse)=>(
    <li key={item.courseId} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="break-words text-sm font-bold text-slate-900 dark:text-white">{item.course?.name||'درس نامشخص'}</p>
      <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-300">{item.course?.code||item.courseId} · {item.course&&Number.isFinite(item.course.units)?fa(item.course.units)+' واحد کاتالوگ':'واحد نامشخص'}</p>
      <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
        {item.assignments.map(a=><span key={a.id} className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">
          {a.trackId?relevant.find(t=>t.id===a.trackId)?.name||'گرایش نامعتبر':'مشترک'} · {labels[a.classification]||'دسته نامشخص'}
        </span>)}
      </div>
      {item.needsReview&&<p className="mt-2 text-xs font-bold text-amber-800 dark:text-amber-200">نیازمند بازبینی انتساب، درس یا نیمسال؛ در برنامهٔ پیشنهادی قرار نگرفت.</p>}
    </li>
  );
  return <section aria-label="پیش‌نمایش نیمسال‌های چارت" className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="font-black text-slate-900 dark:text-white">نمای نیمسال‌به‌نیمسال</h3>
        <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">نمای پیشنهادی از انتساب‌های فعلی؛ نه مصوبه، نه تضمین ارائهٔ درس یا مجوز انتخاب واحد.</p></div>
      <label className="text-xs font-bold text-slate-700 dark:text-slate-200">گرایش پیش‌نمایش
        <select className="mt-1 block min-h-11 max-w-full rounded-xl border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={trackId||''} onChange={e=>setTrackId(e.target.value||null)}>
          <option value="">فقط دروس مشترک</option>
          {relevant.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
    </div>
    {!preview.scopeValid?<p role="alert" className="text-sm text-amber-800 dark:text-amber-200">گرایش معتبر نیست؛ دوباره انتخاب کنید.</p>:<>
      <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
        <span>{fa(preview.totalCourses)} درس یکتا</span><span>{fa(preview.groups.length)} نیمسال دارای پیشنهاد</span>
        <span>{fa(preview.unplanned.length)} بدون جایگاه معتبر</span>
        {preview.reviewCount>0&&<span className="font-bold text-amber-800 dark:text-amber-200">{fa(preview.reviewCount)} نیازمند بازبینی</span>}
        {preview.inactiveCount>0&&<span>{fa(preview.inactiveCount)} انتساب غیرفعال پنهان شده</span>}
      </div>
      {!preview.totalCourses&&<p className="text-sm text-slate-500">در این دامنه هنوز درسی تعریف نشده است.</p>}
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {preview.groups.map(group=><section key={group.semester} aria-label={'نیمسال '+fa(group.semester)} className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <h4 className="mb-2 text-sm font-black">نیمسال {fa(group.semester)}</h4>
          <ul className="space-y-2">{group.courses.map(row)}</ul>
        </section>)}
      </div>
      {preview.unplanned.length>0&&<section className="rounded-xl border border-amber-200 p-3 dark:border-amber-900">
        <h4 className="mb-2 text-sm font-bold">بدون نیمسال پیشنهادی معتبر</h4>
        <ul className="grid gap-2 sm:grid-cols-2">{preview.unplanned.map(row)}</ul>
      </section>}
      <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">تعداد نیمسال و واحد فارغ‌التحصیلی از این نما استنتاج نمی‌شود. واحد فعلی از کاتالوگ است، نه لزوماً نسخهٔ مصوب چارت.</p>
    </>}
  </section>;
}
