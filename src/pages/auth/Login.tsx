import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../utils/api';

export const Login: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^09\d{9}$/.test(mobile)) {
      setError('شماره موبایل نامعتبر است. (مثال: 09123456789)');
      return;
    }
    setStep(2);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
      setError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(mobile, password);
      if (result.success) {
        // Route by the authenticated user's role; never treat a result object as a boolean.
        const isAdmin = result.user?.roles?.includes('super-admin') ||
          result.user?.roles?.includes('admin') ||
          result.user?.permissions?.includes('admin.panel.access');
        navigate(isAdmin ? '/admin' : '/dashboard', { replace: true });
      } else {
        setError(result.error || 'شماره موبایل یا رمز عبور اشتباه است.');
      }
    } catch (err: any) {
      setError(err.message || 'خطایی رخ داد.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir="rtl" className="darschin-page min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-8 px-4 sm:px-6 sm:py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center mb-6 text-blue-600 dark:text-blue-400">
          <ShieldCheck className="w-12 h-12" />
        </Link>
        <h2 className="text-center text-3xl font-black text-slate-900 dark:text-white mb-2">
          ورود به حساب کاربری
        </h2>
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          حساب کاربری ندارید؟{' '}
          <Link to="/register" className="font-bold text-blue-600 hover:text-blue-500">
            ثبت‌نام کنید
          </Link>
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-900 dark:bg-blue-950/40">
          <h3 className="text-base font-black text-blue-900 dark:text-blue-100">فقط می‌خواهی سایت را امتحان کنی؟</h3>
          <p className="mt-1 text-xs leading-6 text-blue-800 dark:text-blue-200">بدون شماره موبایل یا رمز وارد محیط آزمایشی شو. این حساب واقعی نیست و به سرور اطلاعات ارسال نمی‌کند.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link to="/demo/student" className="flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-2 text-center text-sm font-bold text-white">ورود دمو دانشجو</Link>
            <Link to="/demo/admin" className="flex min-h-12 items-center justify-center rounded-xl border border-blue-300 bg-white px-2 text-center text-sm font-bold text-blue-900 dark:bg-slate-900 dark:text-blue-100">ورود دمو مدیر</Link>
          </div>
        </div>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-slate-200 dark:border-slate-800">
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          {step === 1 ? (
            <motion.form 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleNext} 
              className="space-y-6"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  شماره موبایل
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    dir="ltr"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-colors"
                    placeholder="09123456789"
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                ادامه
              </button>
            </motion.form>
          ) : (
            <motion.form 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleLogin} 
              className="space-y-6"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    رمز عبور
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setStep(1)}
                    className="text-xs text-blue-600 hover:text-blue-500 font-medium"
                  >
                    تغییر شماره
                  </button>
                </div>
                <input
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-colors"
                  placeholder="••••••••"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between">
                <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  رمز عبور را فراموش کرده‌اید؟
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-70"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ورود'}
              </button>
            </motion.form>
          )}

        </div>
      </div>
    </div>
  );
};
