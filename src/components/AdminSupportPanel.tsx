import React, { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import { SupportTicket, BugReport } from '../types';
import { MessageSquare, Bug, CheckCircle } from 'lucide-react';

export const AdminSupportPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'bugs'>('tickets');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [tRes, bRes] = await Promise.all([
      apiRequest<SupportTicket[]>('/api/support/admin/tickets'),
      apiRequest<BugReport[]>('/api/support/admin/bugs')
    ]);
    if (tRes.success && tRes.data) setTickets(tRes.data);
    if (bRes.success && bRes.data) setBugs(bRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateTicketStatus = async (id: string, status: string) => {
    await apiRequest(`/api/support/admin/tickets/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    fetchData();
  };

  const updateBugStatus = async (id: string, status: string) => {
    await apiRequest(`/api/support/admin/bugs/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
    fetchData();
  };

  if (loading) return <div className="p-8 text-center">در حال بارگذاری...</div>;

  return (
    <div className="bg-liquid-glass rounded-3xl p-6">
      <div className="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
        <button onClick={() => setActiveTab('tickets')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'tickets' ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>
          <MessageSquare className="w-4 h-4" /> تیکت‌ها
        </button>
        <button onClick={() => setActiveTab('bugs')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'bugs' ? 'bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
          <Bug className="w-4 h-4" /> خطاها
        </button>
      </div>

      <div className="overflow-x-auto">
        {activeTab === 'tickets' ? (
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 rounded-r-xl">کاربر (شناسه)</th>
                <th className="px-4 py-3">موضوع</th>
                <th className="px-4 py-3">وضعیت</th>
                <th className="px-4 py-3 rounded-l-xl">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {tickets.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                  <td className="px-4 py-3 text-xs font-mono">{t.userId}</td>
                  <td className="px-4 py-3 font-bold">{t.subject}</td>
                  <td className="px-4 py-3 text-xs">{t.status}</td>
                  <td className="px-4 py-3">
                    <select
                      className="text-xs px-2 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={t.status}
                      onChange={e => updateTicketStatus(t.id, e.target.value)}
                    >
                      <option value="OPEN">OPEN (باز)</option>
                      <option value="ANSWERED">ANSWERED (پاسخ داده)</option>
                      <option value="CLOSED">CLOSED (بسته)</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 rounded-r-xl">عنوان / دسته‌بندی</th>
                <th className="px-4 py-3">شدت</th>
                <th className="px-4 py-3">وضعیت</th>
                <th className="px-4 py-3 rounded-l-xl">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {bugs.map(b => (
                <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                  <td className="px-4 py-3">
                    <div className="font-bold">{b.title}</div>
                    <div className="text-[10px] text-slate-500">{b.category}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{b.severity}</td>
                  <td className="px-4 py-3 text-xs">{b.status}</td>
                  <td className="px-4 py-3">
                    <select
                      className="text-xs px-2 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                      value={b.status}
                      onChange={e => updateBugStatus(b.id, e.target.value)}
                    >
                      <option value="OPEN">OPEN (بررسی نشده)</option>
                      <option value="IN_PROGRESS">IN_PROGRESS (در دست بررسی)</option>
                      <option value="RESOLVED">RESOLVED (حل شده)</option>
                      <option value="REJECTED">REJECTED (رد شده)</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
