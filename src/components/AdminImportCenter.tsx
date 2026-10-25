import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, ClipboardList, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../utils/api';

interface BatchSummary {
  id: string;
  source: string;
  createdAt: string;
  termId: string;
  totalRecords: number;
  matchedRecords: number;
  reviewRecords: number;
  invalidRecords: number;
}
interface ReviewRecord {
  id: string;
  status: 'MATCHED' | 'NEEDS_REVIEW' | 'INVALID';
  reviewReason?: string;
  matchedCourseId?: string | null;
  reviewDecision?: 'COURSE_MATCH_CONFIRMED' | 'REJECTED';
  reviewNotes?: string;
  reviewedAt?: string;
  rawData?: {
    courseCode?: string;
    courseName?: string;
    group?: string;
    instructor?: string;
  };
}
interface CatalogCourse { id: string; name: string; code: string; active?: boolean }
interface ReviewDraft { courseId: string; reason: string }
const badge = (status: ReviewRecord['status']) => status === 'MATCHED'
  ? { text: 'تطبیق اولیه', style: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' }
  : status === 'NEEDS_REVIEW'
    ? { text: 'بررسی دستی', style: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' }
    : { text: 'نامعتبر', style: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200' };

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
    <span className="block text-xs text-slate-500 dark:text-slate-400">{label}</span>
    <strong className="mt-1 block text-lg font-black tabular-nums text-slate-900 dark:text-slate-50">{value}</strong>
  </div>;
}

export const AdminImportCenter: React.FC = () => {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CatalogCourse[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const detailsSequence = useRef(0);

  const fetchBatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<BatchSummary[]>('/api/imports/batches');
      if (response.success && Array.isArray(response.data)) setBatches(response.data);
      else setError(response.error || 'فهرست بسته‌ها دریافت نشد.');
    } catch {
      setError('ارتباط با سرور برای دریافت بسته‌ها برقرار نشد.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBatches();
    void apiRequest<CatalogCourse[]>('/api/academic/courses').then(response => {
      if (response.success && Array.isArray(response.data)) setCourses(response.data);
    });
    return () => { detailsSequence.current++; };
  }, []);

  const handleExpand = async (batchId: string, forceReload = false) => {
    if (expandedBatchId === batchId && !forceReload) {
      detailsSequence.current++;
      setExpandedBatchId(null);
      return;
    }
    const currentSequence = ++detailsSequence.current;
    setExpandedBatchId(batchId);
    setRecords([]);
    setRecordsError(null);
    setReviewError(null);
    setReviewMessage(null);
    setRecordsLoading(true);
    try {
      const response = await apiRequest<{ records: ReviewRecord[] }>(`/api/imports/batches/${encodeURIComponent(batchId)}`);
      if (currentSequence !== detailsSequence.current) return;
      if (response.success && Array.isArray(response.data?.records)) {
        setRecords(response.data.records);
      } else setRecordsError(response.error || 'جزئیات بسته دریافت نشد.');
    } catch {
      if (currentSequence === detailsSequence.current) setRecordsError('ارتباط با سرور هنگام دریافت جزئیات قطع شد.');
    } finally {
      if (currentSequence === detailsSequence.current) setRecordsLoading(false);
    }
  };

  const updateDraft = (record: ReviewRecord, changes: Partial<ReviewDraft>) => {
    setReviewDrafts(prev => ({
      ...prev,
      [record.id]: {
        courseId: prev[record.id]?.courseId ?? record.matchedCourseId ?? '',
        reason: prev[record.id]?.reason ?? '',
        ...changes,
      },
    }));
  };

  const reviewRecord = async (record: ReviewRecord, action: 'CONFIRM_MATCH' | 'REJECT_MATCH') => {
    if (!expandedBatchId || reviewBusyId) return;
    const draft = reviewDrafts[record.id] ?? { courseId: record.matchedCourseId || '', reason: '' };
    if (draft.reason.trim().length < 10 || (action === 'CONFIRM_MATCH' && !draft.courseId)) {
      setReviewError('برای هر تصمیم، درس مقصد و توضیح حداقل ده نویسه‌ای متناسب با تصمیم را وارد کنید.');
      return;
    }
    setReviewError(null);
    setReviewMessage(null);
    setReviewBusyId(record.id);
    try {
      const payload = action === 'CONFIRM_MATCH'
        ? { action, courseId: draft.courseId, reason: draft.reason.trim() }
        : { action, reason: draft.reason.trim() };
      const response = await apiRequest<ReviewRecord>(
        `/api/imports/batches/${encodeURIComponent(expandedBatchId)}/records/${encodeURIComponent(record.id)}/review`,
        { method: 'PUT', body: JSON.stringify(payload) },
      );
      if (!response.success || !response.data) {
        setReviewError(response.error || 'ثبت تصمیم بررسی امکان‌پذیر نشد.');
        return;
      }
      setRecords(current => current.map(item => item.id === record.id ? response.data! : item));
      setReviewMessage('تصمیم نگاشت ذخیره شد. هیچ گروه درسی منتشر نشده است.');
      setReviewDrafts(prev => ({ ...prev, [record.id]: { courseId: response.data!.matchedCourseId || '', reason: '' } }));
    } catch {
      setReviewError('ارتباط با سامانه در هنگام ثبت تصمیم قطع شد.');
    } finally {
      setReviewBusyId(null);
    }
  };

  return (
    <section className="space-y-5" aria-label="مرکز تطبیق و بررسی ورودی‌های آموزشیار">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
              <ClipboardList aria-hidden="true" className="h-5 w-5 text-blue-600" />
              مرکز تطبیق فایل‌های آموزشیار
            </h2>
            <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
              هر فایل ابتدا به‌عنوان پیشنهاد ثبت می‌شود. تطبیق اولیه کد درس به معنی تأیید آیین‌نامه، ظرفیت یا انتشار گروه درسی نیست.
            </p>
          </div>
          <button type="button" onClick={() => void fetchBatches()} disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            به‌روزرسانی
          </button>
        </div>
        <div role="note" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          هیچ گروه جدیدی بدون بازبینی و انتشار جداگانه مدیر به داده مرجع اضافه نمی‌شود. قابلیت تأیید و انتشار هنوز فعال نیست.
        </div>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => void fetchBatches()} className="min-h-11 rounded-lg border border-current px-3 font-bold">تلاش دوباره</button>
        </div>
      )}

      {loading && batches.length === 0 ? (
        <div role="status" className="rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500 dark:border-slate-800">در حال دریافت بسته‌های بررسی…</div>
      ) : (
        <div className="space-y-3">
          {batches.map(batch => {
            const open = expandedBatchId === batch.id;
            const detailsId = `import-records-${batch.id}`;
            return (
              <article key={batch.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <button type="button" onClick={() => void handleExpand(batch.id)}
                  aria-expanded={open} aria-controls={detailsId}
                  className="w-full p-4 text-right transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:p-5 dark:hover:bg-slate-800/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-bold text-slate-900 dark:text-white">بسته تطبیق <span dir="ltr" className="inline-block font-mono text-xs">{batch.id}</span></h3>
                      <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                        {batch.source} · نیمسال {batch.termId} · {Number.isFinite(Date.parse(batch.createdAt)) ? new Date(batch.createdAt).toLocaleDateString('fa-IR') : 'زمان نامشخص'}
                      </p>
                    </div>
                    {open ? <ChevronUp aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500" /> :
                      <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500" />}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Metric label="کل رکوردها" value={batch.totalRecords} />
                    <Metric label="تطبیق اولیه" value={batch.matchedRecords} />
                    <Metric label="بررسی دستی" value={batch.reviewRecords} />
                    <Metric label="نامعتبر" value={batch.invalidRecords} />
                  </div>
                </button>
                {open && (
                  <div id={detailsId} className="border-t border-slate-200 p-4 dark:border-slate-800">
                    {recordsLoading && <div role="status" className="py-8 text-center text-sm text-slate-500">در حال دریافت جزئیات…</div>}
                    {recordsError && (
                      <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
                        <AlertCircle aria-hidden="true" className="h-4 w-4" />{recordsError}
                        <button type="button" onClick={() => void handleExpand(batch.id, true)} className="min-h-11 rounded-lg border px-3 font-bold">تلاش دوباره</button>
                      </div>
                    )}
                    {reviewError && <p role="alert" className="mb-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{reviewError}</p>}
                    {reviewMessage && <p role="status" className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{reviewMessage}</p>}
                    {!recordsLoading && !recordsError && (
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {records.map(record => {
                          const status = badge(record.status);
                          return (
                            <div key={record.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <strong className="text-sm text-slate-900 dark:text-white">{record.rawData?.courseName || 'درس بدون عنوان'}</strong>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.style}`}>{status.text}</span>
                              </div>
                              <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
                                کد: {record.rawData?.courseCode || 'نامشخص'} · گروه: {record.rawData?.group || 'نامشخص'} · استاد: {record.rawData?.instructor || 'نامشخص'}
                              </p>
                              <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">{record.reviewReason || 'توضیحی ثبت نشده است.'}</p>
                              {record.matchedCourseId && <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">شناسه پیشنهادی: {record.matchedCourseId}</p>}
                              {record.reviewDecision && (
                                <p className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs leading-6 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                                  {record.reviewDecision === 'COURSE_MATCH_CONFIRMED' ? 'نگاشت درس توسط مدیر بررسی و تأیید شده' : 'نگاشت این ردیف توسط مدیر رد شده'}
                                  {record.reviewNotes && <span className="block">دلیل: {record.reviewNotes}</span>}
                                  <span className="block">این تصمیم هنوز هیچ گروهی را منتشر نمی‌کند.</span>
                                </p>
                              )}
                              <details className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                <summary className="cursor-pointer text-xs font-bold text-blue-800 dark:text-blue-200">
                                  ثبت / اصلاح تصمیم نگاشت
                                </summary>
                                <p className="mt-3 text-xs leading-6 text-slate-600 dark:text-slate-300">
                                  این عملیات فقط نگاشت کاتالوگ را بررسی می‌کند؛ زمان کلاس و صحت ارائه باید مستقل تأیید شوند.
                                </p>
                                <label className="mt-3 block text-xs font-bold text-slate-700 dark:text-slate-300">
                                  درس مقصد کاتالوگ
                                  <select aria-label={`درس مقصد برای ${record.rawData?.courseName || record.id}`}
                                    value={reviewDrafts[record.id]?.courseId ?? record.matchedCourseId ?? ''}
                                    onChange={event => updateDraft(record, { courseId: event.target.value })}
                                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-800">
                                    <option value="">درس مقصد را انتخاب کنید</option>
                                    {courses.filter(course => course.active !== false).map(course => (
                                      <option key={course.id} value={course.id}>{course.code} — {course.name}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="mt-3 block text-xs font-bold text-slate-700 dark:text-slate-300">
                                  دلیل مستند تصمیم (حداقل ۱۰ نویسه)
                                  <textarea aria-label={`دلیل بررسی ${record.rawData?.courseName || record.id}`}
                                    value={reviewDrafts[record.id]?.reason || ''}
                                    onChange={event => updateDraft(record, { reason: event.target.value })}
                                    maxLength={500} rows={2}
                                    placeholder="مثلاً کد مصوب و عنوان درس با منبع بررسی شد..."
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-800" />
                                </label>
                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <button type="button"
                                    disabled={reviewBusyId !== null || courses.length === 0}
                                    onClick={() => void reviewRecord(record, 'CONFIRM_MATCH')}
                                    className="min-h-11 rounded-lg bg-blue-700 px-3 text-xs font-bold text-white disabled:opacity-50">
                                    {reviewBusyId === record.id ? 'در حال ثبت…' : 'تأیید نگاشت (بدون انتشار)'}
                                  </button>
                                  <button type="button" disabled={reviewBusyId !== null}
                                    onClick={() => void reviewRecord(record, 'REJECT_MATCH')}
                                    className="min-h-11 rounded-lg border border-rose-300 px-3 text-xs font-bold text-rose-800 disabled:opacity-50 dark:border-rose-700 dark:text-rose-300">
                                    رد نگاشت با دلیل
                                  </button>
                                </div>
                              </details>
                            </div>
                          );
                        })}
                        {records.length === 0 && <div className="p-6 text-center text-sm text-slate-500">این بسته رکوردی ندارد.</div>}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          {batches.length === 0 && !error && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500 dark:border-slate-700">
              هنوز فایلی برای بررسی در این محیط ثبت نشده است.
            </div>
          )}
        </div>
      )}
    </section>
  );
};
