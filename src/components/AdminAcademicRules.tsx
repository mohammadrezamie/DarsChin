import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Trash2, Plus, Server, Network } from 'lucide-react';
import { RelationshipType, AcademicRuleNode, Course } from '../types';
import { AdminDependencyMap } from './AdminDependencyMap';
import { AdminDependencyWorkbench } from './AdminDependencyWorkbench';

export const AdminAcademicRules: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [curricula, setCurricula] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

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
    const [rulesRes, coursesRes, curRes] = await Promise.all([
      apiRequest('/api/curriculum/rules'),
      apiRequest('/api/academic/courses'),
      apiRequest('/api/curriculum'),
    ]);
    if (rulesRes.success) setRules(rulesRes.data);
    if (coursesRes.success) setCourses(coursesRes.data);
    if (curRes.success) setCurricula(curRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('آیا از حذف این قانون اطمینان دارید؟')) return;
    const res = await apiRequest(`/api/curriculum/rules/${id}`, { method: 'DELETE' });
    if (res.success) {
      await fetchData(true);
    } else {
      alert(res.error || 'خطا در حذف');
    }
  };

  const handleSave = async () => {
    if (!formData.curriculumId || !formData.targetCourseId) {
      alert('چارت درسی و درس هدف الزامی است.');
      return;
    }
    const res = await apiRequest('/api/curriculum/rules', { method: 'POST', body: JSON.stringify(formData) });
    if (res.success) {
      setIsAdding(false);
      await fetchData(true);
    } else {
      alert(res.error || 'خطا در ثبت قانون');
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

  // --- Node Builder Component ---
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
              className="p-2 border rounded-lg bg-teal-50 text-teal-900 text-sm font-bold"
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
          <div className="pr-6 border-r-2 border-teal-200 space-y-2">
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
              className="flex items-center gap-2 text-sm text-teal-700 font-medium p-2 hover:bg-teal-50 rounded"
            >
              <Plus size={16} /> افزودن شرط جدید به این گروه
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {!loading && <>
        <AdminDependencyWorkbench rules={rules} courses={courses} curricula={curricula} onChanged={() => fetchData(true)} />
        <details className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-slate-800 dark:text-white">نمای تحلیلی و رتبه‌بندی کل زنجیرهٔ پیش‌نیازها</summary>
          <div className="pt-3"><AdminDependencyMap rules={rules} courses={courses} curricula={curricula} /></div>
        </details>
      </>}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Network className="text-teal-700" />
          مدیریت قوانین آکادمیک (پیش‌نیازها)
        </h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-teal-700 text-white px-4 py-2 rounded-lg hover:bg-teal-800 flex items-center gap-2 transition"
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
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-200 focus:border-teal-600"
                value={formData.curriculumId}
                onChange={(e) => setFormData({ ...formData, curriculumId: e.target.value })}
              >
                <option value="">-- انتخاب --</option>
                {curricula.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">درس هدف</label>
              <select 
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-200 focus:border-teal-600"
                value={formData.targetCourseId}
                onChange={(e) => setFormData({ ...formData, targetCourseId: e.target.value })}
              >
                <option value="">-- انتخاب --</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع رابطه</label>
              <select 
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-teal-200 focus:border-teal-600"
                value={formData.relationshipType}
                onChange={(e) => setFormData({ ...formData, relationshipType: e.target.value as any })}
              >
                <option value="PREREQUISITE">پیش‌نیاز</option>
                <option value="COREQUISITE">هم‌نیاز</option>
                <option value="CONTEXTUAL_RETAKE_RULE">هم‌نیاز در صورت افتادن</option>
              </select>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 className="font-bold text-gray-700 mb-4">ساختار شرط (Prerequisite Tree)</h3>
            <NodeEditor 
              node={formData.expression} 
              coursesList={courses} 
              onChange={(exp) => setFormData({ ...formData, expression: exp })}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-600"
            >
              لغو
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 shadow-sm"
            >
              ذخیره و اعتبارسنجی
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
                  <span className={`text-xs px-2 py-1 rounded-full ${rule.relationshipType === 'PREREQUISITE' ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-700'}`}>
                    {rule.relationshipType === 'PREREQUISITE' ? 'پیش‌نیاز' : rule.relationshipType === 'COREQUISITE' ? 'هم‌نیاز' : 'افتاده'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-4">چارت: {rule.curriculumName}</p>
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-7 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                  <strong>رابطهٔ ثبت‌شده: </strong>{describeExpression(rule.expression)}
                </p>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={() => handleDelete(rule.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
