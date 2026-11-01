import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, ShieldCheck, Loader2 } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { GuestHumanCheck } from '../../components/GuestHumanCheck';
import { isValidIranianMobileInput, normalizeIranianMobileInput } from '../../utils/iranian-mobile';

export const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [otpRequired, setOtpRequired] = useState<boolean | null>(null);
  const [otpChallengeId, setOtpChallengeId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verifiedMobile, setVerifiedMobile] = useState('');
  const [otpCaptchaToken, setOtpCaptchaToken] = useState('');
  const [otpCaptchaAttempt, setOtpCaptchaAttempt] = useState(0);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void apiRequest<{ registrationOtpRequired: boolean }>('/api/security/challenge').then(result => {
      if (!active) return;
      if (!result.success || typeof result.data?.registrationOtpRequired !== 'boolean') {
        setError('تنظیمات تأیید شماره از سرور دریافت نشد. اتصال را بررسی و صفحه را تازه‌سازی کنید.');
        return;
      }
      setOtpRequired(result.data.registrationOtpRequired);
    }).catch(() => {
      if (active) setError('دریافت تنظیمات امنیتی ناموفق بود؛ دوباره تلاش کنید.');
    });
    return () => { active = false; };
  }, []);

  const handleMobileChange = (value: string) => {
    const normalized = normalizeIranianMobileInput(value);
    setMobile(normalized);
    if (normalized !== verifiedMobile) {
      setOtpChallengeId('');
      setOtpCode('');
      setOtpCaptchaToken('');
      setOtpCaptchaAttempt(attempt => attempt + 1);
    }
  };

  const requestRegistrationOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidIranianMobileInput(mobile)) return setError('شماره موبایل معتبر وارد کنید.');
    if (!otpCaptchaToken) return setError('کد امنیتی را وارد کنید.');
    setIsLoading(true);
    try {
      const result = await apiRequest<{ challengeId: string }>('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ mobile, purpose: 'registration', captchaToken: otpCaptchaToken }),
      });
      if (!result.success || !result.data?.challengeId) {
        setError(result.error || 'ارسال کد تأیید انجام نشد.');
        return;
      }
      setVerifiedMobile(mobile);
      setOtpChallengeId(result.data.challengeId);
      setOtpCode('');
    } catch {
      setError('ارتباط با سرویس پیامک برقرار نشد. مجدداً تلاش کنید.');
    } finally {
      setOtpCaptchaToken('');
      setOtpCaptchaAttempt(attempt => attempt + 1);
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (otpRequired === null) return setError('دریافت تنظیمات امنیتی هنوز تکمیل نشده است.');
    if (otpRequired && (!otpChallengeId || verifiedMobile !== mobile || !/^\d{6}$/.test(otpCode))) {
      return setError('ابتدا کد پیامکی تأیید شماره موبایل را دریافت و وارد کنید.');
    }
    if (!name.trim()) return setError('نام و نام خانوادگی الزامی است.');
    if (!isValidIranianMobileInput(mobile)) return setError('شماره موبایل نامعتبر است.');
    if (password.length < 6) return setError('رمز عبور باید حداقل ۶ کاراکتر باشد.');

    setIsLoading(true);
    try {
      const res = await register(mobile, password, name, undefined, captchaToken,
        otpRequired ? otpChallengeId : undefined, otpRequired ? otpCode : undefined);

      if (res.success) {
        // Registration returns an authenticated session; do not immediately
        // submit a second password login that would require a second captcha.
        navigate('/dashboard');
      } else {
        setError(res.error || 'خطایی رخ داد.');
      }
    } catch (err: any) {
      setError(err.message || 'ارتباط با سرور برقرار نشد.');
    } finally {
      setIsLoading(false);
      // Provider tokens are one-use; a failed password attempt needs a new challenge.
      setCaptchaToken('');
      setCaptchaAttempt(value => value + 1);
    }
  };

  return (
    <div dir="rtl" className="darschin-page min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-8 px-4 sm:px-6 sm:py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50 text-teal-800 shadow-sm dark:border-teal-900 dark:bg-teal-950/60 dark:text-teal-300">
          <ShieldCheck className="w-12 h-12" />
        </Link>
        <h2 className="mb-2 text-right text-2xl font-black leading-snug text-slate-900 dark:text-white sm:text-3xl">
          ایجاد حساب کاربری
        </h2>
        <p className="text-right text-sm leading-7 text-slate-600 dark:text-slate-400">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <Link to="/login" className="font-bold text-teal-700 hover:text-teal-600">
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

          <motion.form 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={otpRequired && !otpChallengeId ? requestRegistrationOtp : handleRegister} 
            className="space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                نام و نام خانوادگی
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-600 focus:border-teal-600 dark:text-white transition-colors"
                placeholder="علی محمدی"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                شماره موبایل
              </label>
              <input
                type="tel"
                dir="ltr"
                value={mobile}
                onChange={(e) => handleMobileChange(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-600 focus:border-teal-600 dark:text-white transition-colors"
                placeholder="09123456789"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                رمز عبور
              </label>
              <input
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-600 focus:border-teal-600 dark:text-white transition-colors"
                placeholder="••••••••"
              />
            </div>

            {otpRequired && otpChallengeId && (
              <div className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-900 dark:bg-teal-950/30">
                <label htmlFor="registration-otp" className="block text-sm font-bold text-slate-800 dark:text-slate-100">
                  کد شش‌رقمی پیامک‌شده به شماره {verifiedMobile}
                </label>
                <input id="registration-otp" type="text" dir="ltr" inputMode="numeric"
                  autoComplete="one-time-code" maxLength={6} value={otpCode}
                  onChange={event => setOtpCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center tracking-[0.4em] dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                <p className="text-xs leading-6 text-slate-600 dark:text-slate-400">
                  این کد دو دقیقه اعتبار دارد. برای شمارهٔ دیگر یا دریافت مجدد، از مرحلهٔ تأیید شماره شروع کنید.
                </p>
                <button type="button" className="text-sm font-semibold text-teal-800 dark:text-teal-300"
                  onClick={() => { setOtpChallengeId(''); setOtpCode(''); setCaptchaToken(''); }}>
                  دریافت کد جدید
                </button>
              </div>
            )}
            {otpRequired && !otpChallengeId
              ? <GuestHumanCheck key={otpCaptchaAttempt} action="otp" token={otpCaptchaToken} onToken={setOtpCaptchaToken} />
              : <GuestHumanCheck key={captchaAttempt} action="register" token={captchaToken} onToken={setCaptchaToken} />
            }
            <button
              type="submit"
              disabled={isLoading || otpRequired === null}
              className="w-full flex min-h-12 items-center justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-600 transition-colors disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : otpRequired && !otpChallengeId ? 'دریافت کد تأیید شماره' : 'ثبت‌نام'}
            </button>
          </motion.form>
        </div>
      </div>
    </div>
  );
};
