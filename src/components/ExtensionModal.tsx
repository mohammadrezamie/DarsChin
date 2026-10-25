// ============================================================================
// DARSCHYN (درس‌چین) - Chrome Extension Download & Instructions Modal
// ============================================================================

import React from 'react';
import {
  X,
  DownloadCloud,
  Chrome,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  ExternalLink,
  Layers,
} from 'lucide-react';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMockPortal: () => void;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({
  isOpen,
  onClose,
  onOpenMockPortal,
}) => {
  const handleDownload = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/extension/download');
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'darschyn-chrome-extension-v3.3.4.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
      alert('خطا در دریافت فایل افزونه. لطفاً مجدداً تلاش کنید.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        id="extensionModalContainer"
        role="dialog"
        aria-modal="true"
        aria-label="افزونهٔ مرورگر درس‌چین"
        className="darschin-dialog darschin-page bg-liquid-glass w-full max-w-2xl rounded-3xl p-4 shadow-xl sm:p-6 relative my-4"
      >
        <button
          id="btnCloseExtModal"
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Chrome className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              افزونه مرورگر درس‌چین (Chrome Extension Manifest V3)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              استخراج خودکار، مطمئن و استاندارد دروس ارائه‌شده نیمسال بدون دخالت دستی
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>استخراج اختصاصی و هوشمند دروس از سامانه آموزشیار (دانشگاه آزاد اسلامی)</span>
            </div>
            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>تولید خودکار خروجی استاندارد JSON نسخه ۱.۰</span>
            </div>
            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>کاملاً امن: بدون دسترسی به رمز عبور یا تغییر در سامانه آموزشیار</span>
            </div>
            <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>تبدیل و نرمال‌سازی خودکار اعداد فارسی و روزها</span>
            </div>
          </div>

          {/* Installation Steps */}
          <div className="p-4 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2">
            <span className="font-bold text-slate-900 dark:text-white block">
              مراحل بارگذاری افزونه در مرورگر (Chrome / Edge / Brave):
            </span>
            <ol className="list-decimal pr-5 space-y-1 text-slate-700 dark:text-slate-300">
              <li>
                در مرورگر خود به نشانی <code className="bg-white/80 dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono">chrome://extensions</code> مراجعه کنید.
              </li>
              <li>
                گزینه <strong>Developer mode (حالت توسعه‌دهنده)</strong> را در بالای صفحه فعال نمایید.
              </li>
              <li>
                روی دکمه <strong>Load unpacked (بارگذاری افزونه بازشده)</strong> کلیک کنید.
              </li>
              <li>
                ابتدا فایل ZIP دانلود شده را در ویندوز استخراج (Extract) کنید. سپس در کروم، <strong>دقیقاً همان پوشه‌ای را انتخاب کنید که فایل <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded text-pink-600 dark:text-pink-400">manifest.json</code> مستقیماً داخل آن قرار دارد</strong>.
                <div className="mt-2 text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-800">
                  ⚠️ <strong>توجه:</strong> هرگز فایل یا پوشه `icons` را انتخاب نکنید! فقط پوشه اصلی حاوی فایل مانیفست را انتخاب کنید.
                </div>
              </li>
            </ol>
          </div>

          {/* Download and Mock Action Section */}
          <div className="p-4 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 dark:from-slate-800/90 dark:to-slate-900/90 rounded-2xl border border-blue-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="space-y-0.5 text-right w-full sm:w-auto">
              <span className="font-bold text-slate-900 dark:text-white text-sm block">
                دانلود بسته افزونه کروم (Manifest V3)
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-xs">
                حاوی فایل‌های کدهای محلی جهت بارگذاری در مرورگر
              </span>
            </div>
            <button
              id="btnDownloadExtensionZip"
              type="button"
              onClick={handleDownload}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <DownloadCloud className="w-4 h-4" />
              دانلود افزونه (ZIP)
            </button>
          </div>

          {/* Direct Mock Test Button */}
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                آزمون فوری با صفحه شبیه‌ساز آموزشیار
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-xs">
                جهت آزمایش عملکرد استخراج و تطبیق بدون نیاز به باز کردن سامانه واقعی آموزشیار
              </span>
            </div>
            <button
              id="btnGoToMockPortalFromModal"
              type="button"
              onClick={() => {
                onClose();
                onOpenMockPortal();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold rounded-xl shrink-0 text-xs transition-all"
            >
              مشاهده شبیه‌ساز آموزشیار
            </button>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
