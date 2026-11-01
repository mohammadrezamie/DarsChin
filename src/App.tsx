import React, { lazy, Suspense, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { PasswordChangeModal } from './components/PasswordChangeModal';
import { ExtensionModal } from './components/ExtensionModal';

import { BrowserRouter, HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { SiteFooter } from './components/SiteFooter';
import { adminWorkspaceAccess } from './utils/admin-navigation';
const Landing = lazy(() => import('./pages/Landing').then((module) => ({ default: module.Landing })));
const PlannerDemo = lazy(() => import('./pages/PlannerDemo').then((module) => ({ default: module.PlannerDemo })));
const DemoWorkspace = lazy(() => import('./pages/DemoWorkspace').then((module) => ({ default: module.DemoWorkspace })));
const Login = lazy(() => import('./pages/auth/Login').then((module) => ({ default: module.Login })));
const Register = lazy(() => import('./pages/auth/Register').then((module) => ({ default: module.Register })));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword').then((module) => ({ default: module.ForgotPassword })));
const StudentGuide = lazy(() => import('./pages/StudentGuide').then((module) => ({ default: module.StudentGuide })));
const StudentDashboard = lazy(() => import('./components/StudentDashboard').then((module) => ({ default: module.StudentDashboard })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));

// GitHub Pages is a standalone, hash-routed synthetic preview, never the real app.
const PreviewRouter = import.meta.env.VITE_STATIC_PREVIEW === 'true' ? HashRouter : BrowserRouter;

const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: string[] }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">درحال بارگذاری...</div>;

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = user.roles?.some(role => allowedRoles.includes(role)) || user.roles?.includes('super-admin');
    const hasPermission = user.permissions?.includes('admin.panel.access');
    
    if (allowedRoles.includes('admin') && (!hasRole && !hasPermission)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
};

/** A linkless route is not private by itself. Guard the synthetic admin demo too. */
const AdminDemoGate: React.FC = () => {
  const { user, isLoading } = useAuth();
  // Only the synthetic admin workspace is accessible on the static Pages preview.
  if (import.meta.env.VITE_STATIC_PREVIEW === 'true') return <DemoWorkspace role="admin" />;
  if (isLoading) return <div role="status" className="flex min-h-[65dvh] items-center justify-center p-6">در حال بررسی دسترسی…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!adminWorkspaceAccess(user).isAdmin) return <Navigate to="/dashboard" replace />;
  return <DemoWorkspace role="admin" />;
};

const DashboardLayout: React.FC = () => {
  const { user } = useAuth();
  const [isPasswordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [isExtModalOpen, setExtModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-transparent font-sans text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar
        activeTab={window.location.pathname.includes('/admin') ? 'admin' : 'student'}
        setActiveTab={() => {}}
        onOpenAuth={() => {}}
        onOpenProfile={() => {}}
        onOpenPasswordChange={() => setPasswordChangeOpen(true)}
      />
      <main className="max-w-7xl mx-auto px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
        <Outlet />
      </main>

      <PasswordChangeModal
        isOpen={isPasswordChangeOpen}
        onClose={() => setPasswordChangeOpen(false)}
      />
      <ExtensionModal
        isOpen={isExtModalOpen}
        onClose={() => setExtModalOpen(false)}
        onOpenMockPortal={() => {}}
      />
    </div>
  );
};

const AppRouteShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  return (
    <div dir="rtl" className="darschin-app-shell flex min-h-dvh flex-col">
      <a href="#darschin-page-content" className="darschin-skip-link">رفتن به محتوای اصلی</a>
      <div id="darschin-page-content" tabIndex={-1} className="min-w-0 flex-1">
        <AppErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={
            <div dir="rtl" role="status" aria-live="polite" className="mx-auto flex min-h-[65dvh] max-w-6xl flex-col justify-center gap-5 px-4 py-16 sm:px-6">
              <div className="darschin-loading-pulse h-4 w-28 rounded-full bg-blue-200 dark:bg-blue-800" aria-hidden="true" />
              <div className="darschin-loading-pulse h-10 w-[min(75%,340px)] rounded-xl bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                <div className="darschin-loading-pulse h-40 rounded-3xl bg-slate-200 dark:bg-slate-800" />
                <div className="darschin-loading-pulse h-40 rounded-3xl bg-slate-200 dark:bg-slate-800" />
                <div className="darschin-loading-pulse hidden h-40 rounded-3xl bg-slate-200 dark:bg-slate-800 lg:block" />
              </div>
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300">در حال آماده‌سازی فضای درس‌چین…</span>
            </div>
          }>
            {children}
          </Suspense>
        </AppErrorBoundary>
      </div>
      <SiteFooter withMobileDock={location.pathname === '/dashboard' || location.pathname === '/demo/student'} />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PreviewRouter>
          <AppRouteShell>
            <Routes>
              <Route path="/" element={<Landing />} />
              {/* Full-featured synthetic workspaces: no account, token, or backend required. */}
              <Route path="/demo" element={<PlannerDemo />} />
              <Route path="/demo/student" element={<DemoWorkspace role="student" />} />
              <Route path="/demo/admin" element={<AdminDemoGate />} />
              <Route path="/help" element={<StudentGuide />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              <Route element={<DashboardLayout />}>
                <Route element={<ProtectedRoute allowedRoles={['student']} />}>
                  <Route path="/dashboard" element={<StudentDashboard />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppRouteShell>
        </PreviewRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
