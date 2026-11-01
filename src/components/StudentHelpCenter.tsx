import React, { useState } from 'react';
import { Bug, MessageCircle, ShieldCheck } from 'lucide-react';
import { SupportPanel } from './SupportPanel';
import { BugReportPanel } from './BugReportPanel';

/** Tickets and bug reports share one destination without merging different backend records. */
export const StudentHelpCenter: React.FC = () => {
  const [kind,setKind]=useState<'tickets'|'bugs'>('tickets');
  return <section dir="rtl" className="darschin-page space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white"><MessageCircle className="h-5 w-5 text-blue-600" /> مرکز پشتیبانی و گزارش خطا</h2>
      <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">درخواست آموزشی و گزارش خطای سایت را از همین صفحه ثبت و پیگیری کن.</p>
      <div role="tablist" aria-label="نوع درخواست" className="mt-3 flex flex-wrap gap-2">
        <button type="button" role="tab" aria-selected={kind==='tickets'} onClick={()=>setKind('tickets')}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold ${kind==='tickets'?'border-blue-600 bg-blue-700 text-white':'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}>
          <MessageCircle className="h-4 w-4"/> تیکت و درخواست
        </button>
        <button type="button" role="tab" aria-selected={kind==='bugs'} onClick={()=>setKind('bugs')}
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold ${kind==='bugs'?'border-blue-600 bg-blue-700 text-white':'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}>
          <Bug className="h-4 w-4"/> گزارش خطای سامانه
        </button>
      </div>
    </div>
    <div role="tabpanel" aria-label={kind==='tickets'?'تیکت‌ها و درخواست‌ها':'گزارش خطاهای سایت'}>
      {kind==='tickets'?<SupportPanel/>:<BugReportPanel/>}
    </div>
    <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300"><ShieldCheck className="h-4 w-4"/> این دو نوع درخواست از یک صفحه در دسترس‌اند؛ سوابق هرکدام محفوظ است.</p>
  </section>;
};
