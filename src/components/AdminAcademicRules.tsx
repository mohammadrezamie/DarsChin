import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Trash2, Edit2, Plus, Search, Check, X, BookOpen, Layers, Users } from 'lucide-react';
import { RelationshipType, RuleConditionType } from '../types';

export const AdminAcademicRules: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [curricula, setCurricula] = useState<any[]>([]);
  const [majors, setMajors] = useState<any[]>([]);
  const [entryYears, setEntryYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<any>({
    curriculumId: '',
    entryYearId: '',
    majorId: '',
    targetCourseId: '',
    sourceCourseId: '',
    relationshipType: 'PREREQUISITE',
    conditionType: 'AND',
    minUnitsRequired: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    const [rulesRes, coursesRes, curRes, majRes, eyRes] = await Promise.all([
      apiRequest('/api/curriculum/rules'),
      apiRequest('/api/academic/courses'),
      apiRequest('/api/curriculum'),
      apiRequest('/api/academic/majors'),
      apiRequest('/api/academic/entry-years'),
    ]);

    if (rulesRes.success) setRules(rulesRes.data);
    if (coursesRes.success) setCourses(coursesRes.data);
    if (curRes.success) setCurricula(curRes.data);
    if (majRes.success) setMajors(majRes.data);
    if (eyRes.success) setEntryYears(eyRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!formData.targetCourseId) return alert('درس هدف الزامی است');
    if (formData.conditionType !== 'MIN_UNITS' && !formData.sourceCourseId) return alert('درس پیش‌نیاز/هم‌نیاز الزامی است');
    
    await apiRequest('/api/curriculum/rules', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    setIsAdding(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('آیا از حذف این قانون اطمینان دارید؟')) {
      await apiRequest(`/api/curriculum/rules/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xs border border-slate-200 dark:border-slate-800 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            مدیریت قوانین آموزشی (پیش‌نیاز / هم‌نیاز / تکرار)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            پیکربندی قوانین به تفکیک چارت، رشته و سال ورود
          </p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          افزودن قانون جدید
        </button>
      </div>

      {isAdding && (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 mb-6">
          <h3 className="font-bold text-sm mb-4">تعریف قانون جدید</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="space-y-1">
              <label className="text-xs text-slate-500">محدوده چارت تحصیلی</label>
              <select 
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm"
                value={formData.curriculumId}
                onChange={e => setFormData({...formData, curriculumId: e.target.value})}
              >
                <option value="">تمامی چارت‌ها (مستقل از چارت)</option>
                {curricula.map(c => <option key={c.id} value={c.id}>{c.name} - نسخه {c.version}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">محدوده سال ورود</label>
              <select 
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm"
                value={formData.entryYearId}
                onChange={e => setFormData({...formData, entryYearId: e.target.value})}
              >
                <option value="">همه ورودی‌ها</option>
                {entryYears.map(ey => <option key={ey.id} value={ey.id}>{ey.year}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">محدوده رشته</label>
              <select 
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm"
                value={formData.majorId}
                onChange={e => setFormData({...formData, majorId: e.target.value})}
              >
                <option value="">همه رشته‌ها</option>
                {majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-bold">نوع رابطه *</label>
              <select 
                className="w-full bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-2 text-sm text-indigo-700 dark:text-indigo-400 font-bold"
                value={formData.relationshipType}
                onChange={e => setFormData({...formData, relationshipType: e.target.value})}
              >
                <option value="PREREQUISITE">پیش‌نیاز (باید قبلاً گذرانده شود)</option>
                <option value="COREQUISITE">هم‌نیاز (همزمان یا قبل)</option>
                <option value="CONTEXTUAL_RETAKE_RULE">قانون تکرار (تبدیل به هم‌نیاز در صورت مردودی)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-bold">درس هدف (تخصیص گیرنده) *</label>
              <select 
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm"
                value={formData.targetCourseId}
                onChange={e => setFormData({...formData, targetCourseId: e.target.value})}
              >
                <option value="">-- انتخاب درس --</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500 font-bold">درس مبدا (نیازمندی) *</label>
              <select 
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm"
                value={formData.sourceCourseId}
                onChange={e => setFormData({...formData, sourceCourseId: e.target.value})}
                disabled={formData.conditionType === 'MIN_UNITS'}
              >
                <option value="">-- انتخاب درس --</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">شروط گذراندن</label>
              <select 
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm"
                value={formData.conditionType}
                onChange={e => setFormData({...formData, conditionType: e.target.value})}
              >
                <option value="AND">اجباری (AND)</option>
                <option value="OR">اختیاری (OR)</option>
                <option value="MIN_UNITS">شرط حداقل تعداد واحد گذرانده کل</option>
              </select>
            </div>

            {formData.conditionType === 'MIN_UNITS' && (
              <div className="space-y-1">
                <label className="text-xs text-slate-500">حداقل واحد</label>
                <input 
                  type="number"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm"
                  value={formData.minUnitsRequired}
                  onChange={e => setFormData({...formData, minUnitsRequired: e.target.value})}
                  placeholder="مثال: 50"
                />
              </div>
            )}

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs text-slate-500">توضیحات تکمیلی</label>
              <input 
                type="text"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm"
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                placeholder="توضیحات و مصوبات برای این قانون"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
            >
              انصراف
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              ذخیره قانون
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-500">در حال دریافت قوانین...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">درس هدف</th>
                <th className="py-3 px-4">رابطه</th>
                <th className="py-3 px-4">درس نیازمندی</th>
                <th className="py-3 px-4">محدوده</th>
                <th className="py-3 px-4">توضیحات</th>
                <th className="py-3 px-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                    {rule.targetCourseName}
                  </td>
                  <td className="py-3 px-4">
                    {rule.relationshipType === 'PREREQUISITE' && (
                      <span className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 px-2 py-1 rounded-md text-xs font-bold">پیش‌نیاز</span>
                    )}
                    {rule.relationshipType === 'COREQUISITE' && (
                      <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded-md text-xs font-bold">هم‌نیاز</span>
                    )}
                    {rule.relationshipType === 'CONTEXTUAL_RETAKE_RULE' && (
                      <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-md text-xs font-bold">تکرار / هم‌نیاز مشروط</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {rule.conditionType === 'MIN_UNITS' ? (
                      <span className="text-slate-500">حداقل {rule.minUnitsRequired} واحد</span>
                    ) : (
                      <span className="text-slate-700 dark:text-slate-300">{rule.sourceCourseName}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">
                    <div>چارت: {rule.curriculumName}</div>
                    {rule.majorName !== 'تمامی رشته‌ها' && <div>رشته: {rule.majorName}</div>}
                    {rule.entryYearName !== 'تمامی ورودی‌ها' && <div>ورودی: {rule.entryYearName}</div>}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">
                    {rule.notes || '-'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-2 rounded-lg transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500">
                    هیچ قانونی یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
