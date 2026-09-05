import React from 'react';
import { GraduationCap, LogOut, Moon, Sun, UserCheck, Shield, KeyRound } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  activeTab: 'student' | 'admin' | 'mock-portal' | 'extension';
  setActiveTab: (tab: 'student' | 'admin' | 'mock-portal' | 'extension') => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenPasswordChange?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAuth,
  onOpenProfile,
  onOpenPasswordChange,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-liquid-glass !rounded-none !border-x-0 !border-t-0 border-b transition-colors print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-6">
            <div
              id="brandLogo"
              onClick={() => setActiveTab('student')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 transition-all dark:bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  درس‌چین
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:block">
                  دستیار هوشمند انتخاب واحد دانشجویان دانشگاه آزاد اسلامی
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/10">
              <button onClick={() => setActiveTab('student')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'student' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>میز کار دانشجو</button>
              {(user?.roles?.includes('super-admin') || user?.permissions?.includes('admin.panel.access')) && (
                <button onClick={() => setActiveTab('admin')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'admin' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>پنل مدیریت</button>
              )}
              <button onClick={() => setActiveTab('extension')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'extension' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'}`}>افزونه کروم</button>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            
            {user ? (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 dark:bg-slate-800 py-1 px-2 sm:px-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div
                  id="userProfilePill"
                  onClick={onOpenProfile}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                    {user.roles?.includes('admin') ? <Shield className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[80px] sm:max-w-[120px] truncate">
                    {user.name}
                  </span>
                </div>

                {onOpenPasswordChange && (
                  <button
                    id="btnChangePassword"
                    onClick={onOpenPasswordChange}
                    title="تغییر رمز عبور"
                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 rounded-md transition-colors"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                )}

                <button
                  id="btnLogout"
                  onClick={logout}
                  title="خروج از حساب"
                  className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="btnOpenAuth"
                onClick={onOpenAuth}
                className="px-3 sm:px-4 py-2 bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 transition-all hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                ورود / ثبت‌نام
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-200/80 dark:border-slate-800/80 text-xs">
          <button
            onClick={() => setActiveTab('student')}
            className={`px-3 py-1 rounded-xl transition-colors font-medium ${activeTab === 'student' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            میز کار
          </button>
          {(user?.roles?.includes('super-admin') || user?.permissions?.includes('admin.panel.access')) && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1 rounded-xl transition-colors font-medium ${activeTab === 'admin' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              پنل مدیریت
            </button>
          )}
          <button
            onClick={() => setActiveTab('mock-portal')}
            className={`px-3 py-1 rounded-xl transition-colors font-medium ${activeTab === 'mock-portal' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            آموزشیار
          </button>
          <button
            onClick={() => setActiveTab('extension')}
            className={`px-3 py-1 rounded-xl transition-colors font-medium ${activeTab === 'extension' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            افزونه
          </button>
        </div>
      </div>
    </header>
  );
};
