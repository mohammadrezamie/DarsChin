import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { GuestHumanCheck } from '../../components/GuestHumanCheck';

export const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mobile, setMobile] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const loadCaptcha = async () => {
    try {
      const res = await apiRequest('/api/auth/otp/captcha/generate');
      if (res.success && res.data) {
        setCaptchaId(res.data.id);
        setCaptchaSvg(res.data.svg);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let mounted=true;
    void apiRequest<{enabled:boolean}>('/api/security/challenge').then(result=>{
      if(!mounted)return;
      if(result.success && result.data?.enabled) setTurnstileEnabled(true);
      else void loadCaptcha();
    });
    return ()=>{mounted=false;};
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!/^09\d{9}$/.test(mobile)) return setError('شماره موبایل نامعتبر است.');
    if (!turnstileEnabled && !captchaValue) return setError('لطفاً کد امنیتی را وارد کنید.');

    setIsLoading(true);
    try {
      const res = await apiRequest('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ mobile, purpose: 'password_recovery', captchaId, captchaValue, captchaToken }),
      });

      if (res.success) {
        setChallengeId(res.data.challengeId);
        setStep(2);
      } else {
        setError(res.error || 'خطایی رخ داد.');
        if (!turnstileEnabled) loadCaptcha();
        setCaptchaToken('');
        setCaptchaValue('');
      }
    } catch (err: any) {
      setError(err.message || 'خطا در ارتباط با سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpCode.length !== 6) return setError('کد تایید باید ۶ رقم باشد.');

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
    } catch (err: any) {
      setError(err.message || 'خطا در ارتباط با سرور.');
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
    } catch (err: any) {
      setError(err.message || 'خطا در ارتباط با سرور.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir="rtl" className="darschin-page min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-8 px-4 sm:px-6 sm:py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
          <ShieldCheck className="w-12 h-12" />
        </Link>
        <h2 className="mb-2 text-right text-2xl font-black leading-snug text-slate-900 dark:text-white sm:text-3xl">
          بازیابی رمز عبور
        </h2>
        <p className="text-right text-sm leading-7 text-slate-600 dark:text-slate-400">
          به خاطر آوردید؟{' '}
          <Link to="/login" className="font-bold text-blue-600 hover:text-blue-500">
            وارد شوید
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
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
                <input type="tel" dir="ltr" value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white" placeholder="09123456789" />
              </div>
              
              {captchaSvg && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">کد امنیتی</label>
                  <div className="flex gap-4 items-center">
                    <div className="bg-white rounded-xl border border-slate-200 p-2 h-[60px]" dangerouslySetInnerHTML={{ __html: captchaSvg }} />
                    <button type="button" onClick={loadCaptcha} className="text-sm text-blue-600 font-medium whitespace-nowrap">تغییر کد</button>
                  </div>
                  <input type="text" dir="ltr" value={captchaValue} onChange={(e) => setCaptchaValue(e.target.value)} className="mt-3 w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white" placeholder="کد بالا را وارد کنید" />
                </div>
              )}

              <button type="submit" disabled={isLoading} className="w-full py-3 px-4 rounded-xl text-white bg-blue-600 hover:bg-blue-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'دریافت کد تایید'}
              </button>
            </motion.form>
          )}

          {step === 2 && (
            <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">کد پیامک شده به {mobile}</label>
                <input type="text" dir="ltr" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} className="w-full px-4 py-3 text-center tracking-widest text-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white" placeholder="------" maxLength={6} autoFocus />
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-3 px-4 rounded-xl text-white bg-blue-600 hover:bg-blue-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'تایید کد'}
              </button>
            </motion.form>
          )}

          {step === 3 && (
            <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">رمز عبور جدید</label>
                <input type="password" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white" placeholder="••••••••" autoFocus />
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-3 px-4 rounded-xl text-white bg-blue-600 hover:bg-blue-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'بروزرسانی رمز عبور'}
              </button>
            </motion.form>
          )}

        </div>
      </div>
    </div>
  );
};
