// ============================================================================
// DARSCHYN (درس‌چین) - Core Admin & Educational Management Dashboard
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  BookOpen,
  Layers,
  Settings,
  Users,
  Server,
  Database,
  MessageSquare,
  Activity,
  GraduationCap,
  Sparkles,
  School,
  MapPin,
  GitFork,
  FileSpreadsheet, FileDown,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Clock,
  Link2,
  Workflow,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { AdminCrudTable, Column } from './AdminCrudTable';
import { AdminCurriculumBuilder } from './AdminCurriculumBuilder';
import { UserManagement } from './UserManagement';
import { AdminSyncStatus } from './AdminSyncStatus';
import { AdminLogs } from './AdminLogs';
import { AdminSupportPanel } from './AdminSupportPanel';
import { AdminDiagnostics } from './AdminDiagnostics';
import { AdminAcademicSettings } from './AdminAcademicSettings';
import { AdminAcademicRules } from './AdminAcademicRules';
import { AdminImportCenter } from './AdminImportCenter';
import { apiRequest } from '../utils/api';

type AdminTab =
  | 'overview'
  // Organization
  | 'provinces'
  | 'campuses'
  // Academic Structure
  | 'degrees'
  | 'majors'
  | 'tracks'
  | 'entry-years'
  | 'curricula'
  // Academic Data
  | 'courses'
  | 'academic-rules'
  | 'terms'
  | 'offerings'
  | 'academic-settings'
  | 'imports'
  // Operations
  | 'users'
  | 'support'
  | 'diagnostics'
  | 'logs';

interface AdminStats {
  totalUsers: number;
  totalStudents: number;
  totalUniversities: number;
  totalProvinces: number;
  totalCampuses: number;
  totalDegreeLevels: number;
  totalMajors: number;
  totalTracks: number;
  totalCurricula: number;
  totalCourses: number;
}

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const isBrowserDemo = useLocation().pathname.startsWith('/demo/');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const isSuperAdmin = user?.roles?.includes('super-admin');
  const isAdmin = user?.roles?.includes('admin') || isSuperAdmin;

  const fetchStats = async () => {
    setLoadingStats(true);
    const res = await apiRequest<AdminStats>('/api/admin/stats');
    if (res.success && res.data) {
      setStats(res.data);
    }
    setLoadingStats(false);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
    }
  }, [isAdmin]);

  // Role Access Guard
  if (!user || !isAdmin) {
    return (
      <div className="bg-liquid-glass rounded-3xl p-8 max-w-lg mx-auto text-center my-12 border border-rose-200/80 dark:border-rose-800/60 shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
          دسترسی غیرمجاز
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          مشاهده و مدیریت این بخش صرفاً برای حساب‌های کاربری با نقش «مدیر سیستم» یا «مدیر ارشد» مجاز است.
        </p>
      </div>
    );
  }

  // Navigation Groups Definition
  const navGroups = [
    {
      title: 'پیشخوان',
      items: [{ id: 'overview' as AdminTab, label: 'داشبورد و آمار', icon: Activity }],
    },
    {
      title: 'سازمان و واحدها',
      items: [
        { id: 'provinces' as AdminTab, label: 'استان‌ها', icon: MapPin },
        { id: 'campuses' as AdminTab, label: 'واحدهای دانشگاهی', icon: School },
      ],
    },
    {
      title: 'ساختار تحصیلی',
      items: [
        { id: 'degrees' as AdminTab, label: 'مقاطع تحصیلی', icon: GraduationCap },
        { id: 'majors' as AdminTab, label: 'رشته‌های تحصیلی', icon: Settings },
        { id: 'tracks' as AdminTab, label: 'گرایش‌ها', icon: GitFork },
        { id: 'entry-years' as AdminTab, label: 'سال‌های ورود', icon: Calendar },
        { id: 'curricula' as AdminTab, label: 'چارت‌های مصوب', icon: FileSpreadsheet },
      ],
    },
    {
      title: 'داده‌های آموزشی و قوانین',
      items: [
        { id: 'courses' as AdminTab, label: 'بانک دروس', icon: BookOpen },
        { id: 'academic-rules' as AdminTab, label: 'قوانین آموزشی', icon: Workflow },
        { id: 'terms' as AdminTab, label: 'نیمسال‌های تحصیلی', icon: Clock },
        { id: 'offerings' as AdminTab, label: 'ارائه‌های ترمی', icon: Layers },
        { id: 'imports' as AdminTab, label: 'پایش داده‌های ورودی', icon: FileDown },
        ...(isSuperAdmin ? [{ id: 'academic-settings' as AdminTab, label: 'آیین‌نامه و سقف واحدها', icon: SlidersHorizontal }] : []),
      ],
    },
    {
      title: 'عملیات و پشتیبانی',
      items: [
        ...(isSuperAdmin ? [
          { id: 'users' as AdminTab, label: 'کاربران و دسترسی‌ها', icon: Users },
          { id: 'diagnostics' as AdminTab, label: 'دیاگنوستیک سامانه', icon: Server },
          { id: 'logs' as AdminTab, label: 'لاگ‌های سیستم', icon: Database },
        ] : []),
        { id: 'support' as AdminTab, label: 'پشتیبانی و تیکت‌ها', icon: MessageSquare },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-liquid-glass rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                پنل مدیریت و راهبری جامع درس‌چین
              </h2>
              {isSuperAdmin && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  مدیر ارشد (Super Admin)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مدیریت یکپارچه ساختار آکادمیک، قوانین پیش‌نیازی و هم‌نیازی، ارائه‌های ترمی و کاربران
            </p>
          </div>
        </div>

        <button
          onClick={fetchStats}
          disabled={loadingStats}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all self-end sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
          <span>بروزرسانی آمار</span>
        </button>
      </div>

      {/* Navigation Grouped Bar */}
      <div className="bg-liquid-glass rounded-2xl p-2 shadow-xs space-y-2 sticky top-[72px] z-30">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
          {navGroups.map((grp) => (
            <div key={grp.title} className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1.5 hidden xl:inline">
                {grp.title}:
              </span>
              {grp.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Main Tab Content Area */}
      <div className="pt-1">
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="bg-liquid-glass rounded-3xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    کل کاربران ثبت‌نامی
                  </span>
                  <span className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                    {stats?.totalUsers ?? '...'}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-liquid-glass rounded-3xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    دانشجویان فعال
                  </span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {stats?.totalStudents ?? '...'}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-liquid-glass rounded-3xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    عناوین دروس در بانک
                  </span>
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                    {stats?.totalCourses ?? '...'}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-liquid-glass rounded-3xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    چارت‌های مصوب
                  </span>
                  <span className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                    {stats?.totalCurricula ?? '...'}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-liquid-glass rounded-3xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    واحدهای دانشگاهی
                  </span>
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                    {stats?.totalCampuses ?? '...'}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <School className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-liquid-glass rounded-3xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    استان‌ها
                  </span>
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                    {stats?.totalProvinces ?? '...'}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-liquid-glass rounded-3xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    رشته‌های تحصیلی
                  </span>
                  <span className="text-2xl font-black text-teal-600 dark:text-teal-400 font-mono">
                    {stats?.totalMajors ?? '...'}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Settings className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-liquid-glass rounded-3xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    گرایش‌های تخصصی
                  </span>
                  <span className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">
                    {stats?.totalTracks ?? '...'}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <GitFork className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Quick Actions & System Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-liquid-glass rounded-3xl p-6 shadow-xs">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  دسترسی سریع به بخش‌های پرکاربرد
                </h4>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setActiveTab('courses')}
                    className="p-3 bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 text-right transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    بانک دروس
                  </button>
                  <button
                    onClick={() => setActiveTab('prerequisites')}
                    className="p-3 bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 text-right transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <Workflow className="w-4 h-4 text-emerald-500" />
                    پیش‌نیازها و هم‌نیازها
                  </button>
                  <button
                    onClick={() => setActiveTab('offerings')}
                    className="p-3 bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 text-right transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <Layers className="w-4 h-4 text-amber-500" />
                    ارائه‌های ترمی
                  </button>
                  {isSuperAdmin && (
                    <button
                                        onClick={() => setActiveTab('diagnostics')}
                                        className="p-3 bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 text-right transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                                      >
                                        <Server className="w-4 h-4 text-purple-500" />
                                        دیاگنوستیک سامانه
                                      </button>
                  )}
                </div>
              </div>

              <div className="bg-liquid-glass rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-600" />
                    وضعیت سرویس پایگاه داده و تطبیق چارت
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                    {isBrowserDemo
                      ? 'این پنل فقط داده‌های آزمایشی ذخیره‌شده در مرورگر را نشان می‌دهد؛ موتور رسمی قوانین و دیتابیس مرکزی اجرا نمی‌شوند.'
                      : 'نمایش داشبورد به‌تنهایی سلامت اتصال به دیتابیس یا صحت موتور قوانین را تأیید نمی‌کند.'}
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
                  <span className="font-semibold">{isBrowserDemo ? 'نوع ذخیره‌سازی:' : 'وضعیت اتصال:'}</span>
                  <span className="font-bold">
                    {isBrowserDemo ? 'شبیه‌ساز محلی — بدون سرور' : 'تأییدنشده — نیازمند آزمون سلامت API'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. PROVINCES */}
        {activeTab === 'provinces' && (
          <AdminCrudTable
            title="مدیریت استان‌ها و مناطق دانشگاهی"
            description="تعریف استان‌های دانشگاه آزاد اسلامی جهت تخصیص واحدها و پردیس‌ها"
            endpoint="/api/academic/provinces"
            columns={[
              { key: 'name', label: 'نام استان' },
              { key: 'active', label: 'وضعیت فعالیت', type: 'boolean' },
            ]}
          />
        )}

        {/* 3. CAMPUSES / UNITS */}
        {activeTab === 'campuses' && (
          <AdminCrudTable
            title="مدیریت واحدهای دانشگاهی (Campuses & Units)"
            description="واحدهای جامع، استانی، بین‌الملل و مستقل"
            endpoint="/api/academic/campuses"
            columns={[
              { key: 'name', label: 'نام واحد دانشگاهی' },
              { key: 'code', label: 'کد واحد' },
              {
                key: 'type',
                label: 'نوع واحد',
                type: 'select',
                options: [
                  { label: 'واحد استان (PROVINCE_UNIT)', value: 'PROVINCE_UNIT' },
                  { label: 'واحد جامع مستقل (COMPREHENSIVE_INDEPENDENT)', value: 'COMPREHENSIVE_INDEPENDENT' },
                  { label: 'واحد بین‌الملل (INTERNATIONAL)', value: 'INTERNATIONAL' },
                ],
              },
              { key: 'provinceId', label: 'شناسه استان' },
              { key: 'active', label: 'وضعیت', type: 'boolean' },
            ]}
          />
        )}

        {/* 4. DEGREE LEVELS */}
        {activeTab === 'degrees' && (
          <AdminCrudTable
            title="مدیریت مقاطع تحصیلی"
            description="کاردانی، کارشناسی پیوسته/ناپیوسته، کارشناسی ارشد، دکتری"
            endpoint="/api/academic/degrees"
            columns={[
              { key: 'name', label: 'عنوان مقطع' },
              { key: 'code', label: 'کد اختصاری' },
              { key: 'active', label: 'وضعیت', type: 'boolean' },
            ]}
          />
        )}

        {/* 5. MAJORS */}
        {activeTab === 'majors' && (
          <AdminCrudTable
            title="مدیریت رشته‌های تحصیلی"
            description="رشته‌های مصوب وزارت علوم و دانشگاه آزاد اسلامی"
            endpoint="/api/academic/majors"
            columns={[
              { key: 'name', label: 'عنوان رشته' },
              { key: 'code', label: 'کد رشته' },
              { key: 'degreeLevelId', label: 'شناسه مقطع' },
              { key: 'active', label: 'وضعیت', type: 'boolean' },
            ]}
          />
        )}

        {/* 6. TRACKS */}
        {activeTab === 'tracks' && (
          <AdminCrudTable
            title="مدیریت گرایش‌های تخصصی رشته‌ها"
            description="گرایش‌های مختلف ذیل هر رشته تحصیلی جهت تحلیل تطبیقی چندگرایشی"
            endpoint="/api/academic/tracks"
            columns={[
              { key: 'name', label: 'عنوان گرایش' },
              { key: 'code', label: 'کد گرایش' },
              { key: 'majorId', label: 'شناسه رشته' },
              { key: 'active', label: 'وضعیت', type: 'boolean' },
            ]}
          />
        )}

        {/* 7. ENTRY YEARS */}
        {activeTab === 'entry-years' && (
          <AdminCrudTable
            title="مدیریت سال‌های ورود تحصیلی"
            description="سال‌های ورود دانشجویان جهت تطبیق با ویرایش چارت مربوطه"
            endpoint="/api/academic/entry-years"
            columns={[
              { key: 'year', label: 'سال ورود (هجری شمسی)', type: 'number' },
              { key: 'active', label: 'وضعیت پذیرش فعال', type: 'boolean' },
            ]}
          />
        )}

        {/* 8. CURRICULA */}
        {activeTab === 'curricula' && (
          <AdminCurriculumBuilder />
        )}

        {/* 9. COURSES */}
        {activeTab === 'courses' && (
          <AdminCrudTable
            title="بانک جامع دروس آموزشی"
            description="تعریف کلیه عناوین دروس، تعداد واحدهای نظری و عملی و دسته‌بندی موضوعی"
            endpoint="/api/academic/courses"
            columns={[
              { key: 'code', label: 'کد درس' },
              { key: 'name', label: 'عنوان درس' },
              { key: 'units', label: 'واحد نظری', type: 'number' },
              { key: 'practicalUnits', label: 'واحد عملی', type: 'number' },
              {
                key: 'category',
                label: 'دسته‌بندی',
                type: 'select',
                options: [
                  { label: 'پایه', value: 'پایه' },
                  { label: 'اصلی', value: 'اصلی' },
                  { label: 'تخصصی', value: 'تخصصی' },
                  { label: 'عمومی', value: 'عمومی' },
                  { label: 'اختیاری', value: 'اختیاری' },
                  { label: 'آزمایشگاه', value: 'آزمایشگاه' },
                  { label: 'پروژه', value: 'پروژه' },
                  { label: 'کارآموزی', value: 'کارآموزی' },
                ],
              },
              { key: 'active', label: 'وضعیت', type: 'boolean' },
            ]}
          />
        )}

        {/* 10. ACADEMIC RULES */}
        {activeTab === 'academic-rules' && <AdminAcademicRules />}

        {/* 12. TERMS */}
        {activeTab === 'terms' && (
          <AdminCrudTable
            title="مدیریت نیمسال‌های تحصیلی (Terms)"
            description="نیمسال‌های پاییز، بهار و تابستان با تعیین ترم جاری"
            endpoint="/api/academic/terms"
            columns={[
              { key: 'name', label: 'عنوان نیمسال' },
              { key: 'year', label: 'سال تحصیلی', type: 'number' },
              {
                key: 'termNumber',
                label: 'شماره نیمسال',
                type: 'select',
                options: [
                  { label: 'نیمسال اول (مهر)', value: '1' },
                  { label: 'نیمسال دوم (بهمن)', value: '2' },
                  { label: 'دوره تابستان', value: '3' },
                ],
              },
              { key: 'isCurrent', label: 'نیمسال جاری انتخاب واحد', type: 'boolean' },
              { key: 'active', label: 'وضعیت', type: 'boolean' },
            ]}
          />
        )}

        {/* 13. OFFERINGS */}
        {activeTab === 'imports' && (
          <div className="space-y-6">
            <AdminImportCenter />
            <AdminSyncStatus />
          </div>
        )}

        {activeTab === 'offerings' && (
          <AdminCrudTable
            title="مدیریت ارائه‌های ترمی دروس (Course Offerings)"
            description="گروه‌ها و اساتید ارائه‌دهنده دروس در نیمسال جاری"
            endpoint="/api/offerings"
            columns={[
              { key: 'rawCourseName', label: 'عنوان درس' },
              { key: 'groupCode', label: 'کد گروه' },
              { key: 'instructor', label: 'استاد درس' },
              { key: 'dayOfWeek', label: 'روز هفته' },
              { key: 'startTime', label: 'شروع' },
              { key: 'endTime', label: 'پایان' },
              { key: 'location', label: 'مکان کلاس' },
              { key: 'capacity', label: 'ظرفیت', type: 'number' },
              { key: 'enrolledCount', label: 'ثبت‌نامی', type: 'number' },
              { key: 'examDate', label: 'تاریخ و ساعت امتحان' },
              { key: 'active', label: 'وضعیت', type: 'boolean' },
            ]}
          />
        )}

        {/* 14. ACADEMIC POLICY & FINAL SEMESTER SETTINGS */}
        {activeTab === 'academic-settings' && isSuperAdmin && <AdminAcademicSettings />}

        {/* 15. USERS */}
        {activeTab === 'users' && isSuperAdmin && <UserManagement />}

        {/* 15. SUPPORT */}
        {activeTab === 'support' && <AdminSupportPanel />}

        {/* 16. DIAGNOSTICS */}
        {activeTab === 'diagnostics' && isSuperAdmin && <AdminDiagnostics />}

        {/* 17. LOGS */}
        {activeTab === 'logs' && isSuperAdmin && <AdminLogs />}
      </div>
    </div>
  );
};
