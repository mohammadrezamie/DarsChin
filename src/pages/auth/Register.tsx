import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, ShieldCheck, Loader2 } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) return setError('نام و نام خانوادگی الزامی است.');
    if (!/^09\d{9}$/.test(mobile)) return setError('شماره موبایل نامعتبر است.');
    if (password.length < 6) return setError('رمز عبور باید حداقل ۶ کاراکتر باشد.');

    setIsLoading(true);
    try {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, mobile, password }),
      });

      if (res.success) {
        // Automatically log in
        await login(mobile, password);
        navigate('/dashboard');
      } else {
        setError(res.error || 'خطایی رخ داد.');
      }
    } catch (err: any) {
      setError(err.message || 'ارتباط با سرور برقرار نشد.');
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
          ایجاد حساب کاربری
        </h2>
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          قبلاً ثبت‌نام کرده‌اید؟{' '}
          <Link to="/login" className="font-bold text-blue-600 hover:text-blue-500">
            وارد شوید
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-slate-200 dark:border-slate-800">
          
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
              {error}
            </div>
          )}

          <motion.form 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleRegister} 
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
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-colors"
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
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-colors"
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
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ثبت‌نام'}
            </button>
          </motion.form>
        </div>
      </div>
    </div>
  );
};
