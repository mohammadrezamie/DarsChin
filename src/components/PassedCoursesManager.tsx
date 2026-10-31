import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, Pencil, Plus, Trash2, X, CheckCircle2 } from 'lucide-react';
import type { AcademicTerm, Course, CourseAttemptStatus, StudentPassedCourse } from '../types';
import { COURSE_ATTEMPT_LABELS, courseAttemptLabel } from '../domain/course-attempt-status';
import { apiRequest } from '../utils/api';

interface TranscriptRow extends StudentPassedCourse { course?: Course }
interface Props { onPassedCoursesChanged?: () => void }
type EditableStatus = CourseAttemptStatus | '';

const STATUS_OPTIONS: CourseAttemptStatus[] = [
  'PASSED', 'FAILED', 'EXCUSED_EXAM_ABSENCE', 'CLASS_ABSENCE_DROP',
];
const noGrade = (status: EditableStatus) =>
  status === 'ABSENT' || status === 'EXCUSED_EXAM_ABSENCE' || status === 'CLASS_ABSENCE_DROP';

export const PassedCoursesManager: React.FC<Props> = ({ onPassedCoursesChanged }) => {
  const [records,setRecords]=useState<TranscriptRow[]>([]);
  const [courses,setCourses]=useState<Course[]>([]);
  const [terms,setTerms]=useState<AcademicTerm[]>([]);
  const [totalUnits,setTotalUnits]=useState(0);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [search,setSearch]=useState('');
  const [termChoice,setTermChoice]=useState('');
  const [manualTerm,setManualTerm]=useState('');
  const [courseId,setCourseId]=useState('');
  const [status,setStatus]=useState<EditableStatus>('');
  const [grade,setGrade]=useState('');
  const [editingId,setEditingId]=useState<string|null>(null);
  const [formOpen,setFormOpen]=useState(false);

  const load=async()=>{
    setLoading(true);
    const [history,catalog,meta]=await Promise.all([
      apiRequest<{passedCourses:TranscriptRow[];totalUnits:number}>('/api/student/passed-courses'),
      apiRequest<Course[]>('/api/academic/courses'),
      apiRequest<{academicTerms:AcademicTerm[]}>('/api/academic/all-meta'),
    ]);
    if (history.success && history.data){
      setRecords(history.data.passedCourses);setTotalUnits(history.data.totalUnits);
    } else setError(history.error||'دریافت کارنامه ممکن نشد.');
    if(catalog.success&&catalog.data)setCourses(catalog.data);
    if(meta.success&&meta.data)setTerms(meta.data.academicTerms||[]);
    setLoading(false);
  };
  useEffect(()=>{void load();},[]);

  const reset=()=>{
    setEditingId(null);setCourseId('');setTermChoice('');setManualTerm('');
    setStatus('');setGrade('');setFormOpen(false);
  };
  const edit=(row:TranscriptRow)=>{
    setEditingId(row.id);setCourseId(row.courseId);
    if(row.termId&&terms.some(t=>t.id===row.termId)){
      setTermChoice(row.termId);setManualTerm('');
    }else{
      setTermChoice(row.termId?'__manual':'');
      setManualTerm(row.termId||'');
    }
    setStatus(row.status||'PASSED');
    setGrade(row.grade==null?'':String(row.grade));
    setError('');setNotice('');setFormOpen(true);
  };
  const save=async(e:React.FormEvent)=>{
    e.preventDefault();
    const termId=(termChoice==='__manual'?manualTerm:termChoice).trim();
    if(!courseId||!status||!termId){
      setError('درس، نیمسال و نتیجهٔ آن را انتخاب کن.');return;
    }
    if(grade.trim()&&!noGrade(status)){
      const n=Number(grade);
      if(!Number.isFinite(n)||n<0||n>20||
          (status==='PASSED'&&n<10)||(status==='FAILED'&&n>=10)){
        setError('نمره با وضعیت انتخاب‌شده سازگار نیست.');return;
      }
    }
    setError('');setNotice('');setSaving(true);
    const result=await apiRequest(
      editingId?'/api/student/passed-courses/'+encodeURIComponent(editingId):'/api/student/passed-courses',
      {method:editingId?'PUT':'POST',body:JSON.stringify({
        courseId,termId,status,
        grade:!noGrade(status)&&grade.trim()?Number(grade):undefined,
      })},
    );
    setSaving(false);
    if(!result.success){setError(result.error||'ثبت نتیجه موفق نبود؛ دوباره تلاش کن.');return;}
    reset();setNotice('نتیجهٔ درس در کارنامه ذخیره شد.');
    await load();onPassedCoursesChanged?.();
  };
  const remove=async(row:TranscriptRow)=>{
    if(!confirm('این سابقه از کارنامهٔ شخصی شما حذف شود؟'))return;
    setError('');setNotice('');setSaving(true);
    const result=await apiRequest('/api/student/passed-courses/'+encodeURIComponent(row.id),{method:'DELETE'});
    setSaving(false);
    if(!result.success){setError(result.error||'حذف این سابقه ممکن نشد.');return;}
    setNotice('سابقهٔ انتخابی حذف شد.');await load();onPassedCoursesChanged?.();
  };
  const termNames=new Map(terms.map(t=>[t.id,t.name]));
  const grouped=useMemo(()=>{
    const buckets=new Map<string,TranscriptRow[]>();
    const query=search.trim().toLocaleLowerCase('fa');
    for(const row of records){
      if(query&&!((row.course?.name||'')+' '+(row.course?.code||'')).toLocaleLowerCase('fa').includes(query))continue;
      const key=row.termId||'__legacy_unknown';
      buckets.set(key,[...(buckets.get(key)||[]),row]);
    }
    return [...buckets].sort(([a],[b])=>{
      const ta=terms.find(t=>t.id===a),tb=terms.find(t=>t.id===b);
      if(ta&&tb)return tb.year-ta.year||tb.termNumber-ta.termNumber;
      return a==='__legacy_unknown'?1:b==='__legacy_unknown'?-1:b.localeCompare(a,'fa');
    });
  },[records,terms,search]);
  const passedCount=new Set(records.filter(row=>row.status==='PASSED'||
    (row.status==null&&(row.grade===undefined||row.grade>=10))).map(row=>row.courseId)).size;

  return <section dir="rtl" aria-label="کارنامهٔ ترم‌به‌ترم من" className="space-y-4">
    <header className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-indigo-950 dark:text-indigo-100">
        <BookOpen className="h-5 w-5" aria-hidden="true"/> کارنامهٔ تحصیلی من
      </h2>
      <p className="mt-2 text-xs leading-7 text-indigo-900 dark:text-indigo-200">
        هر نیمسال را فقط یک‌بار وارد کن و برای تک‌تک درس‌های آن نتیجه را ثبت کن.
        سابقهٔ مردودی یا غیبت پاک نمی‌شود؛ قبولی‌های ترم‌های بعد در کنار آن نمایش داده می‌شوند.
        این کارنامه خوداظهاری دانشجوست و جایگزین کارنامهٔ رسمی دانشگاه نیست.
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
          {passedCount.toLocaleString('fa-IR')} درس پاس‌شده · {totalUnits.toLocaleString('fa-IR')} واحد گذرانده
        </p>
        <button type="button" onClick={()=>{reset();setError('');setFormOpen(true);}}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-indigo-400">
          <Plus className="h-4 w-4"/> ثبت نتیجهٔ درس
        </button>
      </div>
    </header>

    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}

    {formOpen&&<form onSubmit={save} className="space-y-3 rounded-2xl border border-indigo-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-label="فرم ثبت نتیجه در کارنامه">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">{editingId?'اصلاح نتیجهٔ ثبت‌شده':'افزودن درس به کارنامه'}</h3>
        <button type="button" onClick={reset} aria-label="بستن فرم کارنامه"
          className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <X className="h-4 w-4"/></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-semibold">
          <span>نیمسال تحصیلی</span>
          <select required value={termChoice} onChange={e=>setTermChoice(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
            <option value="">نیمسال را انتخاب کن</option>
            {[...terms].sort((a,b)=>b.year-a.year||b.termNumber-a.termNumber)
              .map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            <option value="__manual">نیمسال قدیمی در فهرست نیست</option>
          </select>
        </label>
        {termChoice==='__manual'&&<label className="space-y-1 text-xs font-semibold">
          <span>شناسهٔ نیمسال قدیمی</span>
          <input required maxLength={80} value={manualTerm} onChange={e=>setManualTerm(e.target.value)}
            placeholder="مثلاً ۱۴۰۳-۱ (پاییز)" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"/>
        </label>}
        <label className="space-y-1 text-xs font-semibold">
          <span>درس</span>
          <select required value={courseId} onChange={e=>setCourseId(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
            <option value="">درس را انتخاب کن</option>
            {courses.filter(c=>c.active!==false||c.id===courseId).map(c=>
              <option key={c.id} value={c.id}>{c.name} · {c.code}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold">
          <span>نتیجهٔ این درس</span>
          <select required value={status} onChange={e=>{setStatus(e.target.value as EditableStatus);if(noGrade(e.target.value as EditableStatus))setGrade('');}}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
            <option value="">نتیجه را انتخاب کن</option>
            {STATUS_OPTIONS.map(s=><option key={s} value={s}>{COURSE_ATTEMPT_LABELS[s]}</option>)}
            {status==='ABSENT'&&<option value="ABSENT">{COURSE_ATTEMPT_LABELS.ABSENT}</option>}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold">
          <span>نمره (اختیاری برای قبولی یا مردودی)</span>
          <input type="number" inputMode="decimal" min={0} max={20} step="0.01"
            disabled={noGrade(status)} value={grade} onChange={e=>setGrade(e.target.value)}
            placeholder="مثلاً ۱۵٫۵" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800"/>
        </label>
      </div>
      <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">برای غیبت موجه امتحان یا حذف به‌دلیل غیبت کلاسی، نمره وارد نکن. این وضعیت‌ها واحد پاس‌شده محسوب نمی‌شوند.</p>
      <button type="submit" disabled={saving||!courseId||!status||!termChoice}
        className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white disabled:opacity-50">
        {saving?'در حال ذخیره…':editingId?'ذخیرهٔ اصلاح':'ثبت در کارنامه'}
      </button>
    </form>}

    <label className="block space-y-1 text-xs font-semibold">
      <span>جست‌وجو در کارنامه</span>
      <input value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="نام یا کد درس" className="min-h-11 w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"/>
    </label>
    {loading&&<p role="status" className="text-sm text-slate-500">در حال دریافت کارنامه…</p>}
    {!loading&&grouped.length===0&&<p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">
      هنوز سابقه‌ای ثبت نشده یا نتیجه‌ای مطابق جست‌وجوی تو پیدا نشد.
    </p>}
    {grouped.map(([termId,rows])=><section key={termId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <CalendarDays className="h-4 w-4 text-indigo-600"/>
          {termId==='__legacy_unknown'?'نیمسال نامشخص (سوابق قدیمی)':termNames.get(termId)||termId}
        </h3>
        <span className="text-xs text-slate-500">{rows.length.toLocaleString('fa-IR')} درس</span>
      </header>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map(row=><article key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{row.course?.name||'درس ناشناخته'}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{row.course?.code||row.courseId} · {row.course?.units??'–'} واحد</p>
            <p className={'text-xs font-bold '+(row.status==='PASSED'||row.status==null?'text-emerald-700 dark:text-emerald-400':'text-amber-700 dark:text-amber-400')}>
              {courseAttemptLabel(row.status)} {row.grade!=null?'· نمره '+row.grade.toLocaleString('fa-IR'):''}
            </p>
          </div>
          <div className="flex gap-1">
            <button type="button" disabled={saving} onClick={()=>edit(row)} aria-label={'ویرایش '+(row.course?.name||row.courseId)}
              className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-slate-200 dark:border-slate-700">
              <Pencil className="h-4 w-4"/></button>
            <button type="button" disabled={saving} onClick={()=>void remove(row)} aria-label={'حذف سابقهٔ '+(row.course?.name||row.courseId)}
              className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-rose-200 text-rose-600 dark:border-rose-900">
              <Trash2 className="h-4 w-4"/></button>
          </div>
        </article>)}
      </div>
    </section>)}
    <p className="flex items-start gap-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
      <CheckCircle2 className="h-4 w-4 shrink-0"/> فقط درس‌های پاس‌شده در محاسبهٔ پیش‌نیاز و واحد گذرانده لحاظ می‌شوند؛ غیبت‌ها و حذف توسط استاد قبولی نیستند.
    </p>
  </section>;
};
