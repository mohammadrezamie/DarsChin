import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, BookOpen, GraduationCap } from 'lucide-react';
import { apiRequest } from '../utils/api';
import type { AcademicRule, AcademicRuleNode, Course, Curriculum, RelationshipType } from '../types';

type ListedRule = AcademicRule & { targetCourseName?: string; curriculumName?: string };
type Condition = { key: string; type: 'COURSE' | 'MIN_PASSED_UNITS'; courseId: string; minUnits: number };
const empty = (): Condition => ({ key: `condition-${Math.random().toString(36).slice(2)}`, type: 'COURSE', courseId: '', minUnits: 1 });
const field = 'mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

function describeCondition(node: AcademicRuleNode, names: Map<string,string>): string {
  if (node.type === 'COURSE') return `قبولی در «${names.get(node.courseId || '') || node.courseId || 'درس نامشخص'}»`;
  if (node.type === 'MIN_PASSED_UNITS') return `حداقل ${node.minUnits} واحد گذرانده‌شده`;
  if (node.type === 'GROUP') return (node.operands || []).map(item=>describeCondition(item,names))
    .join(node.operator === 'OR' ? ' یا ' : ' و ');
  return 'شرط نیازمند بررسی';
}
function asSimpleEditor(node: AcademicRuleNode): { conditions: Condition[]; operator: 'AND' | 'OR' } | null {
  const operator = node.type === 'GROUP' ? node.operator : 'AND';
  const children = node.type === 'GROUP' ? node.operands || [] : [node];
  if (children.some(item=>item.type === 'GROUP' || (item.type !== 'COURSE' && item.type !== 'MIN_PASSED_UNITS'))) return null;
  return {
    operator: operator === 'OR' ? 'OR' : 'AND',
    conditions: children.map(item=>({ ...empty(),
      type: item.type as Condition['type'], courseId: item.courseId || '', minUnits: item.minUnits || 1 })),
  };
}

/** Simple, unlimited row-based rule form. Advanced legacy rule trees remain visible rather than silently rewritten. */
export const AdminAcademicRules: React.FC = () => {
  const [rules, setRules] = useState<ListedRule[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [curriculumId, setCurriculumId] = useState('');
  const [targetCourseId, setTargetCourseId] = useState('');
  const [relationshipType, setRelationshipType] = useState<RelationshipType>('PREREQUISITE');
  const [conditions, setConditions] = useState<Condition[]>([empty()]);
  const [operator, setOperator] = useState<'AND'|'OR'>('AND');
  const [notes, setNotes] = useState('');
  const [editId, setEditId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const courseNames = useMemo(()=>new Map(courses.map(c=>[c.id,c.name])),[courses]);
  const selectedChart = curricula.find(c=>c.id===curriculumId);
  const visibleRules = rules.filter(r=>!curriculumId || r.curriculumId===curriculumId);

  const refresh = async () => {
    setLoading(true);
    const [r, c, charts] = await Promise.all([
      apiRequest<ListedRule[]>('/api/curriculum/rules'),
      apiRequest<Course[]>('/api/academic/courses'),
      apiRequest<Curriculum[]>('/api/curriculum'),
    ]);
    if (r.success) setRules(r.data || []);
    if (c.success) setCourses(c.data || []);
    if (charts.success) setCurricula(charts.data || []);
    if (!r.success || !c.success || !charts.success) setMessage('بارگذاری همه اطلاعات آموزشی کامل نشد.');
    setLoading(false);
  };
  useEffect(()=>{ void refresh(); },[]);

  const resetForm = () => {
    setEditId('');setTargetCourseId('');setRelationshipType('PREREQUISITE');
    setConditions([empty()]);setOperator('AND');setNotes('');setFormOpen(false);
  };
  const startEdit = (rule: ListedRule) => {
    const editable = asSimpleEditor(rule.expression);
    if (!editable) { setMessage('این قانون قدیمی دارای گروه‌های تو در تو است؛ ویرایش سادهٔ آن بدون حذف ساختارش امکان‌پذیر نیست.');return; }
    setCurriculumId(rule.curriculumId);setTargetCourseId(rule.targetCourseId);
    setRelationshipType(rule.relationshipType);setConditions(editable.conditions);
    setOperator(editable.operator);setNotes(rule.notes || '');setEditId(rule.id);
    setFormOpen(true);setMessage('');
  };
  const change = (key:string, patch:Partial<Condition>) =>
    setConditions(list=>list.map(row=>row.key===key?{...row,...patch}:row));
  const save = async () => {
    if (!selectedChart || !targetCourseId) { setMessage('چارت و درس مقصد باید انتخاب شوند.');return; }
    if (!conditions.length) { setMessage('این درس شرطی ندارد؛ نیازی به ثبت قانون نیست.');return; }
    if (conditions.some(row=>row.type==='COURSE' ? !row.courseId || row.courseId===targetCourseId :
      !Number.isInteger(row.minUnits) || row.minUnits<1 || row.minUnits>999)) {
      setMessage('یکی از شروط نامعتبر یا ارجاع به خود درس است.');return;
    }
    const operands: AcademicRuleNode[] = conditions.map(row=>
      row.type==='COURSE' ? {type:'COURSE',courseId:row.courseId} :
      {type:'MIN_PASSED_UNITS',minUnits:row.minUnits});
    const expression: AcademicRuleNode = operands.length === 1 ? operands[0] :
      {type:'GROUP',operator,operands};
    const body = {
      curriculumId: selectedChart.id, targetCourseId, relationshipType, expression, notes,
      majorId: selectedChart.majorId, entryYearId: selectedChart.entryYearId,
    };
    setSaving(true);setMessage('');
    const result = await apiRequest(editId?`/api/curriculum/rules/${editId}`:'/api/curriculum/rules',
      {method:editId?'PUT':'POST',body:JSON.stringify(body)});
    setSaving(false);
    if (!result.success) {setMessage(result.error||'ذخیره قانون ناموفق بود.');return;}
    setMessage('قانون ذخیره شد؛ اعمال رسمی آن منوط به تأیید مقررات آموزشی است.');
    resetForm();await refresh();
  };
  const remove = async (id:string) => {
    if (!window.confirm('قانون آموزشی حذف شود؟')) return;
    const result = await apiRequest(`/api/curriculum/rules/${id}`,{method:'DELETE'});
    if (!result.success) {setMessage(result.error || 'حذف انجام نشد.');return;}
    setMessage('قانون حذف شد.');await refresh();
  };

  return <section dir="rtl" className="darschin-page min-w-0 space-y-5">
    <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-slate-100">
          <GraduationCap className="h-5 w-5 text-blue-600" /> تنظیم شرایط اخذ دروس
        </h2>
        <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
          هر درس می‌تواند هر تعداد پیش‌نیاز یا هم‌نیاز داشته باشد، یا اصلاً شرطی نداشته باشد.
          حداقل واحد گذرانده‌شده نیز مثل انتخاب یک درس، یک ردیف ساده است.
        </p>
      </div>
      <button type="button" onClick={()=>{resetForm();setFormOpen(true);setMessage('')}}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">
        <Plus className="h-4 w-4" /> تعریف شرط
      </button>
    </header>
    {message && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{message}</p>}
    {formOpen && <div className="min-w-0 space-y-4 rounded-2xl border border-blue-200 bg-white p-3 dark:border-blue-900 dark:bg-slate-900 sm:p-5">
      <h3 className="font-black">{editId?'ویرایش شرط':'افزودن شرط جدید'}</h3>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-xs font-bold">چارت تحصیلی
          <select className={field} value={curriculumId} disabled={!!editId}
            onChange={e=>{setCurriculumId(e.target.value);setTargetCourseId('')}}>
            <option value="">انتخاب چارت</option>{curricula.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-xs font-bold">درسی که شرط برای آن تعریف می‌شود
          <select className={field} value={targetCourseId} disabled={!!editId}
            onChange={e=>setTargetCourseId(e.target.value)}>
            <option value="">انتخاب درس</option>
            {courses.filter(c=>c.active!==false).map(c=><option key={c.id} value={c.id}>{c.name} · {c.code}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-xs font-bold">نوع شرط
          <select className={field} value={relationshipType}
            onChange={e=>setRelationshipType(e.target.value as RelationshipType)}>
            <option value="PREREQUISITE">پیش‌نیاز</option>
            <option value="COREQUISITE">هم‌نیاز</option>
            <option value="CONTEXTUAL_RETAKE_RULE">شرط اخذ مجدد (پس از مردودی؛ نیازمند تأیید ضوابط)</option>
          </select>
        </label>
        <label className="min-w-0 text-xs font-bold">ارتباط بین شروط
          <select className={field} value={operator} onChange={e=>setOperator(e.target.value as 'AND'|'OR')}>
            <option value="AND">همهٔ شروط باید برقرار باشند</option>
            <option value="OR">برقرار بودن یکی از شروط کافی است</option>
          </select>
        </label>
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-black">شرط‌ها</h4>
        {conditions.map((row,index)=><div key={row.key} className="grid min-w-0 gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70 sm:grid-cols-[auto_11rem_minmax(0,1fr)_auto] sm:items-end">
          <span className="text-xs font-bold text-slate-500">#{index+1}</span>
          <label className="min-w-0 text-xs font-bold">نوع
            <select value={row.type} className={field} onChange={e=>change(row.key,{type:e.target.value as Condition['type']})}>
              <option value="COURSE">قبولی در درس</option>
              <option value="MIN_PASSED_UNITS">حداقل واحد پاس‌شده</option>
            </select>
          </label>
          <label className="min-w-0 text-xs font-bold">{row.type==='COURSE'?'درس موردنیاز':'تعداد واحد گذرانده‌شده'}
            {row.type==='COURSE'?<select className={field} value={row.courseId} onChange={e=>change(row.key,{courseId:e.target.value})}>
              <option value="">انتخاب درس</option>
              {courses.filter(c=>c.active!==false && c.id!==targetCourseId).map(c=><option key={c.id} value={c.id}>{c.name} · {c.code}</option>)}
            </select>:<input type="number" min={1} max={999} step={1} value={row.minUnits}
              onChange={e=>change(row.key,{minUnits:Number(e.target.value)})} className={field}/>}
          </label>
          <button type="button" aria-label={`حذف شرط ${index+1}`} onClick={()=>setConditions(list=>list.filter(x=>x.key!==row.key))}
            className="min-h-11 rounded-xl border border-rose-200 px-3 text-rose-700 dark:border-rose-900 dark:text-rose-300">
            <Trash2 className="mx-auto h-4 w-4" />
          </button>
        </div>)}
        <button type="button" onClick={()=>setConditions(list=>[...list,empty()])}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-300 px-3 text-xs font-bold text-blue-700 dark:text-blue-300">
          <Plus className="h-4 w-4"/> افزودن شرط دیگر
        </button>
        <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
          اگر این درس نه پیش‌نیاز دارد و نه هم‌نیاز، هیچ قانونی برایش نساز. قواعد چندشرطی در یک فرم ذخیره می‌شوند.
        </p>
      </div>
      <label className="block text-xs font-bold">توضیح داخلی (اختیاری)
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-slate-700"/>
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <button className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm dark:border-slate-700" type="button" onClick={resetForm}>انصراف</button>
        <button className="min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-50"
          type="button" disabled={saving||!conditions.length} onClick={()=>void save()}>
          {saving?'در حال ذخیره…':'ذخیره و اعتبارسنجی'}
        </button>
      </div>
    </div>}
    {loading?<p className="text-sm">در حال دریافت قوانین…</p>:
      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        {visibleRules.map(rule=><article key={rule.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h3 className="min-w-0 break-words font-black">{rule.targetCourseName||courseNames.get(rule.targetCourseId)||rule.targetCourseId}</h3>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              {rule.relationshipType==='PREREQUISITE'?'پیش‌نیاز':rule.relationshipType==='COREQUISITE'?'هم‌نیاز':'شرط اخذ مجدد'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">چارت: {rule.curriculumName||rule.curriculumId}</p>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm leading-7 dark:bg-slate-800">
            <BookOpen className="mt-1 h-4 w-4 shrink-0 text-blue-600"/>
            <p className="min-w-0 break-words">{describeCondition(rule.expression,courseNames)}</p>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={()=>startEdit(rule)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs dark:border-slate-700">
              <Pencil className="h-4 w-4"/> ویرایش
            </button>
            <button type="button" onClick={()=>void remove(rule.id)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-rose-200 px-3 text-xs text-rose-700 dark:border-rose-900">
              <Trash2 className="h-4 w-4"/> حذف
            </button>
          </div>
        </article>)}
        {!visibleRules.length&&<p className="rounded-xl bg-slate-50 p-4 text-sm leading-7 dark:bg-slate-900">قانونی ثبت نشده است؛ هر درس بدون شرط، به همین شکل باقی می‌ماند.</p>}
      </div>}
  </section>;
};
