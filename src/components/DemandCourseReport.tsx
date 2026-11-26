import React,{useState} from 'react';
import {
  demandCourseGap,demandCourseReportTotals,demandCourseStatus,filterDemandCourseReport,
  type DemandCourseReportRow,type DemandCourseSort,type DemandCourseStatus,
} from '../domain/demand-course-report';

const statusLabels:Record<DemandCourseStatus,string>={
  met:'رسیده به حدنصاب پیشنهادی',below:'کمتر از حدنصاب پیشنهادی',unset:'بدون حدنصاب',
};
const filters:readonly (DemandCourseStatus|'all')[]=['all','met','below','unset'];
const fa=(n:number)=>n.toLocaleString('fa-IR');

export function DemandCourseReport({rows}:{rows:readonly DemandCourseReportRow[]}){
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState<DemandCourseStatus|'all'>('all');
  const [sort,setSort]=useState<DemandCourseSort>('demand');
  const totals=demandCourseReportTotals(rows);
  const filtered=filterDemandCourseReport(rows,query,status,sort);
  return <section aria-label="تصمیم‌یار عرضهٔ درس" className="space-y-3">
    <div>
      <h4 className="text-sm font-black">تصمیم‌یار عرضهٔ درس</h4>
      <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">
        {fa(totals.requested)} درس از {fa(rows.length)} درس دست‌کم یک تقاضا دارد.
        رسیدن به حدنصاب فقط یک شاخص پیشنهادی است و به معنی تصویب یا تشکیل کلاس نیست.
      </p>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {filters.map(key=><button key={key} type="button" aria-pressed={status===key}
        onClick={()=>setStatus(key)}
        className={'min-h-16 rounded-xl border p-2 text-start text-xs font-bold '+(status===key
          ?'border-teal-600 bg-teal-50 text-teal-950 dark:bg-teal-950 dark:text-teal-100'
          :'border-slate-200 dark:border-slate-700')}>
        <span className="block text-xl font-black">{fa(key==='all'?rows.length:totals[key])}</span>
        {key==='all'?'همهٔ درس‌ها':statusLabels[key]}
      </button>)}
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs font-bold">جست‌وجوی نام یا کد درس
        <input type="search" value={query} onChange={e=>setQuery(e.target.value)}
          className="darschin-field mt-1 min-h-11 w-full" placeholder="مثلاً ریاضی یا کد درس"/>
      </label>
      <label className="text-xs font-bold">ترتیب نمایش
        <select value={sort} onChange={e=>setSort(e.target.value as DemandCourseSort)}
          className="darschin-field mt-1 min-h-11 w-full">
          <option value="demand">بیشترین تقاضا</option>
          <option value="gap">نزدیک‌ترین درس به حدنصاب</option>
          <option value="final">بیشترین خوداظهاری ترم آخر</option>
          <option value="name">نام درس</option>
        </select>
      </label>
    </div>
    <p aria-live="polite" className="text-xs text-slate-500">{fa(filtered.length)} درس در نتیجه</p>
    {!filtered.length&&<p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">
      در این فیلتر درسی وجود ندارد.
      <button type="button" onClick={()=>{setStatus('all');setQuery('');}}
        className="ms-2 min-h-11 font-bold text-teal-700 dark:text-teal-300">پاک کردن فیلترها</button>
    </p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map(row=>{
        const state=demandCourseStatus(row),gap=demandCourseGap(row);
        return <article key={row.courseId} className="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h5 className="break-words text-sm font-black">{row.name}</h5>
          {row.code&&<p className="mt-1 text-xs text-slate-500" dir="ltr">{row.code}</p>}
          <div className="mt-3 flex items-end justify-between gap-2">
            <strong className="text-2xl font-black text-teal-800 dark:text-teal-300">{fa(row.count)} <span className="text-xs">تقاضا</span></strong>
            <span className="text-xs text-slate-500">حدنصاب: {row.threshold>0?fa(row.threshold):'تعریف نشده'}</span>
          </div>
          {row.threshold>0&&<div role="progressbar" aria-label="پیشرفت تا حدنصاب پیشنهادی"
            aria-valuemin={0} aria-valuemax={row.threshold} aria-valuenow={Math.min(row.count,row.threshold)}
            className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-teal-700" style={{width:Math.min(100,row.count/row.threshold*100)+'%'}}/>
          </div>}
          <p className="mt-2 text-xs font-bold">{statusLabels[state]}</p>
          {gap!==null&&gap>0&&<p className="mt-1 text-xs">فاصله تا حدنصاب: {fa(gap)} تقاضا</p>}
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">خوداظهاری ترم آخر: {fa(row.selfReportedFinalSemester)}</p>
        </article>;
      })}
    </div>
  </section>;
}
