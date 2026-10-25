import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { NewCurriculumForm } from './NewCurriculumForm';
import { extractSourceCourseIds } from '../utils/academic';
import { Plus, Search, Layers, ChevronDown, ChevronRight, Edit2, Trash2, Check, X, ShieldAlert, BookOpen, GitFork } from 'lucide-react';
import { Curriculum, CurriculumCourse, Course, AcademicRule, Track, Major, EntryYear, CourseClassification } from '../types';

export const AdminCurriculumBuilder: React.FC = () => {
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [entryYears, setEntryYears] = useState<EntryYear[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string | null>(null);
  
  const [curriculumFull, setCurriculumFull] = useState<any>(null); // Details
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  const [addCourseForm, setAddCourseForm] = useState({
    courseId: '', trackId: '', suggestedSemester: 1, classification: 'MAJOR_REQUIRED'
  });
  const [addRuleForm, setAddRuleForm] = useState({
    sourceCourseId: '', relationshipType: 'PREREQUISITE', conditionType: 'AND', ruleGroup: ''
  });

  const fetchData = async () => {
    setLoading(true);
    const [currRes, majRes, yearRes, trkRes, crsRes] = await Promise.all([
      apiRequest('/api/curriculum'),
      apiRequest('/api/academic/majors'),
      apiRequest('/api/academic/entry-years'),
      apiRequest('/api/academic/tracks'),
      apiRequest('/api/academic/courses')
    ]);
    if (currRes.success) setCurricula(currRes.data);
    if (majRes.success) setMajors(majRes.data);
    if (yearRes.success) setEntryYears(yearRes.data);
    if (trkRes.success) setTracks(trkRes.data);
    if (crsRes.success) setCourses(crsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const loadCurriculumDetails = async (id: string) => {
    const res = await apiRequest(`/api/curriculum/${id}/full`);
    if (res.success) {
      setCurriculumFull(res.data);
    } else {
      setCurriculumFull(null);
    }
  };

  useEffect(() => {
    if (selectedCurriculumId) {
      loadCurriculumDetails(selectedCurriculumId);
      setActiveCourseId(null);
    }
  }, [selectedCurriculumId]);

  const handleAddCourse = async () => {
    if (!addCourseForm.courseId) return alert('شناسه درس الزامی است');
    const res = await apiRequest(`/api/curriculum/${selectedCurriculumId}/courses`, {
      method: 'POST',
      body: JSON.stringify(addCourseForm)
    });
    if (res.success) {
      loadCurriculumDetails(selectedCurriculumId!);
      setAddCourseForm({ courseId: '', trackId: '', suggestedSemester: 1, classification: 'MAJOR_REQUIRED' });
    } else {
      alert(res.error || 'خطا در افزودن درس');
    }
  };

  const handleRemoveCourse = async (courseId: string, trackId?: string | null) => {
    if (!confirm('انتساب این درس از چارت حذف شود؟ سوابق نیازسنجی حذف نخواهند شد.')) return;
    const query=trackId ? `?trackId=${encodeURIComponent(trackId)}`:'';
    const result=await apiRequest(`/api/curriculum/${selectedCurriculumId}/courses/${courseId}${query}`,{method:'DELETE'});
    if (!result.success) { alert(result.error||'حذف درس مجاز نیست.');return; }
    void loadCurriculumDetails(selectedCurriculumId!);
    if (activeCourseId === courseId) setActiveCourseId(null);
  };

  const handleAddRule = async () => {
    if (!addRuleForm.sourceCourseId) return alert('درس پیش‌نیاز/هم‌نیاز را انتخاب کنید');
    const res = await apiRequest(`/api/curriculum/rules`, {
      method: 'POST',
      body: JSON.stringify({
        curriculumId: selectedCurriculumId,
        targetCourseId: activeCourseId,
        relationshipType: addRuleForm.relationshipType,
        expression: { type: 'COURSE', courseId: addRuleForm.sourceCourseId }
      })
    });
    if (res.success) {
      loadCurriculumDetails(selectedCurriculumId!);
      setAddRuleForm({ sourceCourseId: '', relationshipType: 'PREREQUISITE', conditionType: 'AND', ruleGroup: '' });
    } else {
      alert(res.error || 'خطا در افزودن قانون');
    }
  };
  
  const handleRemoveRule = async (ruleId: string) => {
    await apiRequest(`/api/curriculum/rules/${ruleId}`, { method: 'DELETE' });
    loadCurriculumDetails(selectedCurriculumId!);
  };

  if (loading && !curricula.length) return <div className="p-8 text-center">در حال بارگذاری...</div>;

  return (
    <div dir="rtl" className="darschin-page space-y-4">
      <NewCurriculumForm onCreated={(chart) => {
        setCurricula(prev => [...prev, chart]);
        setSelectedCurriculumId(chart.id);
        void fetchData();
      }} />
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 shadow-xs border border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-500" />
          مدیریت ساختار چارت تحصیلی
        </h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">چارت‌های فعال و پیش‌نویس:</label>
          <select 
            className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-indigo-500"
            value={selectedCurriculumId || ''}
            onChange={(e) => setSelectedCurriculumId(e.target.value)}
          >
            <option value="">-- یک چارت انتخاب کنید --</option>
            {curricula.map(c => (
              <option key={c.id} value={c.id}>{c.name} · {c.status === 'active' ? 'فعال' : c.status === 'draft' ? 'پیش‌نویس' : 'آرشیو'} ({c.version})</option>
            ))}
          </select>
        </div>

        {curriculumFull && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-sm mb-4">افزودن درس به چارت</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <select 
                    className="p-2 border rounded-lg text-xs dark:bg-slate-900 dark:border-slate-700"
                    value={addCourseForm.courseId}
                    onChange={(e) => setAddCourseForm({...addCourseForm, courseId: e.target.value})}
                  >
                    <option value="">-- انتخاب درس --</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                  </select>
                  <select 
                    className="p-2 border rounded-lg text-xs dark:bg-slate-900 dark:border-slate-700"
                    value={addCourseForm.classification}
                    onChange={(e) => setAddCourseForm({...addCourseForm, classification: e.target.value as CourseClassification})}
                  >
                    <option value="MAJOR_REQUIRED">رشته‌ای اجباری</option>
                    <option value="MAJOR_ELECTIVE">رشته‌ای اختیاری</option>
                    <option value="TRACK_REQUIRED">گرایشی اجباری</option>
                    <option value="TRACK_ELECTIVE">گرایشی اختیاری</option>
                  </select>
                  <select 
                    className="p-2 border rounded-lg text-xs dark:bg-slate-900 dark:border-slate-700"
                    value={addCourseForm.trackId}
                    onChange={(e) => setAddCourseForm({...addCourseForm, trackId: e.target.value})}
                  >
                    <option value="">همه گرایش‌ها</option>
                    {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button 
                    onClick={handleAddCourse}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold p-2 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> افزودن
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      <th className="p-2 rounded-r-lg">کد</th>
                      <th className="p-2">نام درس</th>
                      <th className="p-2">دسته‌بندی (نقش)</th>
                      <th className="p-2">گرایش</th>
                      <th className="p-2 rounded-l-lg">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curriculumFull.courses.map((cc: any) => (
                      <tr 
                        key={cc.id} 
                        className={`border-b dark:border-slate-700/50 cursor-pointer transition-colors ${activeCourseId === cc.courseId ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                        onClick={() => setActiveCourseId(cc.courseId)}
                      >
                        <td className="p-2 font-mono text-xs">{cc.course?.code}</td>
                        <td className="p-2 font-bold">{cc.course?.name}</td>
                        <td className="p-2 text-xs">
                          {cc.classification === 'MAJOR_REQUIRED' && 'رشته‌ای اجباری'}
                          {cc.classification === 'MAJOR_ELECTIVE' && 'رشته‌ای اختیاری'}
                          {cc.classification === 'TRACK_REQUIRED' && 'گرایشی اجباری'}
                          {cc.classification === 'TRACK_ELECTIVE' && 'گرایشی اختیاری'}
                        </td>
                        <td className="p-2 text-xs">{cc.trackId ? tracks.find(t => t.id === cc.trackId)?.name : '-'}</td>
                        <td className="p-2 flex items-center gap-2">
                           <button onClick={(e) => { e.stopPropagation(); void handleRemoveCourse(cc.courseId,cc.trackId); }} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rule Builder Sidebar */}
            <div className="lg:col-span-1 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
              {!activeCourseId ? (
                <div className="text-center text-slate-500 text-sm py-8">
                  یک درس را از جدول انتخاب کنید تا قوانین آن را مدیریت کنید.
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-bold text-md text-slate-800 dark:text-white border-b pb-2 dark:border-slate-700">
                    قوانین درس: {courses.find(c => c.id === activeCourseId)?.name}
                  </h3>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500">پیش‌نیازها</h4>
                    {curriculumFull.prerequisites.filter((r: any) => r.targetCourseId === activeCourseId).map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">{'درس مرتبط'}</span>
                          <span>{extractSourceCourseIds(r.expression).map(id=>courses.find(c=>c.id===id)?.name||id).join('، ')}</span>
                        </div>
                        <button onClick={() => handleRemoveRule(r.id)} className="text-red-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 mt-4">هم‌نیازها</h4>
                    {curriculumFull.corequisites.filter((r: any) => r.targetCourseId === activeCourseId).map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">{'درس مرتبط'}</span>
                          <span>{extractSourceCourseIds(r.expression).map(id=>courses.find(c=>c.id===id)?.name||id).join('، ')}</span>
                        </div>
                        <button onClick={() => handleRemoveRule(r.id)} className="text-red-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 border-t pt-4 dark:border-slate-700 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">افزودن قانون جدید</h4>
                    <select 
                      className="w-full p-2 border rounded-lg text-xs dark:bg-slate-900 dark:border-slate-700"
                      value={addRuleForm.sourceCourseId}
                      onChange={(e) => setAddRuleForm({...addRuleForm, sourceCourseId: e.target.value})}
                    >
                      <option value="">-- انتخاب درس مبدا --</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <select 
                        className="flex-1 p-2 border rounded-lg text-xs dark:bg-slate-900 dark:border-slate-700"
                        value={addRuleForm.relationshipType}
                        onChange={(e) => setAddRuleForm({...addRuleForm, relationshipType: e.target.value})}
                      >
                        <option value="PREREQUISITE">پیش‌نیاز</option>
                        <option value="COREQUISITE">هم‌نیاز</option>
                      </select>
                      <span className="self-center text-[11px] text-slate-500 dark:text-slate-300">یک درس مرتبط</span>
                    </div>
                    <button 
                      onClick={handleAddRule}
                      className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 text-white rounded-lg text-xs font-bold p-2 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> ثبت قانون
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
