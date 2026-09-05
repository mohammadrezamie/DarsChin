// ============================================================================
// DARSCHYN (درس‌چین) - Smart Course Recommendation Engine Panel
// ============================================================================

import React from 'react';
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Plus,
  Minus,
  TrendingUp,
  Clock,
  User,
} from 'lucide-react';
import { CourseRecommendation, CourseEligibilityResult } from '../types';

interface RecommendationsPanelProps {
  recommendations: CourseRecommendation[];
  evaluations: CourseEligibilityResult[];
  selectedOfferingIds: string[];
  onToggleScheduleOffering: (offeringId: string) => void;
}

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  recommendations,
  evaluations,
  selectedOfferingIds,
  onToggleScheduleOffering,
}) => {
  const getPriorityBadge = (priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            اولویت حیاتی (مسیر بحرانی)
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            اولویت بالا
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            اولویت متوسط
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            اولویت عادی
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Explanatory Box */}
      <div className="p-5 bg-liquid-glass rounded-3xl shadow-xs border border-blue-200/60 dark:border-blue-800/40">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              پیشنهادات هوشمند انتخاب واحد بر اساس چارت مصوب
            </h3>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              رتبه‌بندی تحلیلی بر پایه زنجیره پیش‌نیازها، دروس کلیدی بازکننده ترم‌های آینده و وضعیت تحصیلی دانشجو
            </span>
          </div>
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="p-12 text-center bg-liquid-glass rounded-3xl">
          <p className="text-xs text-slate-500">
            در حال حاضر هیچ پیشنهاد اولویت‌داری برای دروس ارائه‌شده قابل استخراج نیست یا تمام دروس گذرانده شده‌اند.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {recommendations.map((rec) => {
            const evalResult = evaluations.find(e => e.offeringId === rec.offeringId);
            const isSelected = rec.offeringId ? selectedOfferingIds.includes(rec.offeringId) : false;

            return (
              <div
                key={rec.offeringId || rec.courseId}
                className={`p-5 bg-liquid-glass rounded-3xl transition-all shadow-xs border ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-white/40 dark:border-slate-800/60 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {getPriorityBadge(rec.priority)}
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        {rec.courseName}
                      </h4>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        کد: {rec.courseCode}
                      </span>
                      {evalResult && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium">
                          گروه {evalResult.groupCode}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {rec.units} واحد ({rec.category})
                      </span>
                    </div>

                    {/* Reasons list */}
                    <div className="space-y-1 mb-3">
                      {rec.reasons.map((r, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>

                    {/* Instructor and schedule info */}
                    {evalResult && (
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>استاد: {evalResult.instructor || 'نامشخص'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {evalResult.dayOfWeek} ({evalResult.startTime} تا {evalResult.endTime})
                          </span>
                        </div>
                        {evalResult.capacity !== undefined && (
                          <div className="text-[11px] text-slate-500">
                            ظرفیت کل: {evalResult.capacity} نفر (ثبت‌نام: {evalResult.enrolledCount})
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions & Score */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0">
                    <div className="text-left">
                      <span className="text-[11px] text-slate-500 block">امتیاز اولویت چارت</span>
                      <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                        {rec.score} <span className="text-xs font-normal">امتیاز</span>
                      </span>
                    </div>

                    {rec.offeringId && (
                      <button
                        onClick={() => onToggleScheduleOffering(rec.offeringId!)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                          isSelected
                            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Minus className="w-3.5 h-3.5" />
                            حذف از برنامه
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            افزودن به برنامه
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
