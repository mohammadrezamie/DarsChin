import React from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Link } from 'react-router-dom';
import { HeroSection } from './landing-sections/HeroSection';
import { EligibilitySection } from './landing-sections/EligibilitySection';
import { RecommendationSection } from './landing-sections/RecommendationSection';
import { ScheduleSection } from './landing-sections/ScheduleSection';
import { SyncSection } from './landing-sections/SyncSection';
import { DashboardShowcaseSection } from './landing-sections/DashboardShowcaseSection';
import { ArrowLeft } from 'lucide-react';

const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-[Vazirmatn]">
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="font-black text-2xl text-blue-600 dark:text-blue-400">
            DARSCHYN
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
          >
            ورود به سامانه
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main Sections */}
      <main>
        <HeroSection />
        <EligibilitySection />
        <RecommendationSection />
        <ScheduleSection />
        <SyncSection />
        <DashboardShowcaseSection />
        
        {/* CTA Section */}
        <section className="py-32 px-4 sm:px-6 lg:px-8 bg-blue-600 text-white text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight">
              آماده‌اید انتخاب واحد را متفاوت تجربه کنید؟
            </h2>
            <p className="text-xl text-blue-100 mb-12">
              درس‌چین به شما کمک می‌کند برنامه‌ای بدون نقص، بدون تداخل و متناسب با شرایط خودتان ببندید.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-white text-blue-600 px-8 py-4 rounded-2xl font-black text-lg hover:scale-105 transition-transform"
            >
              همین الان شروع کنید
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 text-center text-sm border-t border-slate-800">
        <p>© ۲۰۲۶ پلتفرم درس‌چین. توسعه داده شده برای تسهیل انتخاب واحد.</p>
      </footer>
    </div>
  );
};

export { Landing };
