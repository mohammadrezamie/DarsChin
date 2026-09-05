// ============================================================================
// DARSCHYN (درس‌چین) - Main Application Component
// ============================================================================

import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { PasswordChangeModal } from './components/PasswordChangeModal';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ExtensionModal } from './components/ExtensionModal';

import { useAuth } from './context/AuthContext';

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTabState] = useState<'student' | 'admin' | 'mock-portal' | 'extension'>(() => {
    return (localStorage.getItem('darschyn_active_tab') as any) || 'student';
  });

  const setActiveTab = (tab: 'student' | 'admin' | 'mock-portal' | 'extension') => {
    setActiveTabState(tab);
    localStorage.setItem('darschyn_active_tab', tab);
  };
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isPasswordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [isExtModalOpen, setExtModalOpen] = useState(false);

  // When 'extension' tab is clicked, open modal instead of routing, then stay on current view
  React.useEffect(() => {
    if (!isLoading && activeTab === 'admin') {
      if (!user || (!user.roles?.includes('super-admin') && !user.permissions?.includes('admin.panel.access'))) {
        setActiveTab('student');
      }
    }
  }, [user, isLoading, activeTab]);

  const handleTabChange = (tab: 'student' | 'admin' | 'mock-portal' | 'extension') => {
    if (tab === 'extension') {
      setExtModalOpen(true);
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <div className="min-h-screen bg-transparent font-sans text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenProfile={() => {
          if (activeTab !== 'student') setActiveTab('student');
        }}
        onOpenPasswordChange={() => setPasswordChangeOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'student' && <StudentDashboard />}
        {activeTab === 'admin' && <AdminDashboard />}
        {activeTab === 'mock-portal' && (
          <div className="h-[80vh] border-0 rounded-3xl overflow-hidden bg-liquid-glass">
            {/* Embed the mock portal HTML directly in an iframe */}
            <iframe
              src="/mock-portal-static/index.html"
              title="Mock Educational Portal"
              className="w-full h-full border-none"
            />
          </div>
        )}
      </main>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
        onLoginSuccess={(roles) => {
          if (roles && (roles.includes('admin') || roles.includes('super-admin'))) {
            setActiveTab('admin');
          }
          setAuthModalOpen(false);
        }} 
      />
      <PasswordChangeModal
        isOpen={isPasswordChangeOpen}
        onClose={() => setPasswordChangeOpen(false)}
      />
      <ExtensionModal
        isOpen={isExtModalOpen}
        onClose={() => setExtModalOpen(false)}
        onOpenMockPortal={() => setActiveTab('mock-portal')}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
