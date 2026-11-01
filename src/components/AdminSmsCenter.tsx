import React, { useEffect, useState } from 'react';
import { MessageSquare, RefreshCw, ShieldCheck, Send, ClipboardList } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';

type SmsStatus = {
  mode:'log'|'niazpardaz';senderLine:string;otpTemplate:string;
  readiness: {
    senderConfigured:boolean;apiKeyConfigured:boolean;providerTemplateApproved:boolean;
    canDeliver:boolean;logMode:boolean;
  };
};
type SmsHistoryRow={
  id:string;purpose:string;recipientMasked:string;status:string;createdAt:string;
  provider:string;providerResultCode?:number;
};

export const AdminSmsCenter: React.FC = () => {
  const {user}=useAuth();
  const allowed=Boolean(user?.roles.includes('super-admin') ||
    (user?.roles.includes('admin') && user.permissions?.includes('sms.manage')));
  const [settings,setSettings]=useState<SmsStatus|null>(null);
  const [history,setHistory]=useState<SmsHistoryRow[]>([]);
  const [mode,setMode]=useState<'log'|'niazpardaz'>('log');
  const [line,setLine]=useState('');
  const [template,setTemplate]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const reload=async()=>{
    setError('');
    const [cfg,log]=await Promise.all([
      apiRequest<SmsStatus>('/api/sms-center/settings'),
      apiRequest<SmsHistoryRow[]>('/api/sms-center/history'),
    ]);
    if(!cfg.success || !cfg.data){setError(cfg.error||'اتصال به مرکز پیامک برقرار نشد.');return}
    setSettings(cfg.data);setMode(cfg.data.mode);setLine(cfg.data.senderLine);
    setTemplate(cfg.data.otpTemplate);
    if(log.success) setHistory(log.data||[]);
  };
  useEffect(()=>{if(allowed)void reload()},[allowed]);

  const save=async()=>{
    setBusy(true);setError('');setMessage('');
    try{
      const result=await apiRequest<SmsStatus>('/api/sms-center/settings',{
        method:'PUT',body:JSON.stringify({mode,senderLine:line,otpTemplate:template}),
      });
      if(!result.success){setError(result.error||'ثبت تنظیمات ناموفق بود.');return}
      setMessage('تنظیمات ذخیره شدند. تغییر حالت به «واقعی» تنها پس از تأیید الگو و تنظیم API Key باعث ارسال خواهد شد.');
      await reload();
    }finally{setBusy(false)}
  };
  if(!allowed)return <p className="darschin-surface p-5 text-sm">برای مشاهدهٔ مرکز پیامک مجوز sms.manage لازم است.</p>;
  return <div dir="rtl" className="darschin-page space-y-5">
    <header className="darschin-surface p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-black text-slate-950 dark:text-white">
        <MessageSquare className="h-6 w-6 text-blue-700 dark:text-blue-300"/> مرکز یکپارچهٔ پیامک درس‌چین
      </h2>
      <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
        تنظیم الگوی پیامک ورود و بازیابی، وضعیت اتصال نیازپرداز و سابقهٔ ارسالها بدون نمایش کد OTP یا کلید محرمانه.
      </p>
    </header>
    {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
    {message&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{message}</p>}
    <section className="darschin-surface space-y-4 p-4 sm:p-6">
      <h3 className="text-base font-black">وضعیت اتصال</h3>
      {!settings?<p className="text-sm text-slate-500">در حال خواندن تنظیمات…</p>:(
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['حالت ارسال',settings.mode==='log'?'آزمایشی — بدون تحویل':'نیازپرداز — واقعی'],
            ['کلید محرمانه نیازپرداز',settings.readiness.apiKeyConfigured?'روی سرور تنظیم شده':'تنظیم نشده'],
            ['شماره فرستنده',settings.readiness.senderConfigured?'تعریف شده':'تعریف نشده'],
            ['تأیید الگوی پیام توسط ارائه‌دهنده',settings.readiness.providerTemplateApproved?'تأیید دستی ثبت شده':'منتظر تأیید'],
            ['آمادگی تحویل واقعی',settings.readiness.canDeliver?'آماده':'آماده نیست'],
          ].map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <span className="block text-xs font-bold text-slate-500 dark:text-slate-300">{label}</span>
            <strong className="mt-1 block text-sm">{value}</strong>
          </div>)}
        </div>
      )}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-6 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <ShieldCheck className="ml-2 inline-block h-4 w-4"/>
        API Key فقط در فایل محیط سرور قرار می‌گیرد؛ هیچ ورودی یا خروجی از این پنل آن را نمایش نمی‌دهد.
      </div>
    </section>
    <section className="darschin-surface space-y-4 p-4 sm:p-6">
      <h3 className="text-base font-black">تنظیمات مسیر واحد ارسال</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold">حالت
          <select className="darschin-field mt-2" value={mode} onChange={e=>setMode(e.target.value as 'log'|'niazpardaz')}>
            <option value="log">آزمایشی / بدون پیامک واقعی</option>
            <option value="niazpardaz">ارسال واقعی با نیازپرداز</option>
          </select>
        </label>
        <label className="block text-sm font-bold">شماره یا خط فرستنده
          <input dir="ltr" inputMode="numeric" className="darschin-field mt-2" value={line} onChange={e=>setLine(e.target.value)} placeholder="شماره فرستندهٔ تأییدشده"/>
        </label>
      </div>
      <label className="block text-sm font-bold">قالب کد یک‌بارمصرف
        <textarea className="darschin-field mt-2 min-h-28" rows={3} value={template} onChange={e=>setTemplate(e.target.value)} />
      </label>
      <p className="text-xs leading-6 text-slate-500 dark:text-slate-300">
        فقط یک متغیر <code dir="ltr">{'{code}'}</code> مجاز است. متنِ ارسال واقعی باید قبلاً در پنل ارائه‌دهنده تأیید شده باشد.
      </p>
      <button disabled={busy||!settings} type="button" onClick={()=>void save()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white disabled:opacity-60"><Send className="h-4 w-4"/> ذخیره تنظیمات</button>
    </section>
    <section className="darschin-surface space-y-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-black"><ClipboardList className="h-5 w-5"/> تاریخچهٔ ۲۰۰ ارسال اخیر</h3>
        <button type="button" onClick={()=>void reload()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-bold dark:border-slate-700"><RefreshCw className="h-4 w-4"/> به‌روزرسانی</button>
      </div>
      {!history.length?<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">هنوز گزارشی ثبت نشده است.</p>:(
        <div className="darschin-scroll-x">
          <table className="w-full min-w-[580px] text-right text-xs sm:text-sm">
            <thead><tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="p-3">زمان</th><th className="p-3">گیرندهٔ مخفی‌شده</th><th className="p-3">نوع</th><th className="p-3">وضعیت</th><th className="p-3">کانال</th>
            </tr></thead>
            <tbody>{history.map(item=><tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="p-3">{new Date(item.createdAt).toLocaleString('fa-IR')}</td>
              <td dir="ltr" className="p-3">{item.recipientMasked}</td>
              <td className="p-3">{item.purpose==='login'?'ورود':'بازیابی رمز'}</td>
              <td className="p-3">{item.status}</td><td className="p-3">{item.provider}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  </div>;
};
