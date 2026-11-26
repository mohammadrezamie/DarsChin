import React from 'react';
import type {DemandParticipationStats} from '../domain/course-demand';

const fa=(value:number)=>value.toLocaleString('fa-IR');
export function DemandParticipationReport({stats}:{stats:DemandParticipationStats}){
  const cards=[
    ['دارای درس درخواستی',stats.withCourseRequests],
    ['بدون درس درخواستی',stats.withoutCourseRequests],
    ['مجموع تقاضاهای درسی',stats.totalCourseRequests],
  ] as const;
  const graduation=[
    ['بله',stats.graduationYes],['خیر',stats.graduationNo],['نامشخص',stats.graduationUnknown],
  ] as const;
  const total=stats.withCourseRequests+stats.withoutCourseRequests;
  return <section aria-label="تحلیل مشارکت پاسخ‌دهندگان" className="space-y-3">
    <h4 className="text-sm font-black">تحلیل مشارکت پاسخ‌دهندگان</h4>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cards.map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <strong className="mt-1 block text-xl font-black">{fa(value)}</strong>
      </div>)}
    </div>
    <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
      {total>0?'میانگین تقاضای درسی به ازای هر پاسخ‌دهنده: '+(stats.totalCourseRequests/total).toLocaleString('fa-IR',{maximumFractionDigits:1}):'هنوز پاسخی برای محاسبهٔ میانگین ثبت نشده است.'}
      {' '}این آمار فقط پاسخ‌های ثبت‌شده را پوشش می‌دهد؛ نرخ مشارکت کل دانشجویان نیست.
    </p>
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <h5 className="text-xs font-black">خوداظهاری ترم آخر</h5>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {graduation.map(([label,value])=><div key={label} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
          <dt className="text-xs">{label}</dt><dd className="text-lg font-bold">{fa(value)}</dd>
        </div>)}
      </dl>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">خوداظهاری دانشجو به معنی تأیید رسمی فارغ‌التحصیلی نیست.</p>
    </div>
  </section>;
}
