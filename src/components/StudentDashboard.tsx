// ============================================================================
// DARSCHYN (درس‌چین) - Student Dashboard
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  UploadCloud,
  FileJson,
  Layers,
  Sparkles,
  BookOpen,
  Calendar,
  Download,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../utils/api';
import { CourseEligibilityResult, CourseRecommendation, StudentAcademicProfile, AcademicLimitInfo } from '../types';

import { AcademicProfileModal } from './AcademicProfileModal';
import { PassedCoursesManager } from './PassedCoursesManager';
import { SupportPanel } from './SupportPanel';
import { BugReportPanel } from './BugReportPanel';
import { ImportOfferingsModal } from './ImportOfferingsModal';
import { OfferingsList } from './OfferingsList';
import { RecommendationsPanel } from './RecommendationsPanel';
import { SchedulePlanner } from './SchedulePlanner';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [academicLimits, setAcademicLimits] = useState<AcademicLimitInfo | null>(null);
  const [currentTerm, setCurrentTerm] = useState<any>(null);
  const [evaluations, setEvaluations] = useState<CourseEligibilityResult[]>([]);
  const [recommendations, setRecommendations] = useState<CourseRecommendation[]>([]);
  const [selectedOfferingIds, setSelectedOfferingIds] = useState<string[]>([]);
  const [coursePriorities, setCoursePriorities] = useState<string[]>([]);
  const [offeringPriorities, setOfferingPriorities] = useState<Record<string, string[]>>({});

  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<{
    offeringId: string;
    courseName: string;
    messages: string[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'offerings' | 'recommendations' | 'passed' | 'schedule'>('offerings');

  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (evaluations.length === 0) setLoading(true);
    const [profileRes, evalRes, planRes] = await Promise.all([
      apiRequest<{ profile: StudentAcademicProfile }>('/api/student/profile'),
      apiRequest<any>('/api/eligibility/evaluate', {
        method: 'POST',
        body: JSON.stringify({ plannedCourseIds: selectedOfferingIds }),
      }),
      apiRequest<{ selectedOfferingIds?: string[]; coursePriorities?: any; offeringPriorities?: any }>('/api/student/plan'),
    ]);

    if (profileRes.success && profileRes.data) {
      setProfile(profileRes.data.profile);
    }
    if (evalRes.success && evalRes.data) {
      setEvaluations(evalRes.data.report?.results || []);
      setRecommendations(evalRes.data.recommendations || []);
      if (evalRes.data.academicLimits) {
        setAcademicLimits(evalRes.data.academicLimits);
      }
      if (evalRes.data.context && evalRes.data.context.term) {
        setCurrentTerm(evalRes.data.context.term);
      }
    }
    if (planRes.success && planRes.data) {
      if (Array.isArray(planRes.data.selectedOfferingIds) && selectedOfferingIds.length === 0) {
        setSelectedOfferingIds(planRes.data.selectedOfferingIds);
      }
      if (planRes.data.coursePriorities) {
        if (Array.isArray(planRes.data.coursePriorities)) {
          setCoursePriorities(planRes.data.coursePriorities);
        } else if (typeof planRes.data.coursePriorities === 'object') {
          const sorted = Object.keys(planRes.data.coursePriorities).sort(
            (a, b) => planRes.data.coursePriorities[a] - planRes.data.coursePriorities[b]
          );
          setCoursePriorities(sorted);
        }
      }
      if (planRes.data.offeringPriorities && typeof planRes.data.offeringPriorities === 'object') {
        setOfferingPriorities(planRes.data.offeringPriorities);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && user.roles?.includes('student')) {
      fetchDashboardData();
    }
  }, [user]);

  // Sync plan state changes to backend
  const syncPlanToServer = async (
    newSelectedIds: string[],
    newCoursePriorities: string[],
    newOfferingPriorities: Record<string, string[]>
  ) => {
    try {
      await apiRequest('/api/student/plan', {
        method: 'PUT',
        body: JSON.stringify({
          selectedOfferingIds: newSelectedIds,
          coursePriorities: newCoursePriorities,
          offeringPriorities: newOfferingPriorities,
        }),
      });
    } catch (err) {
      console.error('Failed to sync plan to server:', err);
    }
  };

  // Reorder courses
  const handleReorderCourses = (newCourseOrder: string[]) => {
    setCoursePriorities(newCourseOrder);
    syncPlanToServer(selectedOfferingIds, newCourseOrder, offeringPriorities);
  };

  // Select primary offering for a course (promotes offering to primary)
  const handleSelectPrimaryOffering = async (courseId: string, offeringId: string) => {
    const currentCourseOfferings = offeringPriorities[courseId] || [];
    const currentPrimary = selectedOfferingIds.find((id) => {
      const e = evaluations.find((ev) => ev.offeringId === id);
      return (e?.courseId || e?.courseCode) === courseId;
    });

    // Replace old primary with new offering in selectedOfferingIds
    const newSelected = [
      ...selectedOfferingIds.filter((id) => id !== currentPrimary && id !== offeringId),
      offeringId,
    ];

    const updatedOfferingList = [
      offeringId,
      ...currentCourseOfferings.filter((id) => id !== offeringId),
    ];
    const newOfferingPriorities = {
      ...offeringPriorities,
      [courseId]: updatedOfferingList,
    };

    setSelectedOfferingIds(newSelected);
    setOfferingPriorities(newOfferingPriorities);

    await syncPlanToServer(newSelected, coursePriorities, newOfferingPriorities);
  };

  // Add a fallback offering for a course
  const handleAddFallbackOffering = async (courseId: string, offeringId: string) => {
    const currentCourseOfferings = offeringPriorities[courseId] || [];
    if (currentCourseOfferings.includes(offeringId)) return;

    const newOfferingPriorities = {
      ...offeringPriorities,
      [courseId]: [...currentCourseOfferings, offeringId],
    };
    setOfferingPriorities(newOfferingPriorities);

    await syncPlanToServer(selectedOfferingIds, coursePriorities, newOfferingPriorities);
  };

  // Remove a fallback offering from a course
  const handleRemoveFallbackOffering = async (courseId: string, offeringId: string) => {
    const currentCourseOfferings = offeringPriorities[courseId] || [];
    const newOfferingPriorities = {
      ...offeringPriorities,
      [courseId]: currentCourseOfferings.filter((id) => id !== offeringId),
    };
    setOfferingPriorities(newOfferingPriorities);

    await syncPlanToServer(selectedOfferingIds, coursePriorities, newOfferingPriorities);
  };

  // Calculate schedule conflicts
  const selectedItems = evaluations.filter((e) => selectedOfferingIds.includes(e.offeringId));
  const timeConflicts: { offering1: string; offering2: string; day: string }[] = [];
  const prerequisiteConflicts = selectedItems.filter((e) => e.missingPrerequisites && e.missingPrerequisites.length > 0);

  for (let i = 0; i < selectedItems.length; i++) {
    for (let j = i + 1; j < selectedItems.length; j++) {
      const o1 = selectedItems[i];
      const o2 = selectedItems[j];
      
      // Basic time overlap check
      if (
        o1.dayOfWeek && o2.dayOfWeek && o1.dayOfWeek === o2.dayOfWeek &&
        o1.startTime && o1.endTime && o2.startTime && o2.endTime
      ) {
        if (o1.startTime < o2.endTime && o1.endTime > o2.startTime) {
          timeConflicts.push({
            offering1: o1.courseName,
            offering2: o2.courseName,
            day: o1.dayOfWeek,
          });
        }
      }
    }
  }

  const confirmToggleScheduleOffering = async (offeringId: string) => {
    const isAdding = !selectedOfferingIds.includes(offeringId);
    const newSelected = isAdding
      ? [...selectedOfferingIds, offeringId]
      : selectedOfferingIds.filter((id) => id !== offeringId);

    setSelectedOfferingIds(newSelected);
    setConflictWarning(null);

    try {
      await apiRequest('/api/student/plan/select', {
        method: 'POST',
        body: JSON.stringify({
          offeringId,
          action: isAdding ? 'add' : 'remove',
        }),
      });
    
      const evalRes = await apiRequest<any>('/api/eligibility/evaluate', {
        method: 'POST',
        body: JSON.stringify({ plannedCourseIds: newSelected }),
      });
      if (evalRes.success && evalRes.data) {
        setEvaluations(evalRes.data.results || []);
      }
    } catch (err) {
      console.error('Plan sync error:', err);
    }
  };

  const handleToggleScheduleOffering = (offeringId: string) => {
    if (selectedOfferingIds.includes(offeringId)) {
      confirmToggleScheduleOffering(offeringId);
      return;
    }

    const newEval = evaluations.find((e) => e.offeringId === offeringId);
    if (!newEval) return;

    // Strict ineligibility blocking
    if (!newEval.canSelect || !newEval.isEligible || newEval.overallStatus !== 'AVAILABLE') {
      setConflictWarning({
        offeringId,
        courseName: newEval.courseName,
        messages: [
          `خطای عدم صلاحیت آموزشی: ${newEval.primaryReason || 'پیش‌نیازهای این درس رعایت نشده است.'}`,
          ...(newEval.missingPrerequisites && newEval.missingPrerequisites.length > 0
            ? [`پیش‌نیازهای پاس‌نشده: ${newEval.missingPrerequisites.map((p) => p.name).join('، ')}`]
            : []),
          ...(newEval.missingCorequisites && newEval.missingCorequisites.length > 0
            ? [`هم‌نیازهای انتخاب‌نشده: ${newEval.missingCorequisites.map((c) => c.name).join('، ')}`]
            : []),
        ],
      });
      return;
    }

    const currentSelected = evaluations.filter((e) => selectedOfferingIds.includes(e.offeringId));
    const messages: string[] = [];

    currentSelected.forEach((existing) => {
      // Lecture Conflict
      if (
        newEval.dayOfWeek &&
        existing.dayOfWeek &&
        newEval.dayOfWeek === existing.dayOfWeek &&
        newEval.startTime &&
        existing.startTime &&
        newEval.endTime &&
        existing.endTime
      ) {
        if (newEval.startTime < existing.endTime && newEval.endTime > existing.startTime) {
          messages.push(
            `تداخل زمان کلاس با درس "${existing.courseName}" (روز ${newEval.dayOfWeek} ساعت ${existing.startTime} تا ${existing.endTime})`
          );
        }
      }

      // Exam Conflict
      if (newEval.examDate && existing.examDate) {
        const newDate = newEval.examDate.split(' - ')[0].trim();
        const existingDate = existing.examDate.split(' - ')[0].trim();
        if (newDate === existingDate) {
          if (newEval.examDate === existing.examDate) {
            messages.push(`تداخل دقیق زمان امتحان با درس "${existing.courseName}" (${newEval.examDate})`);
          } else {
            messages.push(`تداخل روز امتحان با درس "${existing.courseName}" (هر دو در تاریخ ${newDate})`);
          }
        }
      }
    });

    // Unit Limits Check (respecting final-semester and GPA rules)
    const isSummer = currentTerm?.termNumber === 3 || academicLimits?.isSummer;
    const isFinalSemester = academicLimits?.isFinalSemester ?? false;
    const isGradeA = academicLimits?.isGradeA ?? (profile?.previousTermGpa ? profile.previousTermGpa >= 17 : false);
    const maxUnits = academicLimits?.effectiveMaxUnits ?? (isSummer ? 8 : isFinalSemester || isGradeA ? 24 : 20);

    const isExtra = newEval.courseName.includes('وصایا') || newEval.courseName.includes('انس');

    if (!isExtra) {
      const currentUnits = currentSelected.reduce((sum, item) => {
        if (item.courseName.includes('وصایا') || item.courseName.includes('انس')) return sum;
        return sum + (item.units || 0);
      }, 0);

      if (currentUnits + (newEval.units || 0) > maxUnits) {
        const limitTypeLabel = isFinalSemester
          ? 'ترم آخری (۲۴ واحد)'
          : isGradeA
          ? 'معدل الف (۲۴ واحد)'
          : `عادی (${maxUnits} واحد)`;
        messages.push(`افزودن این درس باعث عبور از سقف مجاز انتخاب واحد ${limitTypeLabel} می‌شود.`);
      }
    }

    if (messages.length > 0) {
      setConflictWarning({ offeringId, courseName: newEval.courseName, messages });
    } else {
      confirmToggleScheduleOffering(offeringId);
    }
  };

  const handleClearSchedule = () => {
    if (confirm('آیا از پاکسازی کل برنامه انتخابی مطمئن هستید؟')) {
      setSelectedOfferingIds([]);
    }
  };

  if (!user || !user.roles?.includes('student')) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        لطفاً ابتدا به عنوان دانشجو وارد سامانه شوید.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-liquid-glass rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between relative">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white mb-1">
              سلام، {user.name} 👋
            </h2>
            <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-md inline-block mb-1 border border-amber-200 dark:border-amber-800">
              توجه: داده‌های چارت تحصیلی در این نسخه آزمایشی (DEMO DATA) بوده و فاقد استناد رسمی می‌باشند.
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              به میز کار دانشجویی سامانه تصمیم‌یار انتخاب واحد درس‌چین خوش آمدید.
            </p>
            {academicLimits && (
              <div className="mt-4 flex flex-wrap gap-4 bg-white/50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500">رشته‌ای اجباری</span>
                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    پاس‌شده: {academicLimits.majorRequiredPassed} | باقیمانده: {academicLimits.majorRequiredRemaining}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500">گرایشی اجباری</span>
                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    پاس‌شده: {academicLimits.trackRequiredPassed} | باقیمانده: {academicLimits.trackRequiredRemaining}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500">اختیاری (کل)</span>
                  <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    پاس‌شده: {academicLimits.electivesPassed}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95"
              title="راهنمای نصب و دانلود افزونه کروم"
            >
              <Download className="w-4 h-4" />
              <span>دانلود افزونه کروم</span>
            </button>
            <button
              onClick={() => setProfileModalOpen(true)}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
            >
              مدیریت پرونده تحصیلی
            </button>
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 transition-all hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <UploadCloud className="w-4 h-4" />
              بارگذاری دروس ارائه‌شده
            </button>
          </div>
        </div>
      </div>

      {/* Global Conflict Warning Banner */}
      {timeConflicts.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-4 print:hidden">
          <div className="p-2 bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400 rounded-xl shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200 mb-1">
              هشدار تداخل زمانی در برنامه انتخابی
            </h3>
            <ul className="text-xs text-rose-700 dark:text-rose-300 space-y-1">
              {timeConflicts.map((conflict, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 dark:bg-rose-600"></span>
                  درس‌های <strong>{conflict.offering1}</strong> و <strong>{conflict.offering2}</strong> در روز <strong>{conflict.day}</strong> دارای تداخل زمانی هستند.
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {prerequisiteConflicts.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="p-2 bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400 rounded-xl shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200 mb-1">
              هشدار مغایرت پیش‌نیازها در برنامه انتخابی
            </h3>
            <ul className="text-xs text-rose-700 dark:text-rose-300 space-y-1">
              {prerequisiteConflicts.map((conflict, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 dark:bg-rose-600"></span>
                  درس <strong>{conflict.courseName}</strong> نیازمند پاس‌شدن: {conflict.missingPrerequisites.map(p => p.name).join('، ')}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <div className="bg-liquid-glass rounded-2xl p-1.5 flex flex-wrap gap-1.5 sticky top-[72px] z-30 print:hidden overflow-x-auto sm:overflow-visible shadow-xs">
        <button
          onClick={() => setActiveTab('offerings')}
          className={`flex-1 min-w-[120px] flex justify-center items-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'offerings'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shadow-xs border border-blue-200 dark:border-blue-800/60'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          بررسی تطبیقی دروس ارائه‌شده
        </button>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`flex-1 min-w-[120px] flex justify-center items-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'recommendations'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shadow-xs border border-blue-200 dark:border-blue-800/60'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          پیشنهاد هوشمند انتخاب واحد
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex-1 min-w-[120px] flex justify-center items-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'schedule'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shadow-xs border border-blue-200 dark:border-blue-800/60'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          برنامه‌ریز و جدول زمانی
        </button>
        <button
          onClick={() => setActiveTab('passed')}
          className={`flex-1 min-w-[120px] flex justify-center items-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'passed'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shadow-xs border border-blue-200 dark:border-blue-800/60'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          مدیریت کارنامه و دروس پاس‌شده
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs font-medium">در حال بارگذاری و تحلیل داده‌ها...</span>
          </div>
        ) : (
          <>
            {activeTab === 'offerings' && (
              <OfferingsList
                evaluations={evaluations}
                selectedOfferingIds={selectedOfferingIds}
                onToggleScheduleOffering={handleToggleScheduleOffering}
                onOpenProfileModal={() => setProfileModalOpen(true)}
              />
            )}
            
            {activeTab === 'recommendations' && (
              <RecommendationsPanel
                recommendations={recommendations}
                evaluations={evaluations}
                selectedOfferingIds={selectedOfferingIds}
                onToggleScheduleOffering={handleToggleScheduleOffering}
              />
            )}

            {activeTab === 'schedule' && (
              <SchedulePlanner
                evaluations={evaluations}
                selectedOfferingIds={selectedOfferingIds}
                coursePriorities={coursePriorities}
                offeringPriorities={offeringPriorities}
                onToggleScheduleOffering={handleToggleScheduleOffering}
                onSelectPrimaryOffering={handleSelectPrimaryOffering}
                onAddFallbackOffering={handleAddFallbackOffering}
                onRemoveFallbackOffering={handleRemoveFallbackOffering}
                onReorderCourses={handleReorderCourses}
                onClearSchedule={handleClearSchedule}
                profile={profile}
                currentTerm={currentTerm}
                academicLimits={academicLimits}
              />
            )}

            {activeTab === 'passed' && (
              <PassedCoursesManager onPassedCoursesChanged={fetchDashboardData} />
            )}
            {activeTab === 'support' && <SupportPanel />}
            {activeTab === 'bugs' && <BugReportPanel />}
          </>
        )}
      </div>

      <AcademicProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onProfileUpdated={fetchDashboardData}
      />

            <ImportOfferingsModal
        isOpen={isImportModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportSuccess={fetchDashboardData}
      />

      {/* Conflict Warning Modal */}
      {conflictWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-liquid-glass rounded-3xl p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <h3 className="text-xl font-bold">هشدار تداخل برنامه</h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 leading-relaxed">
              افزودن درس <strong>{conflictWarning.courseName}</strong> باعث تداخل‌های زیر خواهد شد:
            </p>
            
            <ul className="space-y-2 mb-6">
              {conflictWarning.messages.map((msg, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span className="leading-relaxed">{msg}</span>
                </li>
              ))}
            </ul>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConflictWarning(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-colors"
              >
                انصراف
              </button>
              <button
                onClick={() => confirmToggleScheduleOffering(conflictWarning.offeringId)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-500/30 transition-colors"
              >
                با علم به تداخل، اضافه کن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
