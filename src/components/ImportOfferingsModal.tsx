// ============================================================================
// DARSCHYN (درس‌چین) - Universal Offerings Import & Matching Modal
// ============================================================================

import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  Download,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Sparkles,
  ArrowRight,
  ClipboardPaste,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';
import { ExtensionExportPayload, ImportBatch, ImportRecord } from '../types';
import { apiRequest } from '../utils/api';

interface ImportOfferingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export const ImportOfferingsModal: React.FC<ImportOfferingsModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importResult, setImportResult] = useState<{
    batch: ImportBatch;
    summary: { total: number; matched: number; review: number; invalid: number };
    records: ImportRecord[];
    createdOfferingsCount: number;
  } | null>(null);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    setSelectedFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        setJsonText(content);
      } catch (err) {
        setError('خطا در خواندن محتوای فایل انتخاب‌شده.');
      }
    };
    reader.onerror = () => {
      setError('خطا در بارگذاری فایل از حافظه دستگاه.');
    };
    reader.readAsText(file);
  };

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Clipboard Paste handler
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setJsonText(text);
          setSelectedFileName('متن کپی‌شده از حافظه موقت (Clipboard)');
          setError(null);
          return;
        }
      }
      setError('دسترسی به حافظه کلیپ‌بورد یا متنی یافت نشد. لطفاً مستقیماً متن را در کادر پیست کنید.');
    } catch (err) {
      setError('مرورگر اجازه دسترسی مستقیم به کلیپ‌بورد را نداد. لطفاً متن را دستی پیست کنید.');
    }
  };

  // Submit and process payload
  const handleProcessImport = async (payloadToProcess?: any) => {
    setIsProcessing(true);
    setError(null);

    let contentToSend = payloadToProcess;
    if (!contentToSend) {
      const raw = jsonText.trim();
      if (!raw) {
        setError('لطفاً ابتدا فایلی را انتخاب یا متن داده‌ها را وارد کنید.');
        setIsProcessing(false);
        return;
      }
      try {
        contentToSend = JSON.parse(raw);
      } catch (err) {
        // If not standard JSON, send the raw text so backend CSV/TSV parser handles it
        contentToSend = raw;
      }
    }

    const res = await apiRequest('/api/imports/process', {
      method: 'POST',
      body: JSON.stringify({ payload: contentToSend }),
    });

    setIsProcessing(false);

    if (res.success && res.data) {
      setImportResult(res.data);
      onImportSuccess();
    } else {
      setError(res.error || 'خطا در پردازش و تطبیق فایل دروس ارائه‌شده.');
    }
  };

  // Demo 1-Click Simulation with realistic test payload
  const handleTestDemoData = () => {
    const demoPayload: ExtensionExportPayload = {
      schemaVersion: '1.0',
      source: 'mock-educational-system',
      extractedAt: new Date().toISOString(),
      term: 'نیمسال اول ۱۴۰۵–۱۴۰۶',
      university: 'دانشگاه آزاد اسلامی',
      campus: 'واحد علوم و تحقیقات',
      records: [
        { courseCode: '2104102', courseName: 'ریاضی عمومی ۲', group: '01', instructor: 'دکتر صابری', units: 3, day: 'یکشنبه', startTime: '08:00', endTime: '10:00', capacity: 40, availableCapacity: 8 },
        { courseCode: '2104103', courseName: 'معادلات دیفرانسیل', group: '01', instructor: 'دکتر علوی', units: 3, day: 'دوشنبه', startTime: '10:00', endTime: '12:00', capacity: 35, availableCapacity: 15 },
        { courseCode: '2104112', courseName: 'مدارهای الکتریکی ۲', group: '01', instructor: 'دکتر خسروی', units: 3, day: 'شنبه', startTime: '08:00', endTime: '10:00', capacity: 30, availableCapacity: 5 },
        { courseCode: '2104113', courseName: 'آزمایشگاه مدارهای الکتریکی', group: '02', instructor: 'مهندس رستمی', units: 1, day: 'چهارشنبه', startTime: '14:00', endTime: '16:00', capacity: 15, availableCapacity: 3 },
        { courseCode: '2104115', courseName: 'الکترونیک ۱', group: '01', instructor: 'دکتر یزدانی', units: 3, day: 'یکشنبه', startTime: '10:00', endTime: '12:00', capacity: 35, availableCapacity: 7 },
        { courseCode: '2104131', courseName: 'معماری کامپیوتر', group: '01', instructor: 'دکتر حسینی', units: 3, day: 'سه‌شنبه', startTime: '08:00', endTime: '10:00', capacity: 30, availableCapacity: 12 },
        { courseCode: '2104132', courseName: 'میکروکنترلرها و ریزپردازنده‌ها', group: '01', instructor: 'دکتر تقوی', units: 3, day: 'سه‌شنبه', startTime: '13:30', endTime: '15:30', capacity: 25, availableCapacity: 5 },
        { courseCode: '2104133', courseName: 'طراحی سیستم‌های دیجیتال با FPGA', group: '01', instructor: 'دکتر میرزایی', units: 3, day: 'دوشنبه', startTime: '13:30', endTime: '15:30', capacity: 20, availableCapacity: 6 },
        { courseCode: '2104104', courseName: 'ریاضیات مهندسی', group: '01', instructor: 'دکتر صابری', units: 3, day: 'شنبه', startTime: '10:00', endTime: '12:00', capacity: 40, availableCapacity: 5 },
        { courseCode: '2104114', courseName: 'سیگنال‌ها و سیستم‌ها', group: '01', instructor: 'دکتر محمودی', units: 3, day: 'چهارشنبه', startTime: '08:00', endTime: '10:00', capacity: 35, availableCapacity: 13 },
        { courseCode: '1101003', courseName: 'اندیشه اسلامی ۱ (مبدأ و معاد)', group: '03', instructor: 'حجت‌الاسلام موسوی', units: 2, day: 'سه‌شنبه', startTime: '10:00', endTime: '12:00', capacity: 50, availableCapacity: 9 },
        { courseCode: '1101004', courseName: 'آیین زندگی (اخلاق کاربردی)', group: '01', instructor: 'استاد کریمی', units: 2, day: 'دوشنبه', startTime: '08:00', endTime: '10:00', capacity: 45, availableCapacity: 15 },
        { courseCode: '9999999', courseName: 'درس فرضی خارج از چارت', group: '99', instructor: 'نامشخص', units: 3, day: 'نامشخص', startTime: '00:00', endTime: '00:00', capacity: 10, availableCapacity: 0 },
      ],
    };
    setSelectedFileName('داده‌های آزمایشی واقعی (۱۳ عنوان درس نیمسال)');
    setJsonText(JSON.stringify(demoPayload, null, 2));
    handleProcessImport(demoPayload);
  };

  const handleDownloadExtension = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/extension/download');
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'darschyn-chrome-extension-v3.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
      setError('خطا در دریافت فایل افزونه. لطفاً مجدداً تلاش کنید.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        id="importOfferingsModalContainer"
        className="bg-liquid-glass rounded-3xl max-w-3xl w-full p-6 relative my-8"
      >
        <button
          id="btnCloseImportModal"
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              دریافت و تطبیق دروس ارائه‌شده نیمسال
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              خروجی افزونه آموزشیار را اینجا وارد کنید یا بکشید و رها کنید.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {importResult ? (
          /* RESULT REPORT VIEW */
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                  پردازش و تطبیق بسته با موفقیت انجام شد
                </span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                دروس تطبیق‌داده‌شده بلافاصله در پایگاه داده دروس ارائه‌شده ذخیره و آماده ارزیابی پیش‌نیازها شدند.
              </p>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-center">
                <span className="text-xl font-bold text-slate-900 dark:text-white block">
                  {importResult.summary.total}
                </span>
                <span className="text-[11px] text-slate-500">کل رکوردهای شناسایی‌شده</span>
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 block">
                  {importResult.summary.matched}
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400">تطبیق موفق با چارت</span>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                <span className="text-xl font-bold text-amber-600 dark:text-amber-400 block">
                  {importResult.summary.review}
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400">نیازمند بررسی</span>
              </div>

              <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-800 text-center">
                <span className="text-xl font-bold text-red-600 dark:text-red-400 block">
                  {importResult.summary.invalid}
                </span>
                <span className="text-[11px] text-red-700 dark:text-red-400">نامعتبر</span>
              </div>
            </div>

            {/* Records Details Table */}
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="py-2 px-3">کد استخراج‌شده</th>
                    <th className="py-2 px-3">نام درس</th>
                    <th className="py-2 px-3">گروه</th>
                    <th className="py-2 px-3">وضعیت تطبیق</th>
                    <th className="py-2 px-3">علت یا روش تطبیق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {importResult.records.slice(0, 100).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 px-3 font-mono">{r.rawData.courseCode || '---'}</td>
                      <td className="py-2 px-3 font-semibold">{r.rawData.courseName}</td>
                      <td className="py-2 px-3">{r.rawData.group}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'MATCHED'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : r.status === 'NEEDS_REVIEW'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                              : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {r.status === 'MATCHED'
                            ? '✅ تطبیق موفق'
                            : r.status === 'NEEDS_REVIEW'
                            ? '⚠️ نیازمند بررسی'
                            : '❌ نامعتبر'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        {r.reviewReason || '---'}
                      </td>
                    </tr>
                  ))}
                  {importResult.records.length > 100 && (
                    <tr className="bg-slate-50 dark:bg-slate-800/20">
                      <td colSpan={5} className="py-3 px-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                         و {importResult.records.length - 100} مورد دیگر...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setImportResult(null);
                  setSelectedFileName(null);
                  setJsonText('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                بارگذاری فایل دیگر
              </button>
              <button
                id="btnDoneImportReport"
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 transition-all hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
              >
                مشاهده نتایج در میز کار
              </button>
            </div>
          </div>
        ) : (
          /* FORM VIEW */
          <div className="space-y-4">
            {/* Chrome Extension Download Card */}
            <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    افزونه مرورگر درس‌چین (استخراج مستقیم از آموزشیار)
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5 leading-relaxed">
                    با نصب افزونه در کروم، در صفحه انتخاب واحد آموزشیار دکمه «استخراج دروس» را بزنید و فایل JSON را در این کادر قرار دهید.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadExtension}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs text-center shrink-0 active:scale-95 flex items-center justify-center gap-1.5"
              >
                <span>دانلود افزونه کروم</span>
              </button>
            </div>

            {/* Quick Demo Button */}
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-xs text-blue-900 dark:text-blue-200">
                  جهت آزمون فوری سامانه، می‌توانید داده‌های استخراج‌شده واقعی را با یک کلیک بارگذاری فرمایید.
                </span>
              </div>
              <button
                id="btnLoadDemoExtractionData"
                type="button"
                onClick={handleTestDemoData}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 transition-all hover:bg-blue-700 text-white text-xs font-bold rounded-xl shrink-0"
              >
                ⚡ بارگذاری سریع داده‌های دمو
              </button>
            </div>

            {/* Universal File Drop / Select Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 scale-[0.99]'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 hover:border-blue-400 hover:bg-slate-100/50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                <UploadCloud className="w-6 h-6" />
              </div>

              {selectedFileName ? (
                <div className="text-center">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block mb-1">
                    ✓ فایل انتخاب‌شده: {selectedFileName}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    برای تغییر فایل، مجدداً کلیک کنید یا فایل دیگری بکشید و رها کنید
                  </span>
                </div>
              ) : (
                <div className="text-center">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 block">
                    کلیک برای انتخاب فایل خروجی افزونه آموزشیار
                  </span>
                  <span className="text-[11px] text-slate-500">
                    یا هر فایلی را مستقیماً به داخل این کادر بکشید و رها کنید
                  </span>
                </div>
              )}

              {/* No restrictive accept filter that causes empty folders */}
              <input
                ref={fileInputRef}
                id="fileInputImportOfferings"
                type="file"
                accept="*/*,.json,.txt,.csv,.tsv,.xlsx"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>

            {/* Paste JSON / Text Area & Direct Clipboard Button */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  یا جای‌گذاری متن خروجی افزونه:
                </label>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  جای‌گذاری از Clipboard
                </button>
              </div>
              <textarea
                id="textareaImportJson"
                rows={5}
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setSelectedFileName(null);
                }}
                placeholder='متن خروجی افزونه یا ساختار JSON را در اینجا قرار دهید...'
                className="w-full p-3 font-mono text-[11px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                انصراف
              </button>
              <button
                id="btnProcessImportJson"
                type="button"
                disabled={isProcessing || !jsonText.trim()}
                onClick={() => handleProcessImport()}
                className="px-5 py-2.5 bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 transition-all hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl"
              >
                {isProcessing ? 'در حال تطبیق با چارت...' : 'شروع اعتبارسنجی و تطبیق دروس'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
