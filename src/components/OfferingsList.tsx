// ============================================================================
// DARSCHYN (درس‌چین) - Course Offerings, Section Selection & Priority Planning
// ============================================================================

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  User,
  Calendar,
  Layers,
  Search,
  Plus,
  Minus,
  Info,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Copy,
  SlidersHorizontal,
  Bookmark,
} from 'lucide-react';
import { CourseCategory, EligibilityStatus, CourseEligibilityResult } from '../types';

interface OfferingsListProps {
  evaluations: CourseEligibilityResult[];
  selectedOfferingIds: string[];
  onToggleScheduleOffering: (offeringId: string) => void;
  onOpenProfileModal: () => void;
  coursePriorities?: Record<string, number>;
  onUpdateCoursePriority?: (courseId: string, direction: 'up' | 'down') => void;
  offeringPriorities?: Record<string, string[]>; // courseId -> array of offeringIds in priority order
  onUpdateOfferingPriority?: (courseId: string, offeringId: string, direction: 'up' | 'down') => void;
}

export const OfferingsList: React.FC<OfferingsListProps> = ({
  evaluations,
  selectedOfferingIds,
  onToggleScheduleOffering,
  onOpenProfileModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'BLOCKED' | 'ALREADY_PASSED' | 'NEEDS_REVIEW'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [expandedCourseIds, setExpandedCourseIds] = useState<Record<string, boolean>>({});
  const [isCopyModalOpen, setCopyModalOpen] = useState(false);
  const [copyListFeedback,setCopyListFeedback]=useState('');

  // Group evaluations by course
  const groupedCourses = useMemo(() => {
    const map = new Map<string, {
      courseId: string;
      courseCode: string;
      courseName: string;
      units: number;
      category: string;
      classification?: string;
      overallStatus: EligibilityStatus;
      canSelect: boolean;
      primaryReason?: string;
      missingPrerequisites?: { code: string; name: string }[];
      missingCorequisites?: { code: string; name: string }[];
      sections: CourseEligibilityResult[];
    }>();

    evaluations.forEach((item) => {
      const cId = item.courseId || item.courseCode || item.courseName;
      if (!map.has(cId)) {
        map.set(cId, {
          courseId: cId,
          courseCode: item.courseCode,
          courseName: item.courseName,
          units: item.units,
          category: item.category,
          classification: item.curriculumContext?.classification,
          overallStatus: item.overallStatus,
          canSelect: item.canSelect,
          primaryReason: item.primaryReason,
          missingPrerequisites: item.missingPrerequisites,
          missingCorequisites: item.missingCorequisites,
          sections: [],
        });
      }
      map.get(cId)!.sections.push(item);
    });

    return Array.from(map.values());
  }, [evaluations]);

  // Filtered grouped courses
  const filteredGroups = useMemo(() => {
    return groupedCourses.filter((grp) => {
      const matchesSearch =
        !searchQuery.trim() ||
        grp.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        grp.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        grp.sections.some((s) => (s.instructor || '').toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesStatus = false;
      if (statusFilter === 'ALL') {
        matchesStatus = true;
      } else if (statusFilter === 'AVAILABLE') {
        matchesStatus = grp.overallStatus === 'AVAILABLE' && grp.sections.some((s) => s.canSelect);
      } else if (statusFilter === 'ALREADY_PASSED') {
        matchesStatus = grp.overallStatus === 'ALREADY_PASSED';
      } else if (statusFilter === 'NEEDS_REVIEW') {
        matchesStatus = grp.overallStatus === 'NEEDS_REVIEW';
      } else if (statusFilter === 'BLOCKED') {
        matchesStatus = grp.overallStatus.startsWith('BLOCKED') || grp.sections.every((s) => !s.canSelect);
      }

      const matchesCat = categoryFilter === 'ALL' || grp.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCat;
    });
  }, [groupedCourses, searchQuery, statusFilter, categoryFilter]);

  const toggleCourseExpand = (cId: string) => {
    setExpandedCourseIds((prev) => ({ ...prev, [cId]: !prev[cId] }));
  };

  const getStatusBadge = (status: EligibilityStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            قابل اخذ
          </span>
        );
      case 'BLOCKED_PREREQUISITE':
      case 'BLOCKED_COREQUISITE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5" />
            غیرقابل اخذ (عدم رعایت پیش‌نیاز)
          </span>
        );
      case 'ALREADY_PASSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80">
            <ShieldCheck className="w-3.5 h-3.5" />
            قبلاً پاس‌شده
          </span>
        );
      case 'NEEDS_REVIEW':
      case 'NOT_IN_CURRICULUM':
      case 'MAJOR_MISMATCH':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-3.5 h-3.5" />
            نیازمند بررسی
          </span>
        );
    }
  };

  const selectedOfferingsList = evaluations.filter(e=>selectedOfferingIds.includes(e.offeringId));
  const copyableRows=selectedOfferingsList.filter(e=>
    typeof e.rawCourseCode==='string' && e.rawCourseCode.trim().length>0 &&
    !/^DEMO[-_]/i.test(e.rawCourseCode.trim()) &&
    typeof e.groupCode==='string' && e.groupCode.trim().length>0);
  const handleCopyRegisteredCodes=async()=>{
    setCopyListFeedback('');
    if(!copyableRows.length){
      setCopyListFeedback('برای گروه‌های انتخاب‌شده کد ثبت‌شدهٔ قابل کپی موجود نیست؛ از صف سریع ثبت استفاده کن.');
      return;
    }
    const plainText=copyableRows.map(o=>
      `${o.courseName} | کد ثبت‌شده: ${o.rawCourseCode!.trim()} | گروه: ${o.groupCode.trim()}`).join('\n');
    try{
      if(typeof navigator==='undefined' || !navigator.clipboard?.writeText)
        throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(plainText);
      setCopyListFeedback(`اطلاعات ${copyableRows.length} گروه کپی شد؛ کدها را پیش از ثبت در آموزشیار بررسی کن.`);
    }catch{
      setCopyListFeedback('مرورگر اجازهٔ کپی نداد. برای کپی دستیِ کدها از صف سریع ثبت استفاده کن.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls */}
      <div className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="inputSearchOfferings"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو بر اساس عنوان درس، کد درس، یا نام استاد..."
              className="darschin-field w-full min-h-11 pr-9 pl-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Educationalyar Copy & Category Dropdown */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <select
              id="selectOfferingsCategoryFilter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white font-medium"
            >
              <option value="ALL">همه دسته‌بندی‌ها</option>
              <option value="پایه">دروس پایه</option>
              <option value="اصلی">دروس اصلی</option>
              <option value="تخصصی">دروس تخصصی</option>
              <option value="عمومی">دروس عمومی</option>
              <option value="اختیاری">دروس اختیاری</option>
              <option value="آزمایشگاه">آزمایشگاه و کارگاه</option>
            </select>

            {selectedOfferingIds.length > 0 && (
              <button type="button" onClick={()=>void handleCopyRegisteredCodes()}
                disabled={copyableRows.length===0}
                title="فهرست اطلاعات گروه‌های دارای کد ثبت‌شده؛ ثبت خودکار انجام نمی‌شود"
                className="flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-all shrink-0 disabled:opacity-40"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>کپی فهرست کدها ({copyableRows.length})</span>
              </button>
            )}
          </div>
        </div>
        {copyListFeedback&&<p role="status" aria-live="polite"
          className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-950 dark:bg-blue-950/50 dark:text-blue-100">
          {copyListFeedback}
        </p>}

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-2">
            فیلتر وضعیت اخذ:
          </span>
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`min-h-9 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            همه دروس ({groupedCourses.length})
          </button>
          <button
            onClick={() => setStatusFilter('AVAILABLE')}
            className={`min-h-9 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'AVAILABLE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
            }`}
          >
            قابل اخذ ({groupedCourses.filter((g) => g.overallStatus === 'AVAILABLE').length})
          </button>
          <button
            onClick={() => setStatusFilter('BLOCKED')}
            className={`min-h-9 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'BLOCKED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
            }`}
          >
            دارای پیش‌نیاز ({groupedCourses.filter((g) => g.overallStatus.startsWith('BLOCKED')).length})
          </button>
          <button
            onClick={() => setStatusFilter('ALREADY_PASSED')}
            className={`min-h-9 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'ALREADY_PASSED'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            قبلاً پاس‌شده ({groupedCourses.filter((g) => g.overallStatus === 'ALREADY_PASSED').length})
          </button>
        </div>
      </div>

      {/* Grouped Courses List */}
      <div className="space-y-3">
        {filteredGroups.length === 0 ? (
          <div className="p-12 text-center bg-liquid-glass rounded-3xl">
            <p className="text-xs text-slate-500">هیچ درسی با شرایط جستجو و فیلتر انتخاب‌شده یافت نشد.</p>
          </div>
        ) : (
          filteredGroups.map((grp, cIdx) => {
            const selectedSectionInCourse = grp.sections.find((s) => selectedOfferingIds.includes(s.offeringId));
            const isAnySelected = Boolean(selectedSectionInCourse);
            const isExpanded = expandedCourseIds[grp.courseId] ?? true; // Default expanded

            return (
              <div
                key={grp.courseId}
                className={`bg-liquid-glass rounded-3xl transition-all overflow-hidden border ${
                  isAnySelected
                    ? 'border-blue-500/80 shadow-md ring-1 ring-blue-500/20'
                    : 'border-white/50 dark:border-slate-800/80 shadow-xs'
                }`}
              >
                {/* Course Header */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/30 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                      {cIdx + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          {grp.courseName}
                        </h4>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          کد: {grp.courseCode}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold">
                          {grp.units} واحد ({grp.category})
                        </span>
                        {grp.classification && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium">
                            {grp.classification === 'MAJOR_REQUIRED' && 'رشته‌ای اجباری'}
                            {grp.classification === 'MAJOR_ELECTIVE' && 'رشته‌ای اختیاری'}
                            {grp.classification === 'TRACK_REQUIRED' && 'گرایشی اجباری'}
                            {grp.classification === 'TRACK_ELECTIVE' && 'گرایشی اختیاری'}
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium">
                          {grp.sections.length} گروه ارائه‌شده
                        </span>
                      </div>

                      {/* Missing Prereqs Warning */}
                      {grp.missingPrerequisites && grp.missingPrerequisites.length > 0 && (
                        <div className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>پیش‌نیاز گذرانده‌نشده: {grp.missingPrerequisites.map((p) => p.name).join('، ')}</span>
                        </div>
                      )}

                      {/* Missing Coreqs Warning */}
                      {grp.missingCorequisites && grp.missingCorequisites.length > 0 && (
                        <div className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>هم‌نیاز انتخاب‌نشده: {grp.missingCorequisites.map((p) => p.name).join('، ')} (باید این درس یا هم‌نیاز آن همزمان انتخاب شوند)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-center">
                    {getStatusBadge(grp.overallStatus)}
                    <button
                      onClick={() => toggleCourseExpand(grp.courseId)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title={isExpanded ? 'بستن گروه‌ها' : 'مشاهده گروه‌ها'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Offerings / Sections List under this course */}
                {isExpanded && (
                  <div className="p-3 sm:p-4 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block px-1 mb-1">
                      انتخاب گروه و استاد مورد نظر (بدون تحمیل گروه خاص):
                    </span>

                    <div className="grid grid-cols-1 gap-2">
                      {grp.sections.map((section, sIdx) => {
                        const isSelected = selectedOfferingIds.includes(section.offeringId);
                        const isSelectable = section.canSelect;

                        return (
                          <div
                            key={section.offeringId}
                            className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-blue-50/90 dark:bg-blue-950/60 border-blue-500 shadow-xs'
                                : !isSelectable
                                ? 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-80'
                                : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : !isSelectable
                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {section.groupCode || `۰${sIdx + 1}`}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(section.rawCourseCode + '_' + section.groupCode);
                                      alert('کد درس کپی شد.');
                                    }}
                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-blue-600 transition-colors"
                                    title="کپی کد درس"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                                    گروه {section.groupCode} — استاد {section.instructor || 'نامشخص'}
                                  </span>
                                  {isSelected && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                                      انتخاب اول (فعال در برنامه)
                                    </span>
                                  )}
                                  {!isSelectable && !isSelected && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                      غیرقابل اخذ
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {section.dayOfWeek || 'زمان نامشخص'} ({section.startTime || '--'} تا {section.endTime || '--'})
                                  </span>
                                  {section.examDate && (
                                    <span className="flex items-center gap-1 text-slate-500">
                                      <Calendar className="w-3 h-3 text-slate-400" />
                                      امتحان: {section.examDate}
                                    </span>
                                  )}
                                  {section.capacity !== undefined && (
                                    <span className="text-slate-500 font-mono">
                                      {section.enrolledCountKnown === false
                                        ? 'ظرفیت باقیمانده: نامشخص'
                                        : `ظرفیت باقیمانده: ${section.capacity - section.enrolledCount} نفر`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Select / Deselect Action */}
                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              {isSelected ? (
                                <button
                                  onClick={() => onToggleScheduleOffering(section.offeringId)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all bg-rose-600 hover:bg-rose-700 text-white shadow-xs active:scale-95"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                  <span>حذف از برنامه</span>
                                </button>
                              ) : !isSelectable ? (
                                <button
                                  disabled={true}
                                  title={section.primaryReason || 'عدم احراز شرایط اخذ درس'}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700 select-none opacity-80"
                                >
                                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                  <span>غیرقابل اخذ</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => onToggleScheduleOffering(section.offeringId)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl transition-all bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>اخذ این گروه</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Copy for Educationalyar Modal */}
      
    </div>
  );
};
