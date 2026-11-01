// ============================================================================
// DARSCHYN (درس‌چین) - System & Database Diagnostics Component
// ============================================================================

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Activity, Server, Database, RefreshCw, CheckCircle2, ShieldAlert, HardDrive, Cpu, Clock } from 'lucide-react';

interface DiagnosticsData {
  status: string;
  uptimeSeconds: number;
  databaseStats: {
    users: number;
    provinces: number;
    campuses: number;
    degreeLevels: number;
    majors: number;
    tracks: number;
    entryYears: number;
    terms: number;
    curricula: number;
    courses: number;
    curriculumCourses: number;
    prerequisiteRules: number;
    corequisiteRules: number;
    offerings: number;
    studentProfiles: number;
    passedCourses: number;
    supportTickets: number;
    bugReports: number;
    auditLogs: number;
    errorLogs: number;
  };
  memory: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
  };
  nodeVersion: string;
  platform: string;
  serverTime: string;
}

export const AdminDiagnostics: React.FC = () => {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDiagnostics = async () => {
    setLoading(true);
    const res = await apiRequest<DiagnosticsData>('/api/admin/diagnostics');
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const formatUptime = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${hours} ساعت و ${mins} دقیقه و ${s} ثانیه`;
  };

  if (loading && !data) {
    return (
      <div className="bg-liquid-glass rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span className="text-xs text-slate-500">در حال ارزیابی وضعیت و سلامت پایگاه داده...</span>
      </div>
    );
  }

  const statLabels: Record<string, string> = {
    users: 'کاربران ثبت‌نامی',
    provinces: 'استان‌ها و مناطق',
    campuses: 'واحدهای دانشگاهی',
    degreeLevels: 'مقاطع تحصیلی',
    majors: 'رشته‌های تحصیلی',
    tracks: 'گرایش‌های تخصصی',
    entryYears: 'سال‌های ورود مصوب',
    terms: 'نیمسال‌های تحصیلی',
    curricula: 'چارت‌های تحصیلی مصوب',
    courses: 'عناوین دروس در بانک',
    curriculumCourses: 'تخصیص دروس به چارت',
    prerequisiteRules: 'قوانین پیش‌نیازی',
    corequisiteRules: 'قوانین هم‌نیازی',
    offerings: 'ارائه‌های ترمی دروس',
    studentProfiles: 'پرونده‌های تحصیلی',
    passedCourses: 'سوابق دروس گذرانده',
    supportTickets: 'تیکت‌های پشتیبانی',
    bugReports: 'گزارش‌های باگ',
    auditLogs: 'لاگ‌های عملیاتی',
    errorLogs: 'لاگ‌های خطای سیستمی',
  };

  return (
    <div className="space-y-6">
      {/* Header & Status Card */}
      <div className="bg-liquid-glass rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                وضعیت سلامت و دیاگنوستیک سامانه
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                سیستم پایدار (HEALTHY)
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              پایش بلادرنگ وضعیت پایگاه داده JSON، مصرف حافظه و جدول رکوردهای پایگاه داده
            </p>
          </div>
        </div>

        <button
          onClick={fetchDiagnostics}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>پایش مجدد</span>
        </button>
      </div>

      {/* System Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-liquid-glass rounded-3xl p-5 shadow-xs">
          <div className="flex items-center gap-3 mb-2 text-blue-600 dark:text-blue-400">
            <Clock className="w-5 h-5" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">مدت زمان فعالیت (Uptime)</span>
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">
            {data ? formatUptime(data.uptimeSeconds) : '...'}
          </span>
        </div>

        <div className="bg-liquid-glass rounded-3xl p-5 shadow-xs">
          <div className="flex items-center gap-3 mb-2 text-purple-600 dark:text-purple-400">
            <Cpu className="w-5 h-5" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">مصرف حافظه رم (Heap)</span>
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">
            {data ? `${data.memory.heapUsedMb} MB / ${data.memory.heapTotalMb} MB` : '...'}
          </span>
        </div>

        <div className="bg-liquid-glass rounded-3xl p-5 shadow-xs">
          <div className="flex items-center gap-3 mb-2 text-teal-600 dark:text-teal-400">
            <Server className="w-5 h-5" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">محیط اجرا (Runtime)</span>
          </div>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 font-mono">
            {data ? `Node ${data.nodeVersion} (${data.platform})` : '...'}
          </span>
        </div>
      </div>

      {/* Database Tables & Record Counts */}
      <div className="bg-liquid-glass rounded-3xl p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
            شمارش رکوردهای پایگاه داده به تفکیک جداول (Database Record Counts)
          </h4>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data?.databaseStats &&
            Object.entries(data.databaseStats).map(([table, count]) => (
              <div
                key={table}
                className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-between"
              >
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  {statLabels[table] || table}
                </span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                  {count}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
