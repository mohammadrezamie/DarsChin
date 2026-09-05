const fs = require('fs');
const path = require('path');
const uiPath = path.join(process.cwd(), 'src/components/AdminAcademicRules.tsx');

const content = `import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Trash2, Plus, Server, Network } from 'lucide-react';
import { RelationshipType, AcademicRuleNode, Course } from '../types';

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

  const fetchData = async () => {
    setLoading(true);
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
    const res = await apiRequest(\`/api/curriculum/rules/\${id}\`, 'DELETE');
    if (res.success) {
      fetchData();
    } else {
      alert(res.error || 'خطا در حذف');
    }
  };

  const handleSave = async () => {
    if (!formData.curriculumId || !formData.targetCourseId) {
      alert('چارت درسی و درس هدف الزامی است.');
      return;
    }
    const res = await apiRequest('/api/curriculum/rules', 'POST', formData);
    if (res.success) {
      setIsAdding(false);
      fetchData();
    } else {
      alert(res.error || 'خطا در ثبت قانون');
    }
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Network className="text-blue-600" />
          مدیریت قوانین آکادمیک (پیش‌نیازها)
        </h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition"
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
                onChange={(e) => setFormData({ ...formData, curriculumId: e.target.value })}
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
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm"
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
            <div key={rule.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-gray-800">{rule.targetCourseName}</h3>
                  <span className={\`text-xs px-2 py-1 rounded-full \${rule.relationshipType === 'PREREQUISITE' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}\`}>
                    {rule.relationshipType === 'PREREQUISITE' ? 'پیش‌نیاز' : rule.relationshipType === 'COREQUISITE' ? 'هم‌نیاز' : 'افتاده'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-4">چارت: {rule.curriculumName}</p>
                <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 font-mono text-left" dir="ltr">
                  {JSON.stringify(rule.expression, null, 2)}
                </div>
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
`;

fs.writeFileSync(uiPath, content, 'utf-8');
console.log('UI updated.');
