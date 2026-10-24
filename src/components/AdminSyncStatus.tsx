import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface SyncJobView {
  id: string;
  userId: string;
  termId: string;
  campusId: string;
  status: string;
  startedAt: string;
  receivedAt?: string;
  completedAt?: string;
  reconciledAt?: string;
  totalSnapshots: number;
  processedSnapshots: number;
  reconciledOfferings?: number;
  duplicateRecords?: number;
  reconciliationErrors?: string[];
  error?: string;
}

const statusLabels: Record<string, string> = {
  PENDING: 'در انتظار',
  RUNNING: 'در حال دریافت',
  RECEIVED: 'داده دریافت شده؛ در انتظار تطبیق',
  RECONCILED: 'تطبیق موفق',
  FAILED: 'ناموفق',
  COMPLETED: 'پایان‌یافته (وضعیت قدیمی)',
};

const statusStyles: Record<string, string> = {
  PENDING: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  RUNNING: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
  RECEIVED: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  RECONCILED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  FAILED: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
  COMPLETED: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('fa-IR');
}

export const AdminSyncStatus: React.FC = () => {
  const [syncs, setSyncs] = useState<SyncJobView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSyncs = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await apiRequest<SyncJobView[]>('/api/sync/jobs');
    if (res.success && Array.isArray(res.data)) {
      setSyncs(res.data);
    } else {
      setError(res.error || 'دریافت وضعیت همگام‌سازی ناموفق بود.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchSyncs();
  }, [fetchSyncs]);

  return (
    <section className="bg-liquid-glass rounded-3xl border border-slate-200/70 p-5 shadow-xs dark:border-slate-800 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            <RefreshCw className="h-5 w-5 text-blue-500" /> پایش واقعی عملیات همگام‌سازی
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            دریافت داده با تطبیق موفق یکی نیست. این فهرست وضعیت عملیات ثبت‌شده در سرور را نشان می‌دهد؛ نه داده زنده آموزشیار.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchSyncs}
          disabled={loading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> تازه‌سازی
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading && syncs.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Clock className="h-4 w-4 animate-pulse" /> در حال بارگذاری وضعیت همگام‌سازی…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-right text-sm">
            <caption className="sr-only">فهرست عملیات همگام‌سازی و نتیجه تطبیق داده‌ها</caption>
            <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <tr>
                <th className="rounded-r-xl px-3 py-3">عملیات</th>
                <th className="px-3 py-3">وضعیت</th>
                <th className="px-3 py-3">ترم / واحد</th>
                <th className="px-3 py-3">شروع / پایان</th>
                <th className="px-3 py-3">بخش‌ها</th>
                <th className="px-3 py-3">ارائه‌های تطبیق‌شده</th>
                <th className="rounded-l-xl px-3 py-3">پیام نتیجه</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
              {syncs.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">هنوز عملیات همگام‌سازی‌ای ثبت نشده است.</td></tr>
              ) : syncs.map((sync) => {
                const isSuccessful = sync.status === 'RECONCILED';
                const isFailed = sync.status === 'FAILED';
                const message = sync.error || sync.reconciliationErrors?.[0] || (isSuccessful ? 'داده‌ها با موفقیت تطبیق داده شدند.' : 'هنوز نتیجه نهایی ثبت نشده است.');
                return (
                  <tr key={sync.id} className="align-top hover:bg-white/40 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">{sync.id}</td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex max-w-56 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold ${statusStyles[sync.status] || statusStyles.PENDING}`}>
                        {isSuccessful ? <CheckCircle className="h-3.5 w-3.5" /> : isFailed ? <XCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                        {statusLabels[sync.status] || sync.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-xs leading-6">
                      <div>{sync.termId || '—'}</div>
                      <div className="text-slate-500">{sync.campusId || 'واحد نامشخص'}</div>
                    </td>
                    <td className="px-3 py-4 text-xs leading-6 text-slate-500">
                      <div>{formatDate(sync.startedAt)}</div>
                      <div>{formatDate(sync.completedAt || sync.receivedAt)}</div>
                    </td>
                    <td className="px-3 py-4 tabular-nums">{sync.processedSnapshots} / {sync.totalSnapshots}</td>
                    <td className="px-3 py-4 font-bold tabular-nums">{isSuccessful ? sync.reconciledOfferings ?? 0 : '—'}</td>
                    <td className={`max-w-64 whitespace-normal px-3 py-4 text-xs leading-5 ${isFailed ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`} title={message}>{message}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
