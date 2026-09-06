import React, { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

export const AdminSyncStatus: React.FC = () => {
  const [syncs, setSyncs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSyncs = async () => {
    setLoading(true);
    // Ideally, we'd have a route to fetch all sync jobs for all students.
    // Since we created `syncRouter`, we should add a GET /api/sync/jobs for admins.
    const res = await apiRequest<{ data: any[] }>('/api/imports/batches');
    if (res.success && res.data) {
      setSyncs(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSyncs();
  }, []);

  if (loading) return <div className="p-8 text-center">در حال بارگذاری وضعیت سینک...</div>;

  return (
    <div className="bg-liquid-glass rounded-3xl p-6">
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
        <RefreshCw className="w-5 h-5 text-blue-500" /> مانیتورینگ وضعیت همگام‌سازی دانشجویان
      </h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            <tr>
              <th className="px-4 py-3 rounded-r-xl">شناسه عملیات (Batch)</th>
              <th className="px-4 py-3">زمان انجام</th>
              <th className="px-4 py-3">تعداد کل رکوردها</th>
              <th className="px-4 py-3">رکوردهای منطبق</th>
              <th className="px-4 py-3 rounded-l-xl">منبع</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
            {syncs.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-500">داده‌ای یافت نشد</td></tr>
            ) : syncs.map(s => (
              <tr key={s.id} className="hover:bg-white/40 dark:hover:bg-slate-800/30">
                <td className="px-4 py-4 font-medium font-mono text-xs">{s.id}</td>
                <td className="px-4 py-4 text-slate-500" dir="ltr">{new Date(s.createdAt).toLocaleString('fa-IR')}</td>
                <td className="px-4 py-4">{s.totalRecords}</td>
                <td className="px-4 py-4 text-green-600 font-bold">{s.matchedRecords}</td>
                <td className="px-4 py-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{s.source}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
