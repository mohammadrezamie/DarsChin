import React, { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import { AuditLog, ErrorLog } from '../types';
import { Activity, AlertTriangle } from 'lucide-react';

export const AdminLogs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'error'>('audit');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      const [auditRes, errorRes] = await Promise.all([
        apiRequest<AuditLog[]>('/api/admin/audit-logs'),
        apiRequest<ErrorLog[]>('/api/admin/error-logs')
      ]);
      if (auditRes.success && auditRes.data) setAuditLogs(auditRes.data);
      if (errorRes.success && errorRes.data) setErrorLogs(errorRes.data);
      setLoading(false);
    };
    fetchLogs();
  }, []);

  if (loading) return <div className="p-8 text-center">در حال بارگذاری لاگ‌ها...</div>;

  return (
    <div className="bg-liquid-glass rounded-3xl p-6">
      <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'audit' ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Activity className="w-4 h-4" /> لاگ‌های عملیاتی (Audit)
        </button>
        <button
          onClick={() => setActiveTab('error')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'error' ? 'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> لاگ‌های سیستمی (Error)
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right font-mono">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs font-sans">
            <tr>
              <th className="px-4 py-3 rounded-r-xl">زمان</th>
              <th className="px-4 py-3">{activeTab === 'audit' ? 'کاربر' : 'شدت خطا'}</th>
              <th className="px-4 py-3">{activeTab === 'audit' ? 'عملیات' : 'متن خطا'}</th>
              <th className="px-4 py-3 rounded-l-xl">جزئیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {activeTab === 'audit' && auditLogs.length === 0 && <tr><td colSpan={4} className="text-center p-4 text-slate-500 font-sans">لاگ عملیاتی یافت نشد.</td></tr>}
            {activeTab === 'error' && errorLogs.length === 0 && <tr><td colSpan={4} className="text-center p-4 text-slate-500 font-sans">خطای سیستمی یافت نشد.</td></tr>}
            
            {activeTab === 'audit' ? auditLogs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                <td className="px-4 py-3 text-xs text-slate-500" dir="ltr">{new Date(log.timestamp).toLocaleString('fa-IR')}</td>
                <td className="px-4 py-3 text-xs">{log.userId}</td>
                <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{log.action}</td>
                <td className="px-4 py-3 text-xs overflow-hidden text-ellipsis max-w-xs">{log.details}</td>
              </tr>
            )) : errorLogs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                <td className="px-4 py-3 text-xs text-slate-500" dir="ltr">{new Date(log.timestamp).toLocaleString('fa-IR')}</td>
                <td className="px-4 py-3 text-xs">
                  <span className={`px-2 py-1 rounded-md font-bold text-xs ${
                    log.severity === 'FATAL' ? 'bg-red-600 text-white shadow-xs' : 
                    log.severity === 'ERROR' ? 'bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800' : 
                    'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}>{log.severity}</span>
                </td>
                <td className="px-4 py-3 text-red-600 dark:text-red-400 font-bold max-w-sm truncate">{log.errorMessage}</td>
                <td className="px-4 py-3 text-xs overflow-hidden text-ellipsis max-w-xs">{log.stackTrace || log.context}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
