import React, { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import { BugReport } from '../types';
import { Bug, Send, AlertTriangle } from 'lucide-react';

export const BugReportPanel: React.FC = () => {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'UI' | 'FUNCTIONAL' | 'DATA' | 'OTHER'>('FUNCTIONAL');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [description, setDescription] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    const res = await apiRequest<BugReport[]>('/api/support/bugs');
    if (res.success && res.data) setReports(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return alert('لطفاً عنوان و توضیحات را وارد کنید.');
    
    const res = await apiRequest<BugReport>('/api/support/bugs', {
      method: 'POST',
      body: JSON.stringify({ title, category, severity, description, pageContext: window.location.pathname })
    });
    
    if (res.success) {
      setTitle('');
      setDescription('');
      fetchReports();
      alert('گزارش خطای شما با موفقیت ثبت شد. از همکاری شما سپاسگزاریم.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="bg-liquid-glass rounded-3xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
          <Bug className="w-5 h-5 text-red-500" /> ثبت گزارش خطای جدید
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">عنوان خطا</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-2 text-sm outline-none focus:border-red-500 text-slate-900 dark:text-white" placeholder="خلاصه مشکل..." />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">دسته‌بندی</label>
              <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-2 text-sm outline-none focus:border-red-500 text-slate-900 dark:text-white">
                <option value="UI">رابط کاربری (ظاهر)</option>
                <option value="FUNCTIONAL">عملکرد سیستم</option>
                <option value="DATA">اطلاعات نادرست</option>
                <option value="OTHER">سایر موارد</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">شدت مشکل</label>
              <select value={severity} onChange={e => setSeverity(e.target.value as any)} className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-2 text-sm outline-none focus:border-red-500 text-slate-900 dark:text-white">
                <option value="LOW">کم (پیشنهاد بهبود)</option>
                <option value="MEDIUM">متوسط (اختلال جزئی)</option>
                <option value="HIGH">زیاد (مانع انجام کار)</option>
                <option value="CRITICAL">بحرانی (خرابی کامل)</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">توضیحات تکمیلی</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-xl px-4 py-2 text-sm outline-none focus:border-red-500 resize-none text-slate-900 dark:text-white" placeholder="لطفاً مراحل رسیدن به خطا را دقیق توضیح دهید..." />
          </div>
          
          <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95">
            <Send className="w-4 h-4 rtl:-scale-x-100" /> ثبت گزارش
          </button>
        </form>
      </div>
      
      {/* List */}
      <div className="bg-liquid-glass rounded-3xl p-6 shadow-sm flex flex-col">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" /> گزارش‌های پیشین شما
        </h3>
        <div className="flex-1 overflow-y-auto space-y-3">
          {reports.length === 0 ? (
            <div className="text-center text-slate-500 py-8">شما تاکنون گزارشی ثبت نکرده‌اید.</div>
          ) : reports.map(r => (
            <div key={r.id} className="p-4 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-sm text-slate-800 dark:text-white">{r.title}</h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  r.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                  r.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                  r.status === 'REJECTED' ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                }`}>
                  {r.status === 'RESOLVED' ? 'حل شده' : r.status === 'IN_PROGRESS' ? 'در حال بررسی' : r.status === 'REJECTED' ? 'رد شده' : 'باز'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{r.description}</p>
              <div className="flex gap-2 text-[10px] text-slate-500 font-mono">
                <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">{r.category}</span>
                <span className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">{r.severity}</span>
                <span dir="ltr">{new Date(r.createdAt).toLocaleDateString('fa-IR')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
