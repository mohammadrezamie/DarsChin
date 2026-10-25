import { Check } from 'lucide-react';
// ============================================================================
// DARSCHYN (درس‌چین) - Course Planning, Priority Engine & Conflict Timetable
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Clock,
  User,
  BookOpen,
  Download,
  Printer,
  Copy,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Plus,
  ArrowRightLeft,
  ShieldCheck,
  Info,
  CalendarCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { CourseEligibilityResult, AcademicLimitInfo } from '../types';
import { ExamCalendar } from './ExamCalendar';
import { FluidWeekTimetable } from './FluidWeekTimetable';
import { generateExamsICS, downloadICSFile } from '../utils/calendar';

export interface PlannedCourseCardData {
  courseId: string;
  courseName: string;
  courseCode: string;
  units: number;
  category?: string;
  selectedOffering: CourseEligibilityResult;
  fallbackOfferings: CourseEligibilityResult[];
  availableOfferings: CourseEligibilityResult[];
  missingPrerequisites?: { code: string; name: string }[];
  missingCorequisites?: { code: string; name: string }[];
  hasLectureConflict: boolean;
  hasExamConflict: boolean;
  conflictDetails: string[];
}

interface SchedulePlannerProps {
  profile?: any;
  currentTerm?: any;
  academicLimits?: AcademicLimitInfo | null;
  evaluations: CourseEligibilityResult[];
  selectedOfferingIds: string[];
  coursePriorities?: string[];
  offeringPriorities?: Record<string, string[]>;
  onToggleScheduleOffering: (offeringId: string) => void;
  onSelectPrimaryOffering?: (courseId: string, offeringId: string) => void;
  onAddFallbackOffering?: (courseId: string, offeringId: string) => void;
  onRemoveFallbackOffering?: (courseId: string, offeringId: string) => void;
  onReorderCourses?: (newCourseOrder: string[]) => void;
  onClearSchedule: () => void;
}

export const SchedulePlanner: React.FC<SchedulePlannerProps> = ({
  evaluations,
  selectedOfferingIds,
  coursePriorities = [],
  offeringPriorities = {},
  onToggleScheduleOffering,
  onSelectPrimaryOffering,
  onAddFallbackOffering,
  onRemoveFallbackOffering,
  onReorderCourses,
  onClearSchedule,
  profile,
  currentTerm,
  academicLimits,
}) => {
  const [activePlannerTab, setActivePlannerTab] = useState<'priorities' | 'timetable' | 'exams'>('priorities');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };
  
  const [addingFallbackForCourseId, setAddingFallbackForCourseId] = useState<string | null>(null);

  // Group all evaluations by Course
  const courseGroups = useMemo(() => {
    const map = new Map<string, CourseEligibilityResult[]>();
    evaluations.forEach((item) => {
      const cId = item.courseId || item.courseCode || item.courseName;
      if (!map.has(cId)) {
        map.set(cId, []);
      }
      map.get(cId)!.push(item);
    });
    return map;
  }, [evaluations]);

  // Determine active selected offerings
  const selectedOfferings = useMemo(() => {
    return evaluations.filter((e) => selectedOfferingIds.includes(e.offeringId));
  }, [evaluations, selectedOfferingIds]);

  // Detect lecture & exam collisions among ACTIVE selected offerings
  const { lectureConflicts, examConflicts, conflictMap } = useMemo(() => {
    const lConflicts: { offering1: string; offering2: string; day: string; time: string }[] = [];
    const eConflicts: { offering1: string; offering2: string; date: string; type: 'exact' | 'sameday' }[] = [];
    const cMap = new Map<string, string[]>();

    for (let i = 0; i < selectedOfferings.length; i++) {
      for (let j = i + 1; j < selectedOfferings.length; j++) {
        const o1 = selectedOfferings[i];
        const o2 = selectedOfferings[j];

        // Lecture time overlap check
        if (
          o1.dayOfWeek &&
          o2.dayOfWeek &&
          o1.dayOfWeek === o2.dayOfWeek &&
          o1.startTime &&
          o1.endTime &&
          o2.startTime &&
          o2.endTime
        ) {
          if (o1.startTime < o2.endTime && o1.endTime > o2.startTime) {
            const desc = `تداخل ساعت کلاسی با درس «${o2.courseName}» (${o1.dayOfWeek} ساعت ${o1.startTime} تا ${o1.endTime})`;
            lConflicts.push({
              offering1: o1.courseName,
              offering2: o2.courseName,
              day: o1.dayOfWeek,
              time: `${o1.startTime}-${o1.endTime}`,
            });

            if (!cMap.has(o1.offeringId)) cMap.set(o1.offeringId, []);
            if (!cMap.has(o2.offeringId)) cMap.set(o2.offeringId, []);
            cMap.get(o1.offeringId)!.push(desc);
            cMap.get(o2.offeringId)!.push(`تداخل ساعت کلاسی با درس «${o1.courseName}» (${o1.dayOfWeek} ساعت ${o2.startTime} تا ${o2.endTime})`);
          }
        }

        // Exam conflict check
        if (o1.examDate && o2.examDate) {
          const date1 = o1.examDate.split(' - ')[0].trim();
          const date2 = o2.examDate.split(' - ')[0].trim();
          if (date1 === date2) {
            const isExact = o1.examDate === o2.examDate;
            const desc = isExact
              ? `تداخل دقیق زمان امتحان با درس «${o2.courseName}» (${o1.examDate})`
              : `همزمانی روز امتحان با درس «${o2.courseName}» (هر دو در تاریخ ${date1})`;

            eConflicts.push({
              offering1: o1.courseName,
              offering2: o2.courseName,
              date: date1,
              type: isExact ? 'exact' : 'sameday',
            });

            if (!cMap.has(o1.offeringId)) cMap.set(o1.offeringId, []);
            if (!cMap.has(o2.offeringId)) cMap.set(o2.offeringId, []);
            cMap.get(o1.offeringId)!.push(desc);
            cMap.get(o2.offeringId)!.push(
              isExact
                ? `تداخل دقیق زمان امتحان با درس «${o1.courseName}» (${o2.examDate})`
                : `همزمانی روز امتحان با درس «${o1.courseName}» (هر دو در تاریخ ${date2})`
            );
          }
        }
      }
    }

    return { lectureConflicts: lConflicts, examConflicts: eConflicts, conflictMap: cMap };
  }, [selectedOfferings]);

  // Construct structured planned course cards
  const plannedCourses: PlannedCourseCardData[] = useMemo(() => {
    // Collect all courses that have either a selected offering OR fallbacks in offeringPriorities
    const plannedCourseIdSet = new Set<string>();

    selectedOfferings.forEach((o) => {
      const cId = o.courseId || o.courseCode || o.courseName;
      plannedCourseIdSet.add(cId);
    });

    Object.keys(offeringPriorities).forEach((cId) => {
      if (offeringPriorities[cId]?.length > 0) {
        plannedCourseIdSet.add(cId);
      }
    });

    // Sort courses by coursePriorities if provided
    const sortedCourseIds = Array.from(plannedCourseIdSet).sort((a, b) => {
      const indexA = coursePriorities.indexOf(a);
      const indexB = coursePriorities.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });

    return sortedCourseIds.map((cId) => {
      const allCourseOfferings = courseGroups.get(cId) || [];
      const priorityOfferingIds = offeringPriorities[cId] || [];

      // 1. Primary offering: selected from selectedOfferingIds OR first in priorityOfferingIds OR first available
      let primary = allCourseOfferings.find((o) => selectedOfferingIds.includes(o.offeringId));
      if (!primary && priorityOfferingIds.length > 0) {
        primary = allCourseOfferings.find((o) => o.offeringId === priorityOfferingIds[0]);
      }
      if (!primary && allCourseOfferings.length > 0) {
        primary = allCourseOfferings[0];
      }

      // 2. Fallback offerings: items in priorityOfferingIds or designated fallbacks excluding primary
      const fallbacks: CourseEligibilityResult[] = [];
      priorityOfferingIds.forEach((offId) => {
        if (primary && offId !== primary.offeringId) {
          const fb = allCourseOfferings.find((o) => o.offeringId === offId);
          if (fb && !fallbacks.some((f) => f.offeringId === fb.offeringId)) {
            fallbacks.push(fb);
          }
        }
      });

      // 3. Available offerings that are not chosen as primary or fallback
      const available = allCourseOfferings.filter(
        (o) =>
          o.offeringId !== primary?.offeringId &&
          !fallbacks.some((f) => f.offeringId === o.offeringId)
      );

      const conflicts = primary ? conflictMap.get(primary.offeringId) || [] : [];
      const hasLConflict = conflicts.some((c) => c.includes('کلاسی'));
      const hasEConflict = conflicts.some((c) => c.includes('امتحان'));

      return {
        courseId: cId,
        courseName: primary?.courseName || allCourseOfferings[0]?.courseName || 'درس نامشخص',
        courseCode: primary?.courseCode || allCourseOfferings[0]?.courseCode || '---',
        units: primary?.units || allCourseOfferings[0]?.units || 3,
        category: primary?.category || allCourseOfferings[0]?.category,
        selectedOffering: primary!,
        fallbackOfferings: fallbacks,
        availableOfferings: available,
        missingPrerequisites: primary?.missingPrerequisites,
        missingCorequisites: primary?.missingCorequisites,
        hasLectureConflict: hasLConflict,
        hasExamConflict: hasEConflict,
        conflictDetails: conflicts,
      };
    }).filter((pc) => pc.selectedOffering !== undefined);
  }, [
    selectedOfferings,
    offeringPriorities,
    coursePriorities,
    courseGroups,
    conflictMap,
    selectedOfferingIds,
  ]);

  // Unit calculations
  const isSummer = currentTerm?.termNumber === 3 || academicLimits?.isSummer;
  const isFinalSemester = academicLimits?.isFinalSemester ?? false;
  const isGradeA = academicLimits?.isGradeA ?? (profile?.previousTermGpa ? profile.previousTermGpa >= 17 : false);

  const minUnits = academicLimits?.effectiveMinUnits ?? (isSummer ? 1 : 12);
  const maxUnits = academicLimits?.effectiveMaxUnits ?? (isSummer ? 8 : isFinalSemester || isGradeA ? 24 : 20);

  const extraUnits = selectedOfferings.reduce((sum, item) => item.isExtraUnit ? sum + (item.units || 0) : sum, 0);
  const totalUnits = selectedOfferings.reduce((sum, item) => {
    const isExtra = item.isExtraUnit;
    if (isExtra) return sum;
    return sum + (item.units || 0);
  }, 0);

  const capacityRemaining = maxUnits - totalUnits;

  const unitsStatusColor =
    totalUnits < minUnits
      ? 'text-amber-600 dark:text-amber-400'
      : totalUnits > maxUnits
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-emerald-600 dark:text-emerald-400';

  const unitsBarPercent = Math.min(100, Math.round((totalUnits / maxUnits) * 100));

  // Course reordering
  const handleMoveCourse = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= plannedCourses.length) return;

    const currentOrder = plannedCourses.map((pc) => pc.courseId);
    const newOrder = [...currentOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    if (onReorderCourses) {
      onReorderCourses(newOrder);
    }
  };

  // Offering Promotion (make fallback into primary)
  
  const handlePromoteOffering = (courseId: string, offeringId: string) => {
    if (onSelectPrimaryOffering) {
      onSelectPrimaryOffering(courseId, offeringId);
    } else {
      // Find the current primary offering for this course
      const courseOfferings = courseGroups.get(courseId) || [];
      const currentPrimary = courseOfferings.find(o => selectedOfferingIds.includes(o.offeringId));
      if (currentPrimary) {
        onToggleScheduleOffering(currentPrimary.offeringId);
      }
      setTimeout(() => {
        onToggleScheduleOffering(offeringId);
      }, 50);
    }
  };


  const handleExportExams = () => {
    if (selectedOfferings.length === 0) return;
    const icsContent = generateExamsICS(selectedOfferings);
    downloadICSFile(`darschyn-exams-${Date.now()}.ics`, icsContent);
  };

  const totalConflictsCount = lectureConflicts.length + examConflicts.length;

  return (
    <div className="space-y-5" id="schedule-planner-container">
      {/* Print Only Header */}
      <div className="hidden print:block mb-6 text-center border-b pb-4">
        <h1 className="text-2xl font-black text-slate-900 mb-1">سامانه تصمیم‌یار انتخاب واحد درس‌چین</h1>
        <h2 className="text-sm font-bold text-slate-700">برنامه کلاسی، اولویت‌بندی دروس و تقویم امتحانات</h2>
      </div>

      {/* Top Academic Status & Capacity Hub */}
      <div className="p-5 sm:p-6 bg-liquid-glass rounded-3xl shadow-xs space-y-4">
        {/* Banner Title & Actions */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs border border-blue-100 dark:border-blue-900/60">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  برنامه‌ریز و چینش اولویت دروس
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {plannedCourses.length} درس در برنامه
                </span>
                {isFinalSemester && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    مجوز ترم آخری (سقف ۲۴ واحد)
                  </span>
                )}
                {isGradeA && !isFinalSemester && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                    معدل الف (سقف ۲۴ واحد)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                اولویت‌بندی دروس، تعیین گروه‌های جایگزین (Fallback)، بررسی هوشمند تداخل ساعات کلاسی و امتحانی
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-end print:hidden">
            

            <button
              id="btnPrintSchedule"
              onClick={() => window.print()}
              className="px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl transition-colors text-xs flex items-center gap-1.5 font-semibold"
              title="چاپ برنامه و تقویم امتحانات (PDF)"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">چاپ برنامه</span>
            </button>

            <button
              id="btnExportICS"
              onClick={handleExportExams}
              className="px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl transition-colors text-xs flex items-center gap-1.5 font-semibold"
              title="دانلود تقویم امتحانات (ICS)"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">تقویم ICS</span>
            </button>

            {plannedCourses.length > 0 && (
              <button
                id="btnClearSchedule"
                onClick={onClearSchedule}
                className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors text-xs"
                title="پاکسازی کل برنامه"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Units Capacity Status & Progress Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-800">
          <div className="p-3 bg-slate-50/80 dark:bg-slate-850/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">مجموع واحدهای انتخابی</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-black ${unitsStatusColor}`}>{totalUnits}</span>
                <div className="text-xs text-slate-500 mt-1">{extraUnits > 0 ? `+ ${extraUnits} مازاد` : ''}</div>
              <span className="text-xs text-slate-500">از سقف {maxUnits} واحد</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50/80 dark:bg-slate-850/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">کف و سقف مجاز اخذ</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {minUnits} الی {maxUnits} واحد
              </span>
              <span className="text-[10px] text-slate-500">({isSummer ? 'تابستان' : 'عادی'})</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50/80 dark:bg-slate-850/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">ظرفیت باقیمانده واحد</span>
            <div className="text-xs font-black">
              {capacityRemaining > 0 ? (
                <span className="text-blue-600 dark:text-blue-400">{capacityRemaining} واحد امکان اخذ</span>
              ) : capacityRemaining === 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">سقف مجاز تکمیل</span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400">{Math.abs(capacityRemaining)} واحد مازاد بر سقف!</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50/80 dark:bg-slate-850/60 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">وضعیت تداخل‌ها</span>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              {totalConflictsCount === 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  بدون تداخل
                </span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {totalConflictsCount} مورد تداخل
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1">
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
            <div
              className={`h-full transition-all duration-300 ${
                totalUnits < minUnits
                  ? 'bg-amber-500'
                  : totalUnits > maxUnits
                  ? 'bg-rose-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, (totalUnits / maxUnits) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 px-1">
            <span>حداقل مجاز: {minUnits} واحد</span>
            <span>
              {totalUnits < minUnits
                ? `نیاز به ${minUnits - totalUnits} واحد دیگر برای رسیدن به حداقل مجاز`
                : totalUnits > maxUnits
                ? `عبور ${totalUnits - maxUnits} واحد از سقف مجاز انتخاب واحد`
                : 'تعداد واحدهای انتخابی در محدوده مجاز آموزشی است.'}
            </span>
            <span>حداکثر سقف: {maxUnits} واحد</span>
          </div>
        </div>
      </div>

      {/* Global Conflicts Warning Banner */}
      {totalConflictsCount > 0 && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-900 dark:text-rose-200 space-y-2 shadow-xs print:hidden animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>هشدار تداخلات آموزشی در برنامه انتخابی:</span>
          </div>
          <ul className="text-xs space-y-1 pr-6 list-disc text-rose-800 dark:text-rose-300">
            {lectureConflicts.map((lc, idx) => (
              <li key={`lc-${idx}`}>
                <strong>تداخل کلاسی:</strong> درس «{lc.offering1}» با درس «{lc.offering2}» در روز {lc.day} ساعت {lc.time}
              </li>
            ))}
            {examConflicts.map((ec, idx) => (
              <li key={`ec-${idx}`}>
                <strong>{ec.type === 'exact' ? 'تداخل دقیق آزمون' : 'همزمانی تاریخ آزمون'}:</strong> درس «{ec.offering1}» با درس «{ec.offering2}» در تاریخ {ec.date}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/70 dark:bg-slate-800/70 rounded-2xl border border-slate-300/60 dark:border-slate-700/60 print:hidden">
        <button
          id="tabPlannerPriorities"
          onClick={() => setActivePlannerTab('priorities')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activePlannerTab === 'priorities'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>چینش اولویت دروس و جایگزین‌ها ({plannedCourses.length})</span>
        </button>

        <button
          id="tabPlannerTimetable"
          onClick={() => setActivePlannerTab('timetable')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activePlannerTab === 'timetable'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>جدول هفتگی و تداخل‌سنج</span>
          {lectureConflicts.length > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px] font-bold">
              {lectureConflicts.length}
            </span>
          )}
        </button>

        <button
          id="tabPlannerExams"
          onClick={() => setActivePlannerTab('exams')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            activePlannerTab === 'exams'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>تقویم امتحانات</span>
          {examConflicts.length > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px] font-bold">
              {examConflicts.length}
            </span>
          )}
        </button>
      </div>

      {/* VIEW 1: COURSE PRIORITIES & PLANNED ALTERNATIVES DECK */}
      {activePlannerTab === 'priorities' && (
        <div className="space-y-4">
          {plannedCourses.length === 0 ? (
            <div className="p-12 text-center bg-liquid-glass rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                برنامه شما خالی است
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                از تب «دروس ارائه‌شده ترم» یا «پیشنهاد هوشمند دروس»، دروس مورد نظر خود را به برنامه اضافه فرمایید تا بتوانید اولویت‌ها و گزینه‌های جایگزین را مدیریت کنید.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {plannedCourses.map((pc, idx) => {
                const primary = pc.selectedOffering;
                const hasConflicts = pc.conflictDetails.length > 0;
                const isAddingFallback = addingFallbackForCourseId === pc.courseId;

                return (
                  <div
                    key={pc.courseId}
                    className={`p-4 sm:p-5 bg-liquid-glass rounded-3xl shadow-xs border transition-all space-y-4 ${
                      hasConflicts
                        ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/10'
                        : 'border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    {/* Course Card Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        {/* Priority Rank Badge */}
                        <div className="flex flex-col items-center justify-center w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-sm shrink-0 shadow-xs">
                          {idx + 1}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {pc.courseName}
                            </h4>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              کد {pc.courseCode}
                            </span>
                            <button
                              onClick={() => handleCopyCode(primary?.courseCode || primary?.courseCode || pc.courseCode)}
                              className="px-2.5 py-1 flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors text-[11px] font-bold"
                              title="کپی کد ارائه جهت پیست در آموزشیار"
                            >
                              {copiedCode === (primary?.courseCode || primary?.courseCode || pc.courseCode) ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  کپی شد
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  کپی کد آموزشیار
                                </>
                              )}
                            </button>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                              {pc.units} واحد
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Course Controls: Priority Arrows & Delete */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto print:hidden">
                        <span className="text-[11px] text-slate-400 pl-1">اولویت اخذ:</span>
                        <button
                          onClick={() => handleMoveCourse(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all"
                          title="افزایش اولویت درس"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveCourse(idx, 'down')}
                          disabled={idx === plannedCourses.length - 1}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all"
                          title="کاهش اولویت درس"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                        <button
                          onClick={() => onToggleScheduleOffering(primary.offeringId)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="حذف کامل این درس از برنامه"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Primary Selected Offering Block */}
                    <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-3 h-3" />
                            انتخاب اصلی (فعال در برنامه هفتگی)
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            گروه {primary.groupCode}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {primary.instructor || 'استاد نامشخص'}
                          </span>
                        </div>
                      </div>

                      {/* Primary offering schedule & exam metadata */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-900/50 p-2.5 rounded-xl border border-blue-100 dark:border-blue-950">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span>
                            زمان کلاس: <strong>{primary.dayOfWeek || '---'}</strong> ساعت{' '}
                            {primary.startTime ? `${primary.startTime} الی ${primary.endTime}` : 'نامشخص'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span>
                            تاریخ امتحان: <strong>{primary.examDate || 'اعلام نشده'}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Conflict details for this primary section if any */}
                      {hasConflicts && (
                        <div className="p-2.5 bg-rose-100/80 dark:bg-rose-950/60 rounded-xl border border-rose-300 dark:border-rose-800 text-[11px] text-rose-900 dark:text-rose-200 space-y-1">
                          {pc.conflictDetails.map((cd, cIdx) => (
                            <div key={cIdx} className="flex items-center gap-1.5 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span>{cd}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Fallback / Alternative Offerings Section */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-500" />
                          گروه‌های جایگزین و رزرو ({pc.fallbackOfferings.length} گروه)
                        </span>

                        {pc.availableOfferings.length > 0 && (
                          <button
                            onClick={() => setAddingFallbackForCourseId(isAddingFallback ? null : pc.courseId)}
                            className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{isAddingFallback ? 'بستن لیست' : '+ افزودن گروه جایگزین'}</span>
                          </button>
                        )}
                      </div>

                      {/* Fallback list */}
                      {pc.fallbackOfferings.length > 0 ? (
                        <div className="space-y-2">
                          {pc.fallbackOfferings.map((fb, fbIdx) => (
                            <div
                              key={fb.offeringId}
                              className="p-3 bg-slate-50/80 dark:bg-slate-850/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                    جایگزین {fbIdx + 1}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    گروه {fb.groupCode}
                                  </span>
                                  <span className="text-xs text-slate-600 dark:text-slate-400">
                                    (استاد: {fb.instructor || '---'})
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3 pr-2">
                                  <span>کلاس: {fb.dayOfWeek} {fb.startTime}-{fb.endTime}</span>
                                  <span>•</span>
                                  <span>امتحان: {fb.examDate || 'نامشخص'}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                                <button
                                  onClick={() => handlePromoteOffering(pc.courseId, fb.offeringId)}
                                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold border border-blue-200 dark:border-blue-800 transition-all flex items-center gap-1.5"
                                  title="تبدیل این گروه به انتخاب اول و اصلی"
                                >
                                  <ArrowRightLeft className="w-3 h-3" />
                                  <span>تبدیل به انتخاب اصلی</span>
                                </button>

                                {onRemoveFallbackOffering && (
                                  <button
                                    onClick={() => onRemoveFallbackOffering(pc.courseId, fb.offeringId)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                    title="حذف از جایگزین‌ها"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic pr-2">
                          هیچ گروه جایگزینی برای این درس تعیین نشده است. در صورت پر شدن ظرفیت، تعریف گروه جایگزین سرعت شما را در سامانه آموزشیار افزایش می‌دهد.
                        </p>
                      )}

                      {/* Dropdown to add other available groups as fallbacks */}
                      {isAddingFallback && pc.availableOfferings.length > 0 && (
                        <div className="p-3 bg-slate-100/80 dark:bg-slate-800/80 rounded-2xl border border-slate-300 dark:border-slate-700 space-y-2 animate-in fade-in">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                            سایر گروه‌های ارائه‌شده برای این درس:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {pc.availableOfferings.map((avail) => (
                              <div
                                key={avail.offeringId}
                                className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                              >
                                <div className="text-xs">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    گروه {avail.groupCode} - {avail.instructor || 'استاد نامشخص'}
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    {avail.dayOfWeek} {avail.startTime}-{avail.endTime}
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    if (onAddFallbackOffering) {
                                      onAddFallbackOffering(pc.courseId, avail.offeringId);
                                    } else {
                                      onToggleScheduleOffering(avail.offeringId);
                                    }
                                    setAddingFallbackForCourseId(null);
                                  }}
                                  className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[11px] font-bold hover:bg-blue-700 shrink-0"
                                >
                                  + افزودن جایگزین
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: FLUID WEEKLY TIMETABLE (07:00–20:00, exact minute positions) */}
      {activePlannerTab === 'timetable' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">جدول پیوسته هفتگی</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              ساعت‌ها آزادند، نه بازه‌های ثابت دو ساعته. برای نمایش همه روزها در موبایل جدول را افقی حرکت بده.
            </p>
          </div>
          <FluidWeekTimetable
            entries={selectedOfferings.map(item => ({
              id: item.offeringId,
              title: item.courseName,
              day: item.dayOfWeek,
              start: item.startTime,
              end: item.endTime,
              subtitle: `گروه ${item.groupCode} · ${item.instructor || 'استاد نامشخص'}`,
              conflict: (conflictMap.get(item.offeringId) || []).some(message => message.includes('کلاسی')),
            }))}
            onRemove={onToggleScheduleOffering}
          />
        </div>
      )}

      {/* VIEW 3: EXAM CALENDAR */}
      {activePlannerTab === 'exams' && (
        <ExamCalendar selectedItems={selectedOfferings} />
      )}

      {/* Educationalyar Copy Modal */}
      
    </div>
  );
};
