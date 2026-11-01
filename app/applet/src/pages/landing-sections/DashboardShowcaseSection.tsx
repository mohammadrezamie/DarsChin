import React from 'react';
import { motion } from 'motion/react';
import { LayoutDashboard, Users, Activity, Settings } from 'lucide-react';

export const DashboardShowcaseSection: React.FC = () => {
  return (
    <section className="py-32 px-4 sm:px-6 lg:px-8 bg-slate-100 dark:bg-slate-900 overflow-hidden relative">
      <div className="text-center max-w-3xl mx-auto mb-16 relative z-10">
        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
          پنل‌های مدیریت حرفه‌ای
        </h2>
        <p className="text-xl text-slate-600 dark:text-slate-400">
          درس‌چین برای دانشجویان و مدیران آموزش، پنل‌های اختصاصی و قدرتمندی فراهم کرده است تا همه‌چیز در یک نگاه قابل کنترل باشد.
        </p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
        
        {/* Student Dashboard Mock */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <LayoutDashboard className="w-6 h-6 text-blue-500" />
            <h3 className="font-bold text-lg">داشبورد دانشجو</h3>
          </div>
          
          <div className="flex gap-4 mb-6">
            <div className="h-8 w-24 bg-blue-100 dark:bg-blue-900/30 rounded-lg"></div>
            <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg"></div>
            <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg"></div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4 flex-1">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
               <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
               <div className="h-16 w-full bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
               <div className="h-16 w-full bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
               <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
               <div className="space-y-2">
                 <div className="h-8 w-full bg-slate-200 dark:bg-slate-700 rounded"></div>
                 <div className="h-8 w-full bg-slate-200 dark:bg-slate-700 rounded"></div>
                 <div className="h-8 w-full bg-slate-200 dark:bg-slate-700 rounded"></div>
               </div>
            </div>
          </div>
        </motion.div>

        {/* Admin Dashboard Mock */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900 text-white rounded-3xl p-6 shadow-2xl shadow-slate-900/50 flex flex-col"
        >
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <Settings className="w-6 h-6 text-emerald-400" />
            <h3 className="font-bold text-lg">داشبورد مدیر آموزش</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
               <Users className="w-5 h-5 text-blue-400 mb-2" />
               <div className="text-2xl font-bold">۱,۸۴۲</div>
               <div className="text-xs text-slate-400">دانشجو</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
               <BookOpen className="w-5 h-5 text-emerald-400 mb-2" />
               <div className="text-2xl font-bold">۳۴۰</div>
               <div className="text-xs text-slate-400">درس فعال</div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
               <Activity className="w-5 h-5 text-purple-400 mb-2" />
               <div className="text-2xl font-bold">۲۴</div>
               <div className="text-xs text-slate-400">جابجایی موفق</div>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex-1">
            <div className="h-4 w-1/3 bg-slate-700 rounded mb-4"></div>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 hover:bg-slate-700 rounded">
                 <div className="h-4 w-24 bg-slate-600 rounded"></div>
                 <div className="h-4 w-16 bg-emerald-500/50 rounded"></div>
              </div>
              <div className="flex justify-between items-center p-2 hover:bg-slate-700 rounded">
                 <div className="h-4 w-32 bg-slate-600 rounded"></div>
                 <div className="h-4 w-16 bg-emerald-500/50 rounded"></div>
              </div>
            </div>
          </div>
        </motion.div>
        
      </div>
    </section>
  );
};
