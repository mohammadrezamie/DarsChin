import React, { useEffect, useRef, useState } from 'react';
import { GraduationCap, LogOut, UserCheck, Shield, KeyRound, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { Link, useLocation } from 'react-router-dom';
import { ExtensionModal } from './ExtensionModal';
import { adminWorkspaceAccess } from '../utils/admin-navigation';

interface NavbarProps {
  activeTab: 'student' | 'admin' | 'mock-portal' | 'extension';
  setActiveTab: (tab: 'student' | 'admin' | 'mock-portal' | 'extension') => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenPasswordChange?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenPasswordChange }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const activeTab = location.pathname.includes('/admin') ? 'admin' : 'student';
  const canManage = adminWorkspaceAccess(user).isAdmin;
  const [isExtModalOpen, setExtModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        triggerRef.current?.focus();
      }
      if (event.key !== 'Tab') return;
      const candidates = mobileNavRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!candidates?.length) return;
      const first = candidates[0], last = candidates[candidates.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileMenuOpen]);
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);
  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header className="darschin-product-header sticky top-0 z-40 !rounded-none !border-x-0 !border-t-0 border-b transition-colors print:hidden">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-2">
            {/* RTL: the first flex item appears at the RIGHT edge. */}
            <div className="flex min-w-0 items-center gap-2 sm:gap-6">
              {user && (
                <button
                  ref={triggerRef}
                  type="button"
                  aria-label="بازکردن منوی اصلی"
                  aria-expanded={mobileMenuOpen}
                  aria-controls="mobile-main-navigation"
                  onClick={() => setMobileMenuOpen(true)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <Menu aria-hidden="true" className="h-5 w-5" />
                </button>
              )}
              <Link to={user ? '/dashboard' : '/'} className="group flex min-w-0 items-center gap-2 sm:gap-3">
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl darschin-primary-cta text-white shadow-lg sm:flex dark:bg-blue-500">
                  <GraduationCap aria-hidden="true" className="h-6 w-6" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <strong className="text-lg font-black tracking-tight text-slate-900 sm:text-xl dark:text-white">درس‌چین</strong>
                  <span className="hidden text-[11px] font-medium text-slate-500 sm:block dark:text-slate-400">دستیار هوشمند انتخاب واحد دانشگاه آزاد</span>
                </span>
              </Link>
              {user && (
                <nav aria-label="ناوبری اصلی دسکتاپ" className="hidden items-center gap-1.5 rounded-xl border border-black/5 bg-black/5 p-1 md:flex dark:border-white/10 dark:bg-white/5">
                  <Link to="/dashboard" aria-current={activeTab === 'student' ? 'page' : undefined}
                    className={`rounded-lg px-3 py-2 text-xs font-bold ${activeTab === 'student' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>میز کار دانشجو</Link>
                  {canManage && (
                    <Link to="/admin" aria-current={activeTab === 'admin' ? 'page' : undefined}
                      className={`rounded-lg px-3 py-2 text-xs font-bold ${activeTab === 'admin' ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>پنل مدیریت</Link>
                  )}
                  <button type="button" onClick={() => setExtModalOpen(true)} className="min-h-10 rounded-lg px-3 text-xs font-bold text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-800">افزونه کروم</button>
                </nav>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-3">
              <ThemeToggle />
              {user ? (
                <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-2 py-1 sm:flex dark:border-slate-700 dark:bg-slate-800">
                  <Link to="/dashboard" className="flex min-h-9 items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {canManage ? <Shield aria-hidden="true" className="h-4 w-4" /> : <UserCheck aria-hidden="true" className="h-4 w-4" />}
                    </span>
                    <span className="hidden max-w-[110px] truncate text-xs font-semibold text-slate-800 lg:inline dark:text-slate-100">{user.name}</span>
                  </Link>
                  {onOpenPasswordChange && (
                    <button type="button" onClick={onOpenPasswordChange} aria-label="تغییر رمز عبور" className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-500 hover:text-blue-700 dark:hover:text-blue-300"><KeyRound aria-hidden="true" className="h-4 w-4" /></button>
                  )}
                  <button type="button" onClick={logout} aria-label="خروج از حساب" className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-500 hover:text-rose-700 dark:hover:text-rose-300"><LogOut aria-hidden="true" className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="hidden gap-2 sm:flex">
                  <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-bold text-slate-800 dark:text-white">ورود</Link>
                  <Link to="/register" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">ثبت‌نام</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {user && mobileMenuOpen && (
        <div className="fixed inset-0 z-[80] md:hidden print:hidden" dir="rtl">
          <div role="presentation" className="absolute inset-0 bg-slate-950/60"
            onClick={() => { closeMenu(); triggerRef.current?.focus(); }} />
          <nav ref={mobileNavRef} id="mobile-main-navigation" role="dialog" aria-modal="true" aria-label="منوی اصلی موبایل"
            className="darschin-drawer absolute inset-y-0 right-0 flex w-[min(90vw,360px)] flex-col overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-700">
              <strong className="text-lg font-black text-slate-900 dark:text-white">منوی درس‌چین</strong>
              <button ref={mobileCloseRef} type="button" aria-label="بستن منوی اصلی" onClick={() => { closeMenu(); triggerRef.current?.focus(); }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-800">
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm font-bold">
              <Link to="/dashboard" onClick={closeMenu} aria-current={activeTab === 'student' ? 'page' : undefined}
                className="flex min-h-12 items-center rounded-xl px-4 text-slate-800 hover:bg-blue-50 dark:text-white dark:hover:bg-slate-800">میز کار دانشجو</Link>
              {canManage && <Link to="/admin" onClick={closeMenu} aria-current={activeTab === 'admin' ? 'page' : undefined}
                className="flex min-h-12 items-center rounded-xl px-4 text-slate-800 hover:bg-blue-50 dark:text-white dark:hover:bg-slate-800">پنل مدیریت</Link>}
              <button type="button" onClick={() => { closeMenu(); setExtModalOpen(true); }}
                className="flex min-h-12 w-full items-center rounded-xl px-4 text-right text-slate-800 hover:bg-blue-50 dark:text-white dark:hover:bg-slate-800">افزونه کروم</button>
              {onOpenPasswordChange && <button type="button" onClick={() => { closeMenu(); onOpenPasswordChange(); }}
                className="flex min-h-12 w-full items-center rounded-xl px-4 text-right text-slate-800 hover:bg-blue-50 dark:text-white dark:hover:bg-slate-800">تغییر رمز عبور</button>}
              <button type="button" onClick={() => { closeMenu(); logout(); }}
                className="flex min-h-12 w-full items-center rounded-xl px-4 text-right text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30">خروج از حساب</button>
            </div>
          </nav>
        </div>
      )}
      <ExtensionModal
        isOpen={isExtModalOpen}
        onClose={() => setExtModalOpen(false)}
        onOpenMockPortal={() => {}}
      />
    </>
  );
};
