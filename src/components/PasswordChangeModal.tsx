// ============================================================================
// DARSCHYN (درس‌چین) - Password Change Modal
// ============================================================================

import React, { useState } from 'react';
import { X, Lock, KeyRound, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({ isOpen, onClose }) => {
  const { changePassword, user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError('لطفاً رمز عبور فعلی را وارد کنید.');
      return;
    }

    if (newPassword.length < 6) {
      setError('رمز عبور جدید باید حداقل شامل ۶ کاراکتر باشد.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('تکرار رمز عبور جدید مطابقت ندارد.');
      return;
    }

    setLoading(true);
    const res = await changePassword(currentPassword, newPassword);
    setLoading(false);

    if (res.success) {
      setSuccess(res.message || 'رمز عبور با موفقیت به‌روزرسانی شد.');
      setTimeout(() => {
        onClose();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setSuccess(null);
      }, 1500);
    } else {
      setError(res.error || 'خطا در تغییر رمز عبور.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md">
      <div dir="rtl" role="dialog" aria-modal="true" aria-label="تغییر رمز عبور" className="darschin-dialog darschin-page bg-liquid-glass w-full max-w-md rounded-3xl border border-white/20 shadow-2xl dark:border-slate-700/50">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-slate-800/80 dark:to-slate-900/80 p-6 border-b border-slate-200/60 dark:border-slate-700/60">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 bg-indigo-600 shadow-lg shadow-indigo-500/25 rounded-2xl flex items-center justify-center text-white mb-4">
            <KeyRound className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">
            تغییر رمز عبور
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            حساب کاربری: <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{user?.mobile}</span>
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs rounded-2xl border border-rose-200/60 dark:border-rose-900/60 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs rounded-2xl border border-emerald-200/60 dark:border-emerald-900/60 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رمز عبور فعلی</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  dir="ltr"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-10 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رمز عبور جدید (حداقل ۶ کاراکتر)</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  dir="ltr"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-10 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">تکرار رمز عبور جدید</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showNew ? 'text' : 'password'}
                  dir="ltr"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-900/50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              ثبت رمز عبور جدید
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
