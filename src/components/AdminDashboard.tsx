// ============================================================================
// DARSCHYN (درس‌چین) - Core Admin & Educational Management Dashboard
// ============================================================================

import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { resolveAdminTab, adminWorkspaceAccess, type AdminTab } from '../utils/admin-navigation';
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
  CircleHelp,
} from 'lucide-react';









import { ContextualHelp } from './ContextualHelp';
import { adminSectionHelp } from '../help/admin-sections';



import { apiRequest } from '../utils/api';

// Only the selected management tool is shipped to the browser. Large CRUD,
// chart, import and user-management screens are no longer required at login.
const AdminCrudTable = lazy(() => import('./AdminCrudTable').then(module => ({ default: module.AdminCrudTable })));
const AdminCurriculumBuilder = lazy(() => import('./AdminCurriculumBuilder').then(module => ({ default: module.AdminCurriculumBuilder })));
const UserManagement = lazy(() => import('./UserManagement').then(module => ({ default: module.UserManagement })));
const AdminSyncStatus = lazy(() => import('./AdminSyncStatus').then(module => ({ default: module.AdminSyncStatus })));
const AdminLogs = lazy(() => import('./AdminLogs').then(module => ({ default: module.AdminLogs })));
const AdminSupportPanel = lazy(() => import('./AdminSupportPanel').then(module => ({ default: module.AdminSupportPanel })));
const AdminDiagnostics = lazy(() => import('./AdminDiagnostics').then(module => ({ default: module.AdminDiagnostics })));
const AdminAcademicSettings = lazy(() => import('./AdminAcademicSettings').then(module => ({ default: module.AdminAcademicSettings })));
const AdminAcademicRules = lazy(() => import('./AdminAcademicRules').then(module => ({ default: module.AdminAcademicRules })));
const AdminImportCenter = lazy(() => import('./AdminImportCenter').then(module => ({ default: module.AdminImportCenter })));
const DemandWorkspace = lazy(() => import('./DemandWorkspace').then(module => ({ default: module.DemandWorkspace })));
const AdminSmsCenter = lazy(() => import('./AdminSmsCenter').then(module => ({ default: module.AdminSmsCenter })));

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
  const desktopNavRef = useRef<HTMLElement>(null);

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

  // Cmd/Ctrl+K brings administrators straight to their destination. "/" works
  // only outside editable controls, preserving normal typing in forms.
  useEffect(() => {
    const onNavigationShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const editable = event.target instanceof HTMLElement &&
        (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));
      if (!((key === 'k' && (event.metaKey || event.ctrlKey)) ||
          (event.key === '/' && !editable && !event.metaKey && !event.ctrlKey && !event.altKey))) return;
      event.preventDefault();
      if (window.matchMedia('(min-width: 1024px)').matches) {
        desktopNavRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      } else {
        setMobileMenuOpen(true);
        requestAnimationFrame(() =>
          mobileDialogRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus());
      }
    };
    document.addEventListener('keydown', onNavigationShortcut);
    return () => document.removeEventListener('keydown', onNavigationShortcut);
  }, []);

  // A department manager receives only the survey workspace, not global admin menus.
  const { isSuperAdmin, demandOnly, isAdmin } = adminWorkspaceAccess(user);
  const activeTab = demandOnly ? 'demand' : resolveAdminTab(searchParams.get('tab'), isSuperAdmin);

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
    if (isAdmin && !demandOnly) {
      fetchStats();
    }
  }, [isAdmin, demandOnly]);

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
        { id: 'curricula' as AdminTab, label: 'چارت‌های تحصیلی', icon: FileSpreadsheet },
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
        ...(isSuperAdmin || user?.permissions?.includes('sms.manage') ? [{id:'sms-center' as AdminTab,label:'مرکز پیامک نیازپرداز',icon:MessageSquare}]:[]),
      ],
    },
  ].map(group => demandOnly
    ? { ...group, items: group.items.filter(item => item.id === 'demand') }
    : group
  ).filter(group => group.items.length > 0);

  const activeNavigation = navGroups.flatMap(group => group.items).find(item => item.id === activeTab);
  const activeCategory = navGroups.find(group => group.items.some(item => item.id === activeTab))?.title || 'میز کار';
  const visibleSectionCount = navGroups.reduce((total, group) => total + group.items.length, 0);
  const mainStats = [
    { label: 'دانشجویان', value: stats?.totalStudents, icon: GraduationCap, color: 'text-blue-700 dark:text-blue-300', tint: 'bg-blue-50 dark:bg-blue-950/50' },
    { label: 'دروس بانک', value: stats?.totalCourses, icon: BookOpen, color: 'text-violet-700 dark:text-violet-300', tint: 'bg-violet-50 dark:bg-violet-950/40' },
    { label: 'چارت‌های تحصیلی', value: stats?.totalCurricula, icon: FileSpreadsheet, color: 'text-teal-700 dark:text-teal-300', tint: 'bg-teal-50 dark:bg-teal-950/40' },
    { label: 'واحدهای دانشگاهی', value: stats?.totalCampuses, icon: School, color: 'text-amber-700 dark:text-amber-300', tint: 'bg-amber-50 dark:bg-amber-950/40' },
  ];
  const extraStats = [
    { label: 'کاربران', count: stats?.totalUsers },
    { label: 'استان‌ها', count: stats?.totalProvinces },
    { label: 'رشته‌ها', count: stats?.totalMajors },
    { label: 'گرایش‌ها', count: stats?.totalTracks },
  ];
  const formatCount = (value: number | undefined) => value === undefined
    ? (loadingStats ? '…' : '—') : value.toLocaleString('fa-IR');

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
    <nav aria-label="بخش‌های پنل مدیریت" className="space-y-4">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          aria-label="جست‌وجوی بخش‌های مدیریت"
          placeholder="نام بخش را بنویسید…"
          value={navigationSearch}
          onChange={event => setNavigationSearch(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-14 pr-10 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <kbd aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">⌘ K</kbd>
      </div>
      {filteredNavGroups.length === 0 && (
        <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">بخشی با این عبارت پیدا نشد.</p>
      )}
      {filteredNavGroups.map(group => (
        <div key={group.title}>
          <h3 className="mb-2 flex items-center justify-between gap-2 px-3 text-[11px] font-extrabold tracking-wide text-slate-500 dark:text-slate-400">
            {group.title}
            <span className="font-mono text-[10px] font-semibold text-slate-400">{group.items.length.toLocaleString('fa-IR')}</span>
          </h3>
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
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20 dark:bg-blue-500'
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
    <div dir="rtl" className="darschin-page darschin-admin min-w-0 space-y-4 pb-8 sm:space-y-5">
      <header className="relative isolate overflow-hidden rounded-[1.5rem] border border-slate-800/70 bg-[#101d32] px-4 py-4 text-white shadow-[0_22px_50px_-35px_rgba(9,22,45,.8)] sm:px-6 sm:py-5">
        <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-20 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner sm:h-14 sm:w-14"><Shield className="h-6 w-6 text-sky-200" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-blue-200">درس‌چین / میز کار مدیریت</p>
              <h1 className="mt-0.5 text-lg font-extrabold leading-relaxed sm:text-2xl">مرکز مدیریت آموزشی</h1>
              <p className="hidden text-xs leading-6 text-slate-300 sm:block">{demandOnly ? 'عملیات نیازسنجی در محدودهٔ مجاز شما' : 'ساختار دانشگاه، داده‌های آموزشی و عملیات سامانه در یک فضا'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 text-[11px] font-bold text-blue-100">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-sky-300" />
              {isBrowserDemo ? 'دادهٔ آزمایشی' : demandOnly ? 'مدیر گروه' : isSuperAdmin ? 'مدیر ارشد' : 'مدیر دارای مجوز'}
            </span>
            {!demandOnly && <button type="button" onClick={fetchStats} disabled={loadingStats}
              aria-label="به‌روزرسانی آمار پنل مدیریت"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold transition hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-60">
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loadingStats ? 'animate-spin motion-reduce:animate-none' : ''}`} />
              به‌روزرسانی
            </button>}
          </div>
        </div>
      </header>

      {/* On a long admin table, the old header-only drawer trigger scrolled away.
          Keep workspace switching reachable, with the actual section labelled. */}
      <div aria-label="ناوبری سریع مدیریت"
        className={`sticky z-30 flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-2 py-2 shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95 lg:hidden print:hidden ${isBrowserDemo ? 'top-0' : 'top-[68px]'}`}>
        <button
          ref={menuTriggerRef}
          type="button"
          aria-label="بازکردن فهرست بخش‌های مدیریت"
          aria-expanded={mobileMenuOpen}
          aria-controls="admin-mobile-navigation"
          onClick={() => setMobileMenuOpen(true)}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:bg-blue-500">
          <Menu aria-hidden="true" className="h-5 w-5" />
          بخش‌ها
        </button>
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] leading-4 text-slate-500 dark:text-slate-400">در حال مدیریت</span>
          <span className="block truncate text-xs font-extrabold text-slate-900 dark:text-white">{activeNavigation?.label || 'داشبورد و آمار'}</span>
        </div>
        <ChevronLeft aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(240px,276px)_minmax(0,1fr)] lg:gap-5">
        <aside ref={desktopNavRef} className="darschin-admin-panel hidden max-h-[calc(100dvh-6rem)] overscroll-contain overflow-y-auto rounded-[1.4rem] border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-5 lg:block" aria-label="ناوبری دسکتاپ مدیریت">
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 px-2 pb-3 pt-1 dark:border-slate-800">
            <div>
              <h2 className="text-[13px] font-extrabold text-slate-950 dark:text-white">فضای کاری</h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{visibleSectionCount.toLocaleString('fa-IR')} بخش در محدودهٔ دسترسی شما</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200"><Layers className="h-4 w-4" aria-hidden="true"/></span>
          </div>
          {navigation}
          <div className="mt-4 border-t border-slate-100 px-2 pt-3 text-[11px] leading-6 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <CircleHelp aria-hidden="true" className="ml-1 inline h-3.5 w-3.5" /> جست‌وجوی سریع با Ctrl/⌘ + K
          </div>
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
              className="darschin-drawer absolute inset-y-0 right-0 flex w-[min(90vw,360px)] flex-col bg-white shadow-2xl dark:bg-slate-900"
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
              <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto p-4">{navigation}</div>
              <div className="border-t border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {isBrowserDemo ? 'تغییرات فقط در همین مرورگر ذخیره می‌شوند.' : 'تغییرات داده‌ها ممکن است روی کاربران اثر بگذارند.'}
              </div>
            </div>
          </div>
        )}

        <section aria-label="محتوای مدیریت" className="min-w-0 space-y-4">
          <ContextualHelp key={activeTab} audience="admin" content={adminSectionHelp(activeTab)} />
          <div className="darschin-admin-panel flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:px-5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">میز کار / {activeCategory}</p>
              <h2 ref={sectionHeadingRef} tabIndex={-1} className="mt-1 rounded-lg text-lg font-extrabold leading-relaxed text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-white sm:text-xl">{activeNavigation?.label || 'پیشخوان'}</h2>
              <p className="mt-1 hidden text-xs text-slate-500 dark:text-slate-400 sm:block">اطلاعات و عملیات این بخش را در همین صفحه مدیریت کنید.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              {isBrowserDemo ? 'حالت آزمایشی' : 'محیط مدیریت'}
            </span>
          </div>

      {statsError && activeTab === 'overview' && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          <span className="font-bold">آمار در دسترس نیست: </span>{statsError}
          <button type="button" onClick={fetchStats} className="mr-3 min-h-11 rounded-lg px-3 font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">تلاش دوباره</button>
        </div>
      )}
      {/* Main Tab Content Area */}
      <Suspense fallback={<div role="status" aria-live="polite" className="flex min-h-44 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 p-5 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">در حال بازکردن ابزار مدیریت…</div>}>
      <div className="pt-1">
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Four key indicators and a compact secondary scorecard. */}
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3" aria-label="شاخص‌های اصلی مدیریت">
              {mainStats.map(({ label, value, icon: Icon, color, tint }) => (
                <div key={label} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
                  <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tint} ${color}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="block text-[11px] font-bold leading-6 text-slate-600 dark:text-slate-300 sm:text-xs">{label}</span>
                  <strong className="mt-1 block text-[clamp(1.25rem,2.5vw,1.85rem)] font-extrabold tabular-nums leading-tight text-slate-950 dark:text-white">{formatCount(value)}</strong>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-4" aria-label="سایر شاخص‌های مدیریت">
              {extraStats.map(item => (
                <div key={item.label} className="min-w-0 rounded-xl px-3 py-2">
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">{item.label}</span>
                  <strong className="mt-1 block text-base font-extrabold tabular-nums text-slate-800 dark:text-slate-100">{formatCount(item.count)}</strong>
                </div>
              ))}
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
                    type="button" onClick={() => selectTab('courses')}
                    className="p-3 bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 text-right transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    بانک دروس
                  </button>
                  <button
                    type="button" onClick={() => selectTab('academic-rules')}
                    className="p-3 bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 text-right transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <Workflow className="w-4 h-4 text-emerald-500" />
                    پیش‌نیازها و هم‌نیازها
                  </button>
                  <button
                    type="button" onClick={() => selectTab('offerings')}
                    className="p-3 bg-white/50 dark:bg-slate-800/40 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 text-right transition-all text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                  >
                    <Layers className="w-4 h-4 text-amber-500" />
                    ارائه‌های ترمی
                  </button>
                  {isSuperAdmin && (
                    <button
                                        type="button" onClick={() => selectTab('diagnostics')}
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
            title="مدیریت واحدهای دانشگاهی"
            description="واحدهای جامع، استانی، بین‌الملل و مستقل"
            endpoint="/api/academic/campuses"
            columns={[
              { key: 'universityId', label: 'دانشگاه', type: 'select', required: true, lookupEndpoint: '/api/academic/universities' },
              { key: 'name', label: 'نام واحد دانشگاهی' },
              { key: 'code', label: 'کد واحد' },
              {
                key: 'type',
                label: 'نوع واحد',
                type: 'select',
                options: [
                  { label: 'واحد استانی', value: 'PROVINCE_UNIT' },
                  { label: 'واحد جامع مستقل', value: 'COMPREHENSIVE_INDEPENDENT' },
                  { label: 'واحد بین‌الملل', value: 'INTERNATIONAL' },
                ],
              },
              { key: 'provinceId', label: 'استان (اختیاری)', type: 'select', lookupEndpoint: '/api/academic/provinces' },
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
              { key: 'degreeLevelId', label: 'مقطع تحصیلی', type: 'select', required: true, lookupEndpoint: '/api/academic/degrees' },
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
              { key: 'majorId', label: 'رشتهٔ مرتبط', type: 'select', required: true, lookupEndpoint: '/api/academic/majors' },
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
        {activeTab === 'sms-center' && <AdminSmsCenter />}

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
      </Suspense>
        </section>
      </div>
    </div>
  );
};
