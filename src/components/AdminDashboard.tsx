// ============================================================================
// DARSCHYN (درس‌چین) - Core Admin & Educational Management Dashboard
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { resolveAdminTab, type AdminTab } from '../utils/admin-navigation';
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
  BarChart3,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Clock,
  Link2,
  Workflow,
  CheckCircle2,
  SlidersHorizontal,
  Menu,
  X,
  ChevronLeft,
  PanelRightClose,
  Search,
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
import { DemandWorkspace } from './DemandWorkspace';
import { apiRequest } from '../utils/api';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [navigationSearch, setNavigationSearch] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const sectionHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenuOpen(false);
        menuTriggerRef.current?.focus();
      }
      if (event.key !== 'Tab') return;
      const focusable = mobileDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const isSuperAdmin = user?.roles?.includes('super-admin');
  const isAdmin = user?.roles?.includes('admin') || isSuperAdmin || user?.permissions?.includes('admin.panel.access');
  const activeTab = resolveAdminTab(searchParams.get('tab'), Boolean(isSuperAdmin));

  const fetchStats = async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const res = await apiRequest<AdminStats>('/api/admin/stats');
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        setStats(null);
        setStatsError(res.error || 'دریافت آمار مدیریت امکان‌پذیر نیست.');
      }
    } catch {
      setStats(null);
      setStatsError('ارتباط با سرویس آمار برقرار نشد.');
    } finally {
      setLoadingStats(false);
    }
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
        { id: 'demand' as AdminTab, label: 'نیازسنجی و گزارش مدیر گروه', icon: BarChart3 },
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

  const activeNavigation = navGroups.flatMap(group => group.items).find(item => item.id === activeTab);
  const filteredNavGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item =>
        (group.title + ' ' + item.label).toLocaleLowerCase('fa').includes(navigationSearch.trim().toLocaleLowerCase('fa')),
      ),
    }))
    .filter(group => group.items.length > 0);

  const selectTab = (id: AdminTab) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      if (id === 'overview') next.delete('tab');
      else next.set('tab', id);
      return next;
    });
    setMobileMenuOpen(false);
    setNavigationSearch('');
    requestAnimationFrame(() => sectionHeadingRef.current?.focus());
  };

  const navigation = (
    <nav aria-label="بخش‌های پنل مدیریت" className="space-y-5">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          aria-label="جست‌وجوی بخش‌های مدیریت"
          placeholder="جست‌وجوی بخش‌ها…"
          value={navigationSearch}
          onChange={event => setNavigationSearch(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-10 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>
      {filteredNavGroups.length === 0 && (
        <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">بخشی با این عبارت پیدا نشد.</p>
      )}
      {filteredNavGroups.map(group => (
        <div key={group.title}>
          <h3 className="mb-2 px-3 text-[11px] font-extrabold tracking-wide text-slate-500 dark:text-slate-400">{group.title}</h3>
          <div className="space-y-1">
            {group.items.map(item => {
              const ItemIcon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active
                    ? 'bg-blue-700 text-white shadow-sm shadow-blue-900/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}
                >
                  <ItemIcon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronLeft aria-hidden="true" className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="darschin-admin space-y-5">
      <header className="relative overflow-hidden rounded-[26px] bg-[#101c33] px-5 py-6 text-white shadow-lg shadow-slate-950/10 sm:px-7 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-32 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold tracking-wide text-blue-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
                <Shield aria-hidden="true" className="h-4 w-4" />
              </span>
              DARSCHIN / CONTROL CENTER
            </div>
            <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">مرکز مدیریت درس‌چین</h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-slate-300">
              داده‌های آموزشی، ساختار دانشگاه، ارائه‌های ترمی و پشتیبانی در یک محیط منظم.
            </p>
            <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
              {isBrowserDemo ? 'نمایش آزمایشی، بدون سرور' : 'پنل مدیریتی'}
              {isSuperAdmin ? ' · مدیر ارشد' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              ref={menuTriggerRef}
              type="button"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:hidden"
              aria-expanded={mobileMenuOpen}
              aria-controls="admin-mobile-navigation"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
              بخش‌های مدیریت
            </button>
            <button
              type="button"
              onClick={fetchStats}
              disabled={loadingStats}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-50"
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />
              <span>به‌روزرسانی</span>
            </button>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[252px_minmax(0,1fr)]">
        <aside className="darschin-admin-panel hidden max-h-[calc(100vh-2rem)] overflow-y-auto p-4 lg:sticky lg:top-4 lg:block" aria-label="ناوبری دسکتاپ مدیریت">
          <div className="mb-5 border-b border-slate-200 px-3 pb-4 text-sm font-black text-slate-900 dark:border-slate-700 dark:text-slate-100">
            بخش‌های مدیریت
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">انتخاب سریع بخش مورد نظر</p>
          </div>
          {navigation}
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[90] bg-slate-950/65 lg:hidden" onClick={() => { setMobileMenuOpen(false); menuTriggerRef.current?.focus(); }} role="presentation">
            <div
              ref={mobileDialogRef}
              id="admin-mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="فهرست بخش‌های مدیریت"
              onClick={event => event.stopPropagation()}
              className="absolute inset-y-0 right-0 flex w-[min(88vw,350px)] flex-col bg-white shadow-2xl dark:bg-slate-900"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
                <span className="inline-flex items-center gap-2 text-base font-black"><Shield className="h-5 w-5 text-blue-600" aria-hidden="true" /> بخش‌های مدیریت</span>
                <button
                  ref={mobileCloseRef}
                  type="button"
                  aria-label="بستن فهرست مدیریت"
                  onClick={() => { setMobileMenuOpen(false); menuTriggerRef.current?.focus(); }}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-800"
                ><X aria-hidden="true" className="h-5 w-5" /></button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">{navigation}</div>
              <div className="border-t border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {isBrowserDemo ? 'تغییرات فقط در همین مرورگر ذخیره می‌شوند.' : 'تغییرات داده‌ها ممکن است روی کاربران اثر بگذارند.'}
              </div>
            </div>
          </div>
        )}

        <section aria-label="محتوای مدیریت" className="min-w-0 space-y-4">
          <div className="darschin-admin-panel flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">مدیریت / {navGroups.find(group => group.items.some(item => item.id === activeTab))?.title}</p>
              <h2 ref={sectionHeadingRef} tabIndex={-1} className="mt-1 rounded-lg text-xl font-black text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-white">{activeNavigation?.label}</h2>
            </div>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{isBrowserDemo ? 'اطلاعات نمونه' : 'محیط مدیریت'}</span>
          </div>
      {statsError && activeTab === 'overview' && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          <span className="font-bold">آمار در دسترس نیست: </span>{statsError}
          <button type="button" onClick={fetchStats} className="mr-3 min-h-11 rounded-lg px-3 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">تلاش دوباره</button>
        </div>
      )}
      {/* Main Tab Content Area */}
      <div className="pt-1">
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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
                    دانشجویان ثبت‌نام‌شده
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
                    onClick={() => selectTab('courses')}
                    className="p-3 bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 text-right transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    بانک دروس
                  </button>
                  <button
                    onClick={() => selectTab('academic-rules')}
                    className="p-3 bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 text-right transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <Workflow className="w-4 h-4 text-emerald-500" />
                    پیش‌نیازها و هم‌نیازها
                  </button>
                  <button
                    onClick={() => selectTab('offerings')}
                    className="p-3 bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 text-right transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <Layers className="w-4 h-4 text-amber-500" />
                    ارائه‌های ترمی
                  </button>
                  {isSuperAdmin && (
                    <button
                                        onClick={() => selectTab('diagnostics')}
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
            description="زمان کلاس می‌تواند هنوز اعلام نشده باشد؛ ساعت شروع و پایان را هر دو خالی بگذارید و پس از اعلام تکمیل کنید."
            endpoint="/api/offerings"
            columns={[
              { key: 'termId', label: 'نیمسال', type: 'select', lookupEndpoint: '/api/academic/terms' },
              { key: 'campusId', label: 'واحد دانشگاهی', type: 'select', lookupEndpoint: '/api/academic/campuses' },
              { key: 'courseId', label: 'درس مرتبط', type: 'select', lookupEndpoint: '/api/academic/courses' },
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

        {/* Department demand collection is independent from live course registration. */}
        {activeTab === 'demand' && <DemandWorkspace role="admin" />}

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
        </section>
      </div>
    </div>
  );
};
