// ============================================================================
// DARSCHYN (درس‌چین) - Passed Courses Manager Component
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  Search,
  Plus,
  Trash2,
  BookOpen,
  Award,
  Filter,
  CheckCircle2,
  Sparkles,
  Layers,
  ListFilter,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Course, CourseCategory, StudentPassedCourse } from '../types';
import { apiRequest } from '../utils/api';

interface EnrichedPassedCourse extends StudentPassedCourse {
  course?: Course;
}

interface PassedCoursesManagerProps {
  onPassedCoursesChanged?: () => void;
}

export const PassedCoursesManager: React.FC<PassedCoursesManagerProps> = ({
  onPassedCoursesChanged,
}) => {
  const [passedCourses, setPassedCourses] = useState<EnrichedPassedCourse[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [totalUnits, setTotalUnits] = useState(0);
  const [categorySummary, setCategorySummary] = useState<Record<string, number>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'checklist' | 'table'>('checklist');

  const [selectedCourseIdToAdd, setSelectedCourseIdToAdd] = useState('');
  const [gradeInput, setGradeInput] = useState('');

  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);

  const fetchPassedData = async () => {
    setLoading(true);
    const [passedRes, coursesRes] = await Promise.all([
      apiRequest<{
        passedCourses: EnrichedPassedCourse[];
        totalUnits: number;
        categorySummary: Record<string, number>;
      }>('/api/student/passed-courses'),
      apiRequest<Course[]>('/api/academic/courses'),
    ]);

    if (passedRes.success && passedRes.data) {
      setPassedCourses(passedRes.data.passedCourses);
      setTotalUnits(passedRes.data.totalUnits);
      setCategorySummary(passedRes.data.categorySummary);
    }

    if (coursesRes.success && coursesRes.data) {
      setAllCourses(coursesRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPassedData();
  }, []);

  const handleAddPassedCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseIdToAdd) return;
    setAdding(true);

    const res = await apiRequest('/api/student/passed-courses', {
      method: 'POST',
      body: JSON.stringify({
        courseId: selectedCourseIdToAdd,
        grade: gradeInput ? parseFloat(gradeInput) : undefined,
      }),
    });

    setAdding(false);
    if (res.success) {
      setSelectedCourseIdToAdd('');
      setGradeInput('');
      await fetchPassedData();
      if (onPassedCoursesChanged) onPassedCoursesChanged();
    } else {
      alert(res.error || 'خطا در ثبت درس پاس‌شده.');
    }
  };

  const handleToggleCoursePassed = async (courseId: string) => {
    const existing = passedCourses.find((pc) => pc.courseId === courseId);
    if (existing) {
      // Remove it
      const res = await apiRequest(`/api/student/passed-courses/${existing.id}`, {
        method: 'DELETE',
      });
      if (res.success) {
        await fetchPassedData();
        if (onPassedCoursesChanged) onPassedCoursesChanged();
      }
    } else {
      // Add it
      const res = await apiRequest('/api/student/passed-courses', {
        method: 'POST',
        body: JSON.stringify({ courseId }),
      });
      if (res.success) {
        await fetchPassedData();
        if (onPassedCoursesChanged) onPassedCoursesChanged();
      }
    }
  };

  const handleQuickBatchSelect = async (categoryName?: string) => {
    setBatchSaving(true);
    let targetCourses = allCourses;
    if (categoryName) {
      targetCourses = allCourses.filter((c) => c.category === categoryName);
    }

    const targetIds = targetCourses.map((c) => c.id);
    const res = await apiRequest('/api/student/passed-courses/batch', {
      method: 'POST',
      body: JSON.stringify({ courseIds: targetIds, replaceAll: false }),
    });

    setBatchSaving(false);
    if (res.success) {
      await fetchPassedData();
      if (onPassedCoursesChanged) onPassedCoursesChanged();
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('آیا از حذف این درس از لیست دروس گذرانده مطمئن هستید؟')) return;

    const res = await apiRequest(`/api/student/passed-courses/${id}`, {
      method: 'DELETE',
    });

    if (res.success) {
      await fetchPassedData();
      if (onPassedCoursesChanged) onPassedCoursesChanged();
    } else {
      alert(res.error || 'خطا در حذف درس.');
    }
  };

  // Filter available courses not yet passed for the dropdown
  const passedIds = new Set(passedCourses.map((pc) => pc.courseId));
  const availableToPass = allCourses.filter((c) => !passedIds.has(c.id));

  // Filter current passed list by search query & category
  const filteredPassed = passedCourses.filter((pc) => {
    const name = pc.course?.name || '';
    const code = pc.course?.code || '';
    const cat = pc.course?.category || '';

    const matchesSearch = name.includes(searchQuery) || code.includes(searchQuery);
    const matchesCat = selectedCategory === 'all' || cat === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Filter all courses for interactive checklist view
  const checklistCourses = allCourses.filter((c) => {
    const name = c.name || '';
    const code = c.code || '';
    const cat = c.category || '';
    const matchesSearch = name.includes(searchQuery) || code.includes(searchQuery);
    const matchesCat = selectedCategory === 'all' || cat === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-liquid-glass rounded-3xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              مجموع واحدهای گذرانده
            </span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {totalUnits} <span className="text-xs font-normal text-slate-500">واحد</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-liquid-glass rounded-3xl shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
              تعداد دروس پاس‌شده
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {passedCourses.length} <span className="text-xs font-normal text-slate-500">عنوان درس</span>
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-liquid-glass rounded-3xl shadow-xs flex flex-col justify-center">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
            تفکیک دسته‌بندی واحدها
          </span>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {Object.entries(categorySummary).map(([cat, units]) => (
              <span
                key={cat}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
              >
                {cat}: {units} و
              </span>
            ))}
            {Object.keys(categorySummary).length === 0 && (
              <span className="text-slate-400 text-xs">هنوز درسی ثبت نشده است</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Batch Actions */}
      <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-slate-800/80 dark:to-slate-900/80 rounded-2xl border border-blue-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">
            تیک‌زدن سریع دروس گذرانده بر اساس چارت درسی:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={batchSaving}
            onClick={() => handleQuickBatchSelect('پایه')}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs transition-all"
          >
            + دروس پایه
          </button>
          <button
            type="button"
            disabled={batchSaving}
            onClick={() => handleQuickBatchSelect('عمومی')}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs transition-all"
          >
            + دروس عمومی
          </button>
          <button
            type="button"
            disabled={batchSaving}
            onClick={() => handleQuickBatchSelect('اصلی')}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs transition-all"
          >
            + دروس اصلی
          </button>
        </div>
      </div>

      {/* Main Container with Tabs */}
      <div className="p-5 sm:p-6 bg-liquid-glass rounded-3xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              مدیریت و ثبت کارنامه دروس گذرانده
            </h3>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setViewMode('checklist')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  viewMode === 'checklist'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                چک‌لیست تعاملی
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                لیست ثبت‌شده‌ها ({passedCourses.length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در دروس..."
                className="pr-8 pl-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white w-44"
              />
            </div>

            {/* Category filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white"
            >
              <option value="all">همه گروه‌ها</option>
              <option value="عمومی">عمومی</option>
              <option value="پایه">پایه</option>
              <option value="اصلی">اصلی</option>
              <option value="تخصصی">تخصصی</option>
              <option value="اختیاری">اختیاری</option>
            </select>
          </div>
        </div>

        {/* CHECKLIST VIEW (Easy 1-click toggles) */}
        {viewMode === 'checklist' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              برای ثبت یا حذف هر درس از لیست گذرانده‌شده‌ها، کافیست روی کارت درس کلیک کنید:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto p-1">
              {checklistCourses.map((course) => {
                const isPassed = passedIds.has(course.id);
                return (
                  <div
                    key={course.id}
                    onClick={() => handleToggleCoursePassed(course.id)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                      isPassed
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs'
                        : 'bg-white/50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
                  >
                    <div className="space-y-0.5 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">
                          {course.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono">{course.code}</span>
                        <span>•</span>
                        <span>{course.units} واحد</span>
                        <span>•</span>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {course.category}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                        isPassed
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                      }`}
                    >
                      {isPassed ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TABLE VIEW */}
        {viewMode === 'table' && (
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
            <table className="w-full text-xs text-right border-collapse">
              <thead className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-3">کد درس</th>
                  <th className="py-2.5 px-3">نام درس</th>
                  <th className="py-2.5 px-3">تعداد واحد</th>
                  <th className="py-2.5 px-3">نوع درس</th>
                  <th className="py-2.5 px-3">نمره</th>
                  <th className="py-2.5 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                {filteredPassed.map((pc) => (
                  <tr key={pc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-mono">{pc.course?.code || '---'}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                      {pc.course?.name || 'درس ناشناخته'}
                    </td>
                    <td className="py-2.5 px-3">{pc.course?.units || '-'} واحد</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-medium">
                        {pc.course?.category || '---'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {pc.grade !== undefined && pc.grade !== null ? pc.grade : 'قبول (بدون نمره)'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleRemove(pc.id)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                        title="حذف از دروس پاس‌شده"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPassed.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                      هیچ درسی با این مشخصات در کارنامه ثبت نشده است.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
