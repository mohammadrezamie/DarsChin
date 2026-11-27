import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { GuestHumanCheck } from '../../components/GuestHumanCheck';
import { normalizeIranianMobileInput, isValidIranianMobileInput } from '../../utils/iranian-mobile';

export const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mobile, setMobile] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [otpCode, setOtpCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!isValidIranianMobileInput(mobile)) return setError('شماره موبایل نامعتبر است.');
    if (!captchaToken) return setError('لطفاً کد امنیتی را وارد کنید.');

    setIsLoading(true);
    try {
      const res = await apiRequest('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ mobile, purpose: 'password_recovery', captchaToken }),
      });

      if (res.success && typeof res.data?.challengeId === 'string' && res.data.challengeId) {
        setChallengeId(res.data.challengeId);
        setStep(2);
      } else {
        setError(res.error || 'خطایی رخ داد.');
      }
    } catch {
      setError('خطا در ارتباط با سرور.');
    } finally {
      setCaptchaToken('');
      setCaptchaAttempt(n => n + 1);
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(otpCode)) return setError('کد تایید باید ۶ رقم باشد.');

    setIsLoading(true);
    try {
      const res = await apiRequest('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ mobile, challengeId, code: otpCode, purpose: 'password_recovery' }),
      });

      if (res.success) {
        setStep(3);
      } else {
        setError(res.error || 'کد تایید اشتباه است.');
      }
    } catch {
      setError('خطا در ارتباط با سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) return setError('رمز عبور باید حداقل ۶ کاراکتر باشد.');

    setIsLoading(true);
    try {
      const res = await apiRequest('/api/auth/recover-password', {
        method: 'POST',
        body: JSON.stringify({ mobile, newPassword, otpChallengeId: challengeId }),
      });

      if (res.success) {
        navigate('/login');
      } else {
        setError(res.error || 'خطایی رخ داد.');
      }
    } catch {
      setError('خطا در ارتباط با سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir="rtl" className="dc-product-auth darschin-page min-h-screen flex flex-col justify-center py-8 px-4 sm:px-6 sm:py-12 lg:px-8">
      <div className="dc-auth-layout">
      <div className="dc-auth-intro">
        <Link to="/" className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50 text-teal-800 shadow-sm dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-300">
          <ShieldCheck className="w-12 h-12" />
        </Link>
        <h2 className="mb-2 text-right text-2xl font-black leading-snug text-slate-900 dark:text-white sm:text-3xl">
          بازیابی رمز عبور
        </h2>
        <p className="text-right text-sm leading-7 text-slate-600 dark:text-slate-400">
          به خاطر آوردید؟{' '}
          <Link to="/login" className="font-bold text-teal-700 hover:text-teal-600">
            وارد شوید
          </Link>
        </p>
      </div>

      <div className="dc-auth-card">
        <div className="darschin-surface bg-white px-4 py-6 shadow-sm sm:px-8 sm:py-8 dark:bg-slate-900">
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          {step === 1 && (
            <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSendOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">شماره موبایل</label>
                <input type="tel" dir="ltr" value={mobile} autoComplete="tel" inputMode="tel" disabled={isLoading} onChange={(e) => setMobile(normalizeIranianMobileInput(e.target.value))} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-600 dark:text-white" placeholder="09123456789" />
              </div>
              
              <GuestHumanCheck key={captchaAttempt} action="otp" token={captchaToken} onToken={setCaptchaToken} />

              <button type="submit" disabled={isLoading || !captchaToken} className="w-full py-3 px-4 rounded-xl text-white bg-teal-700 hover:bg-teal-800 font-bold focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-70">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'دریافت کد تایید'}
              </button>
            </motion.form>
          )}

          {step === 2 && (
            <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">کد پیامک شده به {mobile}</label>
                <input type="text" dir="ltr" value={otpCode} inputMode="numeric" autoComplete="one-time-code" onChange={(e) => setOtpCode(e.target.value.replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x06F0)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x0660)).replace(/[^0-9]/g,'').slice(0,6))} className="w-full px-4 py-3 text-center tracking-widest text-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-600 dark:text-white" placeholder="------" maxLength={6} autoFocus />
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-3 px-4 rounded-xl text-white bg-teal-700 hover:bg-teal-800 font-bold focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-70">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'تایید کد'}
              </button>
            </motion.form>
          )}

          {step === 3 && (
            <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">رمز عبور جدید</label>
                <input type="password" autoComplete="new-password" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-600 dark:text-white" placeholder="••••••••" autoFocus />
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-3 px-4 rounded-xl text-white bg-teal-700 hover:bg-teal-800 font-bold focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-70">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'بروزرسانی رمز عبور'}
              </button>
            </motion.form>
          )}

        </div>
      </div>
      </div>
    </div>
  );
};
