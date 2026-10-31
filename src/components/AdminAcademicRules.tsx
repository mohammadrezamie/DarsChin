import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Trash2, Plus, Server, Network } from 'lucide-react';
import { RelationshipType, AcademicRule, AcademicRuleNode, Course } from '../types';
import { AdminDependencyMap } from './AdminDependencyMap';
import { AdminDependencyWorkbench } from './AdminDependencyWorkbench';
import { extractSourceCourseIds } from '../utils/academic';

// Keep this recursive editor component stable across changes to the parent form.
// Defining it inside AdminAcademicRules remounted all nested fields after each
// keystroke/selection and lost keyboard focus in long AND/OR expressions.
const NodeEditor = ({ node, onChange, coursesList }: { node: AcademicRuleNode, onChange: (n: AcademicRuleNode) => void, coursesList: Course[] }) => {
    return (
      <div className="p-4 border rounded-xl bg-white shadow-sm mb-4 space-y-4">
        <div className="flex items-center gap-4">
          <select 
            className="p-2 border rounded-lg bg-gray-50 text-sm"
            value={node.type}
            onChange={(e) => {
              const val = e.target.value as 'COURSE'|'GROUP';
              if (val === 'COURSE') onChange({ type: 'COURSE', courseId: '' });
              else onChange({ type: 'GROUP', operator: 'AND', operands: [{ type: 'COURSE', courseId: '' }] });
            }}
          >
            <option value="COURSE">یک درس (Course)</option>
            <option value="GROUP">گروه (Group)</option>
          </select>
          
          {node.type === 'GROUP' && (
            <select 
              className="p-2 border rounded-lg bg-blue-50 text-blue-800 text-sm font-bold"
              value={node.operator}
              onChange={(e) => onChange({ ...node, operator: e.target.value as 'AND'|'OR' })}
            >
              <option value="AND">همه موارد بالا (AND)</option>
              <option value="OR">حداقل یکی (OR)</option>
            </select>
          )}
        </div>

        {node.type === 'COURSE' ? (
          <div>
            <select
              className="w-full p-2 border rounded-lg text-sm"
              value={node.courseId || ''}
              onChange={(e) => onChange({ ...node, courseId: e.target.value })}
            >
              <option value="">-- انتخاب درس پیش‌نیاز/هم‌نیاز --</option>
              {coursesList.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
        ) : (
          <div className="pr-6 border-r-2 border-blue-200 space-y-2">
            {node.operands?.map((child, idx) => (
              <div key={idx} className="relative">
                <NodeEditor 
                  node={child} 
                  coursesList={coursesList}
                  onChange={(newChild) => {
                    const newOps = [...(node.operands || [])];
                    newOps[idx] = newChild;
                    onChange({ ...node, operands: newOps });
                  }} 
                />
                <button 
                  onClick={() => {
                    const newOps = [...(node.operands || [])];
                    newOps.splice(idx, 1);
                    onChange({ ...node, operands: newOps });
                  }}
                  className="absolute top-2 left-2 text-red-500 p-1 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                onChange({ ...node, operands: [...(node.operands || []), { type: 'COURSE', courseId: '' }] });
              }}
              className="flex items-center gap-2 text-sm text-blue-600 font-medium p-2 hover:bg-blue-50 rounded"
            >
              <Plus size={16} /> افزودن شرط جدید به این گروه
            </button>
          </div>
        )}
      </div>
    );
  };


export const AdminAcademicRules: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [curricula, setCurricula] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [dataReady, setDataReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteRuleId, setPendingDeleteRuleId] = useState<string | null>(null);
  const [advancedChartSnapshot, setAdvancedChartSnapshot] = useState<{
    id: string; memberIds: Set<string>; revision: string;
  } | null>(null);
  const [advancedLoading, setAdvancedLoading] = useState(false);
  const [advancedError, setAdvancedError] = useState('');

  const [formData, setFormData] = useState<{
    curriculumId: string;
    targetCourseId: string;
    relationshipType: RelationshipType;
    expression: AcademicRuleNode;
    notes: string;
  }>({
    curriculumId: '',
    targetCourseId: '',
    relationshipType: 'PREREQUISITE',
    expression: { type: 'COURSE', courseId: '' },
    notes: '',
  });

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [rulesRes, coursesRes, curRes] = await Promise.all([
        apiRequest<AcademicRule[]>('/api/curriculum/rules'),
        apiRequest<Course[]>('/api/academic/courses'),
        apiRequest('/api/curriculum'),
      ]);
      if (!rulesRes.success || !coursesRes.success || !curRes.success ||
          !Array.isArray(rulesRes.data) || !Array.isArray(coursesRes.data) || !Array.isArray(curRes.data)) {
        setError(rulesRes.error || coursesRes.error || curRes.error || 'داده‌های قوانین به‌طور کامل دریافت نشدند.');
        return;
      }
      setRules(rulesRes.data);
      setCourses(coursesRes.data);
      setCurricula(curRes.data);
      setDataReady(true);
    } catch {
      setError('ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  // Advanced forms must never offer a global, out-of-chart course list.
  // Fetch the *actual selected chart* and its current rule revision together.
  useEffect(() => {
    const chartId = formData.curriculumId;
    setAdvancedChartSnapshot(null);
    setAdvancedError('');
    if (!isAdding || !chartId) {
      setAdvancedLoading(false);
      return;
    }
    let active = true;
    setAdvancedLoading(true);
    void Promise.all([
      apiRequest<{ courses: { courseId: string; active?: boolean }[] }>(
        '/api/curriculum/' + encodeURIComponent(chartId) + '/full'),
      apiRequest<{ revision: string }>(
        '/api/curriculum/rules/history/' + encodeURIComponent(chartId)),
    ]).then(([members, history]) => {
      if (!active) return;
      if (!members.success || !Array.isArray(members.data?.courses) ||
          !history.success || !/^[a-f0-9]{64}$/.test(history.data?.revision ?? '')) {
        setAdvancedError(members.error || history.error || 'دروس یا نسخهٔ معتبر این چارت در دسترس نیست.');
        return;
      }
      setAdvancedChartSnapshot({
        id: chartId,
        memberIds: new Set(members.data!.courses
          .filter(item => item.active !== false).map(item => item.courseId)),
        revision: history.data!.revision,
      });
    }).catch(() => {
      if (active) setAdvancedError('بارگذاری چارت با خطا روبه‌رو شد؛ قانون ثبت نمی‌شود.');
    }).finally(() => { if (active) setAdvancedLoading(false); });
    return () => { active = false; };
  }, [isAdding, formData.curriculumId]);

  const activeAdvancedChart = advancedChartSnapshot?.id === formData.curriculumId
    ? advancedChartSnapshot : null;
  const scopedCourses = activeAdvancedChart
    ? courses.filter(course => course.active !== false && activeAdvancedChart.memberIds.has(course.id))
    : [];

  const handleDelete = async (id: string) => {
    if (saving || pendingDeleteRuleId !== id) return;
    setSaving(true);
    setError('');
    try {
      const target = rules.find(rule => rule.id === id);
      if (!target) { setError('قانون انتخاب‌شده پیدا نشد.'); return; }
      const version = await apiRequest<{ revision: string }>(
        '/api/curriculum/rules/history/' + encodeURIComponent(target.curriculumId));
      if (!version.success || !/^[a-f0-9]{64}$/.test(version.data?.revision ?? '')) {
        setError(version.error || 'نسخهٔ فعلی قوانین چارت مشخص نیست.');
        return;
      }
      const res = await apiRequest(`/api/curriculum/rules/${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: { 'If-Match': version.data!.revision },
      });
      if (res.success) {
        setPendingDeleteRuleId(null);
        await fetchData(true);
      } else setError(res.error || 'حذف قانون انجام نشد.');
    } catch {
      setError('ارتباط قطع شد؛ حذف قانون تأیید نشده است.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!formData.curriculumId || !formData.targetCourseId) {
      setError('چارت تحصیلی و درس هدف الزامی است.');
      return;
    }
    if (!activeAdvancedChart || advancedLoading || !activeAdvancedChart.memberIds.has(formData.targetCourseId)) {
      setError('ابتدا چارت معتبر و درس مقصدِ متعلق به همان چارت را انتخاب کنید.');
      return;
    }
    const sourceIds = extractSourceCourseIds(formData.expression);
    if (!sourceIds.length || sourceIds.some(id => !activeAdvancedChart.memberIds.has(id))) {
      setError('همهٔ درس‌های شرط باید از چارت انتخاب‌شده باشند؛ هیچ شرطی نمی‌تواند خالی بماند.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await apiRequest('/api/curriculum/rules', {
        method: 'POST',
        headers: { 'If-Match': activeAdvancedChart.revision },
        body: JSON.stringify(formData),
      });
      if (res.success) {
        setIsAdding(false);
        await fetchData(true);
      } else setError(res.error || 'قانون ذخیره نشد؛ اطلاعات فرم حفظ شدند.');
    } catch {
      setError('ارتباط قطع شد؛ اطلاعات فرم حفظ شدند.');
    } finally {
      setSaving(false);
    }
  };

  /** Human-readable rule summary: never make administrators read internal JSON IDs. */
  const describeExpression = (node: AcademicRuleNode): string => {
    if (node.type === 'COURSE') {
      const course = courses.find(item => item.id === node.courseId);
      return course ? `${course.name} (${course.code})` : 'درس نامشخص';
    }
    const parts = (node.operands ?? []).map(describeExpression);
    return parts.length ? `(${parts.join(node.operator === 'OR' ? ' یا ' : ' و ')})` : 'شرط خالی';
  };


  return (
    <div className="min-w-0 space-y-4">
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold leading-7 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        {error} <button type="button" onClick={() => void fetchData()} disabled={saving} className="mr-2 min-h-11 rounded-lg px-3 underline">دریافت دوباره</button>
      </div>}
      {!loading && dataReady && <>
        <AdminDependencyWorkbench rules={rules} courses={courses} curricula={curricula} onChanged={() => fetchData(true)} />
        <details className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-slate-800 dark:text-white">نمای تحلیلی و رتبه‌بندی کل زنجیرهٔ پیش‌نیازها</summary>
          <div className="pt-3"><AdminDependencyMap rules={rules} courses={courses} curricula={curricula} /></div>
        </details>
      </>}
      <details className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-extrabold text-slate-900 dark:text-white">قوانین ترکیبی و استثناها · ویرایش پیشرفته
          <span className="mr-2 text-xs font-normal text-slate-500 dark:text-slate-400">برای روابط «و/یا» و هم‌نیازی مشروط</span>
        </summary>
      <div className="min-w-0 space-y-5 pt-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Network className="text-blue-600" />
          مدیریت قوانین آکادمیک (پیش‌نیازها)
        </h2>
        <button
          type="button"
          disabled={saving}
          onClick={() => { setError(''); setIsAdding(!isAdding); }}
          className="min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {isAdding ? 'انصراف' : 'ثبت قانون جدید'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">چارت تحصیلی</label>
              <select 
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                value={formData.curriculumId}
                onChange={(e) => setFormData({
                  ...formData,
                  curriculumId: e.target.value,
                  targetCourseId: '',
                  expression: { type: 'COURSE', courseId: '' },
                })}
              >
                <option value="">-- انتخاب --</option>
                {curricula.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">درس هدف</label>
              <select 
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                value={formData.targetCourseId}
                onChange={(e) => setFormData({ ...formData, targetCourseId: e.target.value })}
              >
                <option value="">-- انتخاب --</option>
                {scopedCourses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع رابطه</label>
              <select 
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                value={formData.relationshipType}
                onChange={(e) => setFormData({ ...formData, relationshipType: e.target.value as any })}
              >
                <option value="PREREQUISITE">پیش‌نیاز</option>
                <option value="COREQUISITE">هم‌نیاز</option>
                <option value="CONTEXTUAL_RETAKE_RULE">هم‌نیاز در صورت افتادن</option>
              </select>
            </div>
          </div>

          {advancedLoading && <p role="status" className="text-xs text-indigo-700">در حال دریافت دروس معتبر چارت و آخرین نسخهٔ قوانین…</p>}
          {advancedError && <p role="alert" className="text-xs font-bold leading-6 text-rose-800">{advancedError}</p>}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="font-bold text-gray-700 mb-4">ساختار شرط (Prerequisite Tree)</h3>
            <NodeEditor 
              node={formData.expression} 
              coursesList={scopedCourses} 
              onChange={(exp) => setFormData({ ...formData, expression: exp })}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => setIsAdding(false)}
              className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              لغو
            </button>
            <button
              type="button"
              disabled={saving || advancedLoading || !activeAdvancedChart}
              onClick={() => void handleSave()}
              className="min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? 'در حال ثبت…' : 'ذخیره و اعتبارسنجی'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">در حال دریافت قوانین...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div key={rule.id} className="min-w-0 flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-gray-800">{rule.targetCourseName}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${rule.relationshipType === 'PREREQUISITE' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {rule.relationshipType === 'PREREQUISITE' ? 'پیش‌نیاز' : rule.relationshipType === 'COREQUISITE' ? 'هم‌نیاز' : 'افتاده'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-4">چارت: {rule.curriculumName}</p>
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-7 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <strong>رابطهٔ ثبت‌شده: </strong>{describeExpression(rule.expression)}
                </p>
              </div>
              <div className="mt-4 flex justify-end">
                {pendingDeleteRuleId === rule.id ? <div role="group" aria-label="تأیید حذف قانون" className="flex flex-wrap items-center gap-2">
                  <p className="w-full text-xs font-bold text-rose-800 dark:text-rose-300">این قانون از چارت حذف شود؟</p>
                  <button type="button" disabled={saving} onClick={() => setPendingDeleteRuleId(null)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-bold dark:border-slate-600">انصراف</button>
                  <button type="button" disabled={saving} onClick={() => void handleDelete(rule.id)}
                    className="min-h-11 rounded-lg bg-rose-700 px-3 text-xs font-bold text-white disabled:opacity-50">
                    {saving ? 'در حال حذف…' : 'تأیید حذف'}
                  </button>
                </div> : <button type="button" disabled={saving} onClick={() => { setError(''); setPendingDeleteRuleId(rule.id); }}
                  aria-label={`حذف قانون مربوط به ${rule.targetCourseName || 'درس انتخابی'}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300">
                  <Trash2 size={18} aria-hidden="true" /> حذف
                </button>}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
      </details>
    </div>
  );
};
