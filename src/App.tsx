import React, { lazy, Suspense, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { PasswordChangeModal } from './components/PasswordChangeModal';
import { ExtensionModal } from './components/ExtensionModal';

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
const Landing = lazy(() => import('./pages/Landing').then((module) => ({ default: module.Landing })));
const PlannerDemo = lazy(() => import('./pages/PlannerDemo').then((module) => ({ default: module.PlannerDemo })));
const DemoWorkspace = lazy(() => import('./pages/DemoWorkspace').then((module) => ({ default: module.DemoWorkspace })));
const Login = lazy(() => import('./pages/auth/Login').then((module) => ({ default: module.Login })));
const Register = lazy(() => import('./pages/auth/Register').then((module) => ({ default: module.Register })));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword').then((module) => ({ default: module.ForgotPassword })));
const StudentDashboard = lazy(() => import('./components/StudentDashboard').then((module) => ({ default: module.StudentDashboard })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));

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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
<Suspense fallback={<div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">درحال بارگذاری...</div>}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/demo" element={<PlannerDemo />} />
              <Route path="/demo/student" element={<DemoWorkspace role="student" />} />
              <Route path="/demo/admin" element={<DemoWorkspace role="admin" />} />
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
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
