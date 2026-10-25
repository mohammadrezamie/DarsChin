// ============================================================================
// DARSCHYN (درس‌چین) - Authentication Modal (Mobile Number + Password)
// ============================================================================

import React, { useState } from 'react';
import {
  X,
  Phone,
  Lock,
  User as UserIcon,
  LogIn,
  UserPlus,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GuestHumanCheck } from './GuestHumanCheck';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (roles: string[]) => void;
}

type AuthMode = 'login' | 'register' | 'recover';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const { login, register, recoverPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');

  // Form states
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');

  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [createdRecoveryKey, setCreatedRecoveryKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
    setCreatedRecoveryKey(null);
    setCaptchaToken('');
  };

  // 1. Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const m = mobile.trim();
    if (!m || m.length < 10) {
      setError('شماره موبایل نامعتبر است. فرمت صحیح: 09123456789');
      return;
    }

    if (!password) {
      setError('لطفاً رمز عبور خود را وارد کنید.');
      return;
    }

    setLoading(true);
    const res = await login(m, password, captchaToken);
    setLoading(false);

    if (res.success) {
      if (onLoginSuccess && res.user && res.user.roles) {
        onLoginSuccess(res.user.roles);
      } else {
        onClose();
      }
    } else {
      setError(res.error || 'شماره موبایل یا رمز عبور اشتباه است.');
    }
  };

  // 2. Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const m = mobile.trim();
    if (!m || m.length < 10) {
      setError('شماره موبایل نامعتبر است. فرمت صحیح: 09123456789');
      return;
    }

    if (!name.trim()) {
      setError('لطفاً نام و نام خانوادگی خود را وارد کنید.');
      return;
    }

    if (password.length < 6) {
      setError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    if (password !== confirmPassword) {
      setError('تکرار رمز عبور با رمز عبور واردشده یکسان نیست.');
      return;
    }

    setLoading(true);
    const res = await register(m, password, name.trim(), recoveryKey.trim() || undefined, captchaToken);
    setLoading(false);

    if (res.success) {
      if (res.recoveryKey) {
        setCreatedRecoveryKey(res.recoveryKey);
        setSuccessMsg('حساب کاربری با موفقیت ایجاد شد.');
      } else {
        onClose();
      }
    } else {
      setError(res.error || 'خطا در ثبت‌نام حساب کاربری.');
    }
  };

  // 3. Handle Password Recovery
  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const m = mobile.trim();
    if (!m || m.length < 10) {
      setError('شماره موبایل نامعتبر است.');
      return;
    }

    if (password.length < 6) {
      setError('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    setLoading(true);
    const res = await recoverPassword(m, recoveryKey.trim(), password);
    setLoading(false);

    if (res.success) {
      setSuccessMsg(res.message || 'رمز عبور با موفقیت بازنشانی شد. اکنون وارد شوید.');
      setTimeout(() => {
        resetForm('login');
      }, 2000);
    } else {
      setError(res.error || 'خطا در بازنشانی رمز عبور.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md">
      <div className="bg-liquid-glass rounded-3xl w-full max-w-md overflow-hidden border border-white/20 dark:border-slate-700/50 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="relative bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-slate-800/80 dark:to-slate-900/80 p-6 border-b border-slate-200/60 dark:border-slate-700/60">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 bg-blue-600 shadow-lg shadow-blue-500/25 rounded-2xl flex items-center justify-center text-white mb-4">
            {mode === 'login' && <LogIn className="w-6 h-6" />}
            {mode === 'register' && <UserPlus className="w-6 h-6" />}
            {mode === 'recover' && <KeyRound className="w-6 h-6" />}
          </div>

          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-1">
            {mode === 'login' && 'ورود به سامانه درس‌چین'}
            {mode === 'register' && 'ثبت‌نام حساب کاربری جدید'}
            {mode === 'recover' && 'بازیابی رمز عبور'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {mode === 'login' && 'شماره موبایل و رمز عبور خود را وارد نمایید.'}
            {mode === 'register' && 'مشخصات خود را برای ثبت‌نام و استفاده از سیستم وارد کنید.'}
            {mode === 'recover' && 'شماره همراه و رمز عبور جدید را جهت بازنشانی وارد کنید.'}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs rounded-2xl border border-rose-200/60 dark:border-rose-900/60 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs rounded-2xl border border-emerald-200/60 dark:border-emerald-900/60 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Registration Success with Recovery Key */}
          {createdRecoveryKey && (
            <div className="p-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl space-y-2">
              <p className="text-xs font-bold text-blue-900 dark:text-blue-300">
                کلید امنیتی بازیابی حساب شما:
              </p>
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl font-mono text-center text-sm font-bold text-blue-700 dark:text-blue-400 select-all border border-blue-200 dark:border-blue-700">
                {createdRecoveryKey}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                این کلید را در جای امن ذخیره کنید تا در صورت فراموشی رمز عبور، بتوانید حسابتان را بازنشانی نمایید.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all"
              >
                ورود به داشبورد
              </button>
            </div>
          )}

          {!createdRecoveryKey && (
            <>
              {/* ---------------- LOGIN FORM ---------------- */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Mobile Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">شماره موبایل</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        dir="ltr"
                        required
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="09123456789"
                        className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pr-10 pl-4 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رمز عبور</label>
                      <button
                        type="button"
                        onClick={() => resetForm('recover')}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        فراموشی رمز؟
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        dir="ltr"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pr-10 pl-10 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <GuestHumanCheck action="login" token={captchaToken} onToken={setCaptchaToken} />
                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !mobile || !password}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900/50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 text-sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    ورود به حساب
                  </button>

                  {/* Switch to Register */}
                  <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800/80">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      حساب کاربری ندارید؟{' '}
                      <button
                        type="button"
                        onClick={() => resetForm('register')}
                        className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        ثبت‌نام کنید
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* ---------------- REGISTER FORM ---------------- */}
              {mode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3.5">
                  {/* Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">نام و نام خانوادگی</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <UserIcon className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="مثال: علی محمدی"
                        className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-slate-900 dark:text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  {/* Mobile Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">شماره موبایل</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        dir="ltr"
                        required
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="09123456789"
                        className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رمز عبور (حداقل ۶ کاراکتر)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        dir="ltr"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-10 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">تکرار رمز عبور</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        dir="ltr"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  {/* Optional Custom Recovery Key */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>کلید امنیتی بازیابی (اختیاری)</span>
                      <span className="text-[10px] text-slate-400">جهت بازیابی رمز</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={recoveryKey}
                        onChange={(e) => setRecoveryKey(e.target.value)}
                        placeholder="کلمه یا عبارت امنیتی دلخواه"
                        className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-slate-900 dark:text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <GuestHumanCheck action="register" token={captchaToken} onToken={setCaptchaToken} />
                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !mobile || !password || !name}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 dark:disabled:bg-emerald-900/50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 text-sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    تکمیل ثبت‌نام و ورود
                  </button>

                  {/* Switch to Login */}
                  <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800/80">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      قبلاً ثبت‌نام کرده‌اید؟{' '}
                      <button
                        type="button"
                        onClick={() => resetForm('login')}
                        className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        وارد شوید
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* ---------------- RECOVERY FORM ---------------- */}
              {mode === 'recover' && (
                <form onSubmit={handleRecover} className="space-y-4">
                  {/* Mobile Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">شماره موبایل حساب</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        dir="ltr"
                        required
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="09123456789"
                        className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pr-10 pl-4 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  {/* Recovery Key Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">کلید بازیابی امنیتی</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={recoveryKey}
                        onChange={(e) => setRecoveryKey(e.target.value)}
                        placeholder="کلید امنیتی صادرشده هنگام ثبت‌نام"
                        className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pr-10 pl-4 text-slate-900 dark:text-white text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                    </div>
                  </div>

                  {/* New Password Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رمز عبور جدید</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        dir="ltr"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="حداقل ۶ کاراکتر"
                        className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pr-10 pl-10 text-slate-900 dark:text-white text-left font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !mobile || !password}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900/50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 mt-2 text-sm"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    بازنشانی رمز عبور
                  </button>

                  {/* Back to Login */}
                  <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => resetForm('login')}
                      className="font-bold text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                    >
                      بازگشت به صفحه ورود
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
