import React from 'react';
import { Calendar as CalendarIcon, AlertTriangle, Clock } from 'lucide-react';
import { CourseEligibilityResult } from '../types';

interface ExamCalendarProps {
  selectedItems: CourseEligibilityResult[];
}

export const ExamCalendar: React.FC<ExamCalendarProps> = ({ selectedItems }) => {
  // Group by date
  const examGroups: Record<string, CourseEligibilityResult[]> = {};
  const noExam: CourseEligibilityResult[] = [];

  selectedItems.forEach(item => {
    if (!item.examDate || item.examDate.trim() === '' || item.examDate.includes('نامشخص')) {
      noExam.push(item);
      return;
    }
    const parts = item.examDate.split(' - ');
    const datePart = parts[0].trim();
    if (!examGroups[datePart]) {
      examGroups[datePart] = [];
    }
    examGroups[datePart].push(item);
  });

  const sortedDates = Object.keys(examGroups).sort(); // Lexicographical sort works for YYYY/MM/DD

  if (selectedItems.length === 0) return null;

  return (
    <div className="bg-liquid-glass rounded-3xl p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
         <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              تقویم و تجمعات امتحانات پایان‌ترم
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              شناسایی روزهای پرفشار و تداخل‌های احتمالی امتحان
            </span>
          </div>
      </div>

      {sortedDates.length === 0 && noExam.length === 0 ? (
        <div className="text-xs text-slate-500 py-4 text-center">هیچ درسی انتخاب نشده است.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {sortedDates.map((date, idx) => {
            const items = examGroups[date];
            // Sort items in a day by time if possible
            items.sort((a, b) => {
               const ta = a.examDate!.split(' - ')[1] || '';
               const tb = b.examDate!.split(' - ')[1] || '';
               return ta.localeCompare(tb);
            });

            const isCluster = items.length > 1;
            
            return (
              <div key={idx} className={`relative p-4 rounded-2xl border transition-all ${isCluster ? 'border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'}`}>
                {isCluster && (
                  <div className="absolute top-0 right-4 -translate-y-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <AlertTriangle className="w-3 h-3" />
                    فشرده ({items.length} امتحان)
                  </div>
                )}
                <div className="text-[13px] font-black text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-200/80 dark:border-slate-700/80 pb-2">
                  {date}
                </div>
                <div className="space-y-3">
                  {items.map(item => {
                     const timePart = item.examDate!.split(' - ')[1]?.trim() || 'نامشخص';
                     return (
                       <div key={item.offeringId} className="flex flex-col gap-1.5 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-xs">
                         <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{item.courseName}</span>
                         <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                           <Clock className="w-3.5 h-3.5" />
                           ساعت {timePart}
                         </span>
                       </div>
                     );
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      {noExam.length > 0 && (
        <div className="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800/60">
           <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2 block">دروس بدون تاریخ امتحان مشخص:</span>
           <div className="flex flex-wrap gap-2">
             {noExam.map(n => (
               <span key={n.offeringId} className="bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 text-[10px] font-semibold px-2 py-1 rounded-lg shadow-xs">
                 {n.courseName}
               </span>
             ))}
           </div>
        </div>
      )}
    </div>
  );
}
