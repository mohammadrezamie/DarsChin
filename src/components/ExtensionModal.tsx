import React from 'react';
import { X, ExternalLink, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { academicPortal } from '../config/academic-portal';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMockPortal: () => void;
}

/** مسیر قدیمی نصب افزونه با راهنمای معیار جایگزین شده؛ قرارداد فراخوانی حفظ می‌شود. */
export const ExtensionModal: React.FC<ExtensionModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 overflow-y-auto">
      <div id="extensionModalContainer" role="dialog" aria-modal="true" aria-labelledby="academic-portal-title"
        className="darschin-dialog darschin-page bg-liquid-glass w-full max-w-lg rounded-2xl p-4 shadow-xl sm:p-6 relative my-4">
        <button id="btnCloseExtModal" type="button" aria-label="بستن پنجرهٔ افزونه" onClick={onClose}
          className="absolute top-3 left-3 flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <X className="h-5 w-5" aria-hidden="true"/>
        </button>
        <div className="flex items-start gap-3 pl-12">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true"/>
          </span>
          <div>
            <h2 id="academic-portal-title" className="text-lg font-bold">دریافت اطلاعات از سامانهٔ {academicPortal.name}</h2>
            <p className="mt-1 text-sm leading-7 text-slate-600 dark:text-slate-300">مرجع توسعهٔ جدید درس‌چین، معیار است.</p>
          </div>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-7">
          <p>اتصال مستقیم و استخراج خودکار از معیار هنوز تأیید نشده است. افزونهٔ قبلی برای معیار قابل استفاده معرفی نمی‌شود.</p>
          <p>برای برنامه‌ریزی، فایل استاندارد JSON، CSV یا TSV شامل اطلاعات مجاز دروس را از بخش «دریافت دروس» وارد کنید. تطبیق و انتشار نیازمند بررسی مدیر است؛ قالب بومی خروجی معیار هنوز تأیید نشده است.</p>
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true"/>
            <p>رمز، کد ملی و اطلاعات نشست سامانهٔ دانشگاهی را در درس‌چین وارد نکنید. وضعیت فعال‌بودن حساب را در خود معیار بررسی کنید.</p>
          </div>
        </div>
        <a href={academicPortal.studentUrl} target="_blank" rel="noopener noreferrer"
          className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800">
          ورود به سامانهٔ معیار <ExternalLink className="h-4 w-4" aria-hidden="true"/>
        </a>
      </div>
    </div>
  );
};
