import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardList, Download, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { downstreamCourseIds } from '../domain/course-demand';
import type { AcademicRule, Course, Curriculum, DemandResponse, DemandSurvey, StudentAcademicProfile } from '../types';

type Option = { id: string; name: string; active?: boolean; universityId?: string; campusId?: string; majorId?: string; degreeLevelId?: string; entryYearId?: string };
type SurveyStats = { participantCount: number; byCourse: { courseId: string; count: number; threshold: number; meetsSuggestedThreshold: boolean; selfReportedFinalSemester: number }[] };
type CourseAssigned = { courseId: string; active?: boolean; trackId?: string | null; course?: Course };

export const DemandWorkspace: React.FC<{ role: 'student' | 'admin' }> = ({ role }) => {
  const [surveys, setSurveys] = useState<DemandSurvey[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [myResponse, setMyResponse] = useState<DemandResponse | null>(null);
  const [studentNumber, setStudentNumber] = useState('');
  const [graduation, setGraduation] = useState<'YES'|'NO'|'UNKNOWN'>('UNKNOWN');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [terms, setTerms] = useState<Option[]>([]);
  const [entryYears, setEntryYears] = useState<{id:string;year:number}[]>([]);
  const [tracks, setTracks] = useState<Option[]>([]);
  const [assigned, setAssigned] = useState<CourseAssigned[]>([]);
  const [rules, setRules] = useState<AcademicRule[]>([]);
  const [report, setReport] = useState<SurveyStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newCurriculum, setNewCurriculum] = useState('');
  const [newTrack, setNewTrack] = useState('');
  const [newCourseIds, setNewCourseIds] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(15);

  const survey = surveys.find(x=>x.id===selectedId);
  const courseMap = useMemo(()=>new Map(courses.map(c=>[c.id,c])),[courses]);
  const curriculum = curricula.find(c=>c.id===newCurriculum);

  const refresh = async () => {
    setError('');
    const [list, courseResult, meta, chart] = await Promise.all([
      apiRequest<DemandSurvey[]>('/api/demand/surveys'),
      apiRequest<Course[]>('/api/academic/courses'),
      apiRequest<{ academicTerms: Option[]; entryYears: {id:string;year:number}[]; tracks:Option[] }>('/api/academic/all-meta'),
      apiRequest<Curriculum[]>('/api/curriculum'),
    ]);
    if (!list.success) setError(list.error || 'فهرست نیازسنجی بارگذاری نشد.');
    setSurveys(list.data || []);
    setCourses(courseResult.data || []);
    setTerms(meta.data?.academicTerms || []);
    setEntryYears(meta.data?.entryYears || []);
    setTracks(meta.data?.tracks || []);
    setCurricula(chart.data || []);
    setSelectedId(prev=>list.data?.some(s=>s.id===prev)?prev:list.data?.[0]?.id || '');
    if (role === 'student') {
      const p = await apiRequest<{profile:StudentAcademicProfile}>('/api/student/profile');
      if (p.success && p.data?.profile) {
        setProfile(p.data.profile);
        setStudentNumber(p.data.profile.studentNumber || '');
      }
    }
    if (!newTerm && meta.data?.academicTerms?.length) {
      setNewTerm(meta.data.academicTerms.find(t=>t.active)?.id || meta.data.academicTerms[0].id);
    }
    if (!newCurriculum && chart.data?.length) setNewCurriculum(chart.data[0].id);
  };

  useEffect(()=>{ void refresh(); },[role]);

  useEffect(()=>{
    if (!survey) { setMyResponse(null); setReport(null); return; }
    let active=true;
    setSelectedCourses([]);
    setSuccess('');
    if (role==='student') {
      void apiRequest<DemandResponse | null>(`/api/demand/surveys/${survey.id}/response`).then(r=>{
        if(!active) return;
        setMyResponse(r.data || null);
        setSelectedCourses(r.data?.courseIds || []);
        setStudentNumber(r.data?.studentNumber || profile?.studentNumber || '');
        setGraduation(r.data?.anticipatedGraduation || 'UNKNOWN');
      });
    } else {
      void apiRequest<SurveyStats>(`/api/demand/surveys/${survey.id}/report`).then(r=>{
        if(active) setReport(r.data || null);
      });
    }
    return ()=>{active=false};
  },[survey?.id,role,profile?.studentNumber]);

  useEffect(()=>{
    const curriculumId = role==='student' ? survey?.curriculumId : newCurriculum;
    if (!curriculumId) { setAssigned([]); setRules([]); return; }
    let active=true;
    void apiRequest<{courses: CourseAssigned[]; prerequisites:AcademicRule[]; corequisites:AcademicRule[]}>(`/api/curriculum/${curriculumId}/full`).then(r=>{
      if(active){setAssigned(r.data?.courses || []);setRules([...(r.data?.prerequisites || []),...(r.data?.corequisites || [])]);}
    });
    return ()=>{active=false};
  },[role,survey?.curriculumId,newCurriculum]);

  const submit = async () => {
    if(!survey)return;
    setError('');setSuccess('');setBusy(true);
    try {
      const r=await apiRequest<DemandResponse>(`/api/demand/surveys/${survey.id}/response`,{
        method:'PUT',
        body:JSON.stringify({ courseIds:selectedCourses,studentNumber,anticipatedGraduation:graduation }),
      });
      if(!r.success){setError(r.error || 'ذخیره نشد.');return;}
      setMyResponse(r.data || null);
      setSuccess('پاسخ نیازسنجی ذخیره شد. این کار انتخاب واحد یا تضمین تشکیل گروه نیست.');
    } finally{setBusy(false)}
  };

  const createSurvey=async()=>{
    if(!curriculum){setError('ابتدا چارت را انتخاب کن.');return}
    setBusy(true);setError('');setSuccess('');
    const r=await apiRequest<DemandSurvey>('/api/demand/surveys',{
      method:'POST',
      body:JSON.stringify({
        title:newTitle,description:newDescription,targetTermId:newTerm,
        universityId:curriculum.universityId,campusId:curriculum.campusId,
        degreeLevelId:curriculum.degreeLevelId,majorId:curriculum.majorId,
        curriculumId:curriculum.id,entryYearIds:[curriculum.entryYearId],
        trackIds:newTrack?[newTrack]:[],courseIds:newCourseIds,
        recommendedMinimumByCourse:Object.fromEntries(newCourseIds.map(id=>[id,threshold])),
      }),
    });
    setBusy(false);
    if(!r.success){setError(r.error || 'ایجاد نیازسنجی ناموفق بود.');return;}
    setSuccess('پیش‌نویس نیازسنجی ساخته شد. برای مشاهدهٔ دانشجویان آن را باز کن.');
    await refresh(); if(r.data) setSelectedId(r.data.id);
  };

  const updateStatus=async(next:'OPEN'|'CLOSED'|'ARCHIVED')=>{
    if(!survey)return;
    setBusy(true);setError('');setSuccess('');
    const r=await apiRequest<DemandSurvey>(`/api/demand/surveys/${survey.id}/status`,{
      method:'PUT',body:JSON.stringify({status:next}),
    });
    setBusy(false);
    if(!r.success){setError(r.error || 'تغییر وضعیت ناموفق بود.');return;}
    setSuccess('وضعیت نیازسنجی تغییر کرد؛ هیچ گروه درسی منتشر نشده است.');
    await refresh();
  };

  const exportFile=async()=>{
    if(!survey)return;
    setBusy(true);setError('');
    const r=await apiRequest<{csv:string}>(`/api/demand/surveys/${survey.id}/export.csv?format=json`);
    setBusy(false);
    if(!r.success || !r.data?.csv){setError(r.error || 'مجوز صادرات ریز اطلاعات لازم است.');return;}
    const blob=new Blob([r.data.csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`darschin-demand-${survey.id}.csv`;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    setSuccess('گزارش ریز نیازسنجی دریافت شد.');
  };

  const toggle=(id:string)=>(ids:string[])=> ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];
  const yearLabel=(entryId:string)=>entryYears.find(y=>y.id===entryId)?.year ?? entryId;
  const isDemoStudent = role==='student' && typeof window!=='undefined' &&
    window.location.pathname.startsWith('/demo/');
  const switchDemoEntryYear=async(entryYearId:string, selectedTrackId:string='')=>{
    if(!isDemoStudent)return;
    setBusy(true);setError('');setSuccess('');
    const changed=await apiRequest<{profile:StudentAcademicProfile}>('/api/demo/academic-cohort',{
      method:'PUT',body:JSON.stringify({entryYearId,selectedTrackId}),
    });
    setBusy(false);
    if(!changed.success){setError(changed.error||'تغییر ورودی دمو انجام نشد.');return;}
    setProfile(changed.data?.profile || null);
    await refresh();
    setSuccess('ورودی آزمایشی تغییر کرد؛ اکنون فقط نیازسنجی منطبق با چارت همین ورودی نمایش داده می‌شود.');
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-l from-blue-50 to-white p-5 dark:border-blue-900 dark:from-blue-950/50 dark:to-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-950 dark:text-white"><ClipboardList className="h-6 w-6 text-blue-700 dark:text-blue-300"/> نیازسنجی دروس ترم آینده</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {role==='student'?'درس‌های موردنیازت را درخواست کن؛ مشخصات پرونده‌ات دوباره پرسیده نمی‌شود.':'نیازسنجی مستقل برای مدیر گروه؛ آمار تقاضا و ریزگزارش امن دانشجویان.'}
            </p>
          </div>
          <button type="button" onClick={()=>void refresh()} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold dark:border-slate-700"><RefreshCw className="h-4 w-4"/> به‌روزرسانی</button>
        </div>
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          تقاضا به‌معنی ثبت‌نام قطعی نیست. حدنصاب‌ها فقط شاخص برنامه‌ریزی‌اند؛ تشکیل کلاس یا مجازبودن درس نیاز به تأیید آموزشی دارد.
        </p>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{success}</div>}

      {isDemoStudent && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
          <div>
            <p className="text-sm font-black text-indigo-900 dark:text-indigo-100">آزمایش تفکیک ورودی‌ها</p>
            <p className="mt-1 text-xs leading-6 text-indigo-700 dark:text-indigo-200">
              فقط در محیط دمو؛ دو ورودی دارای چارت‌های متفاوت هستند و برای ۱۴۰۳ نیازسنجی مشترک و گرایش‌های جداگانه هم وجود دارد.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="انتخاب ورودی آزمایشی" value={profile?.entryYearId || ''}
              disabled={busy} onChange={e=>void switchDemoEntryYear(e.target.value)}
              className="min-h-11 rounded-xl border border-indigo-300 bg-white px-3 text-sm font-black text-indigo-950 dark:border-indigo-700 dark:bg-slate-900 dark:text-white">
              {entryYears.map(y=><option key={y.id} value={y.id}>ورودی {y.year}</option>)}
            </select>
            {entryYears.find(y=>y.id===profile?.entryYearId)?.year===1403 && (
              <select aria-label="انتخاب گرایش آزمایشی" value={profile?.selectedTrackId || ''}
                disabled={busy} onChange={e=>void switchDemoEntryYear(profile!.entryYearId,e.target.value)}
                className="min-h-11 rounded-xl border border-indigo-300 bg-white px-3 text-sm font-black text-indigo-950 dark:border-indigo-700 dark:bg-slate-900 dark:text-white">
                <option value="">بدون انتخاب رسمی گرایش</option>
                {tracks.filter(t=>t.majorId===profile?.majorId).map(t=>
                  <option key={t.id} value={t.id}>{t.name}</option>
                )}
              </select>
            )}
          </div>
        </section>
      )}

      {role==='admin' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-black">تعریف نیازسنجی جدید</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ابتدا پیش‌نویس بساز، بعد برای دانشجویان باز کن. محدودهٔ چارت تعیین‌کنندهٔ دانشجویان واجد دامنه است.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-bold">عنوان نیازسنجی<input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="نیازسنجی ترم آینده برق" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700"/></label>
            <label className="text-xs font-bold">نیمسال هدف<select value={newTerm} onChange={e=>setNewTerm(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700">{terms.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="text-xs font-bold">چارت اختصاصی ورودی (مثلاً ۱۴۰۲ یا ۱۴۰۳)
              <select value={newCurriculum} onChange={e=>{setNewCurriculum(e.target.value);setNewTrack('');setNewCourseIds([])}} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700">
                {curricula.map(c=><option key={c.id} value={c.id}>ورودی {yearLabel(c.entryYearId)} · {c.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold">محدودهٔ گرایش
              <select value={newTrack} onChange={e=>{setNewTrack(e.target.value);setNewCourseIds([])}} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700">
                <option value="">تمام دانشجویان این ورودی (دروس مشترک)</option>
                {tracks.filter(t=>t.majorId===curriculum?.majorId).map(t=><option key={t.id} value={t.id}>فقط گرایش {t.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold">حدنصاب پیشنهادی (نه مصوبه)<input type="number" min={1} max={500} value={threshold} onChange={e=>setThreshold(Number(e.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700"/></label>
            <label className="text-xs font-bold md:col-span-2">توضیحات<textarea rows={2} value={newDescription} onChange={e=>setNewDescription(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-slate-700"/></label>
          </div>
          <div className="mt-3">
            <p className="mb-2 text-sm font-black">دروس چارت مورد نیازسنجی</p>
            <div className="grid max-h-56 gap-1 overflow-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2 dark:border-slate-700">
              {assigned.filter(c=>c.active!==false && (!c.trackId||c.trackId===newTrack)).map(row=><label key={row.courseId} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"><input type="checkbox" checked={newCourseIds.includes(row.courseId)} onChange={()=>setNewCourseIds(toggle(row.courseId))}/><span>{courseMap.get(row.courseId)?.name || row.course?.name || row.courseId}</span></label>)}
              {!assigned.length && <p className="p-3 text-xs text-amber-700">برای این چارت هنوز درس معتبری تعریف نشده است.</p>}
            </div>
          </div>
          <button type="button" disabled={busy||!newCourseIds.length} onClick={()=>void createSurvey()} className="mt-4 min-h-11 rounded-xl bg-blue-700 px-5 text-sm font-black text-white disabled:opacity-50">ساخت پیش‌نویس نیازسنجی</button>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-black">{role==='admin'?'پایش نیازسنجی‌ها':'نیازسنجی‌های قابل پاسخ'}</h3>
        {!surveys.length && <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">فعلاً نیازسنجی قابل دسترسی وجود ندارد.</p>}
        <div className="mt-3 flex flex-wrap gap-2">{surveys.map(s=><button key={s.id} type="button" onClick={()=>setSelectedId(s.id)} className={`min-h-11 rounded-xl border px-4 text-xs font-bold ${selectedId===s.id?'border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100':'border-slate-200 dark:border-slate-700'}`}>{s.title} · ورودی {yearLabel(s.entryYearIds[0] || curricula.find(c=>c.id===s.curriculumId)?.entryYearId || '')}{s.trackIds.length?' · گرایش '+(tracks.find(t=>t.id===s.trackIds[0])?.name || s.trackIds[0]):' · مشترک'} · {s.status==='OPEN'?'باز':s.status==='DRAFT'?'پیش‌نویس':s.status==='CLOSED'?'بسته':'آرشیو'}</button>)}</div>
      </section>

      {survey && role==='student' && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-black">{survey.title}</h3>
          <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">{survey.description || 'این فرم صرفاً برای برآورد تقاضای ترم هدف است.'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold">شماره دانشجویی (یک‌بار ثبت می‌شود)
              <input inputMode="numeric" value={studentNumber} onChange={e=>setStudentNumber(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700" placeholder="شماره دانشجویی خودت"/>
            </label>
            <label className="text-xs font-bold">آیا احتمال می‌دهی در ترم هدف فارغ‌التحصیل شوی؟
              <select value={graduation} onChange={e=>setGraduation(e.target.value as typeof graduation)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700"><option value="UNKNOWN">هنوز مشخص نیست</option><option value="YES">بله (اظهار من)</option><option value="NO">خیر (اظهار من)</option></select>
            </label>
          </div>
          <p className="rounded-xl bg-slate-50 p-3 text-xs leading-6 dark:bg-slate-800">
            مشخصات از پروفایل: ورودی {profile?.entryYearId ? yearLabel(profile.entryYearId) : 'نامشخص'} · {profile?.isTrackSelected?'گرایش انتخاب شده':'گرایش رسمی انتخاب نشده'}.
            این موارد برای گزارش به مدیر گروه از سمت سرور خوانده می‌شوند.
          </p>
          <h4 className="font-black">کدام درس‌ها را احتمالاً ترم آینده می‌خواهی؟</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {survey.courseIds.map(courseId=>{
              const impacted = downstreamCourseIds(courseId,survey.curriculumId||'',rules).length;
              return <label key={courseId} className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-blue-400 dark:border-slate-700">
                <input type="checkbox" checked={selectedCourses.includes(courseId)} onChange={()=>setSelectedCourses(toggle(courseId))} className="h-4 w-4"/>
                <span className="min-w-0"><span className="block text-sm font-bold">{courseMap.get(courseId)?.name||courseId}</span><span className="text-xs text-slate-500 dark:text-slate-400">{impacted>0?`بر اساس گراف موجود، به ${impacted} درس بعدی وابستگی دارد (پیشنهاد، نه مجوز)`:'بدون وابستگی مستقیم یا غیرمستقیمِ ثبت‌شده'}</span></span>
              </label>;
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-600 dark:text-slate-300">{selectedCourses.length} درس انتخاب شده · {myResponse?'پاسخ قبلی قابل ویرایش است':'اولین پاسخ شما'}</p>
            <button type="button" disabled={busy||survey.status!=='OPEN'} onClick={()=>void submit()} className="min-h-12 rounded-xl bg-blue-700 px-6 text-sm font-black text-white disabled:opacity-50">{busy?'در حال ذخیره…':'ثبت/به‌روزرسانی درخواست‌ها'}</button>
          </div>
        </section>
      )}

      {survey && role==='admin' && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-lg font-black">{survey.title}</h3><p className="text-xs text-slate-500 dark:text-slate-400">وضعیت: {survey.status} · نیمسال: {terms.find(t=>t.id===survey.targetTermId)?.name || survey.targetTermId}</p></div>
            <div className="flex flex-wrap gap-2">
              {(survey.status==='DRAFT'||survey.status==='CLOSED')&&<button disabled={busy} type="button" onClick={()=>void updateStatus('OPEN')} className="min-h-11 rounded-xl bg-blue-700 px-3 text-xs font-bold text-white">بازکردن برای دانشجویان</button>}
              {survey.status==='OPEN'&&<button disabled={busy} type="button" onClick={()=>void updateStatus('CLOSED')} className="min-h-11 rounded-xl border border-amber-400 px-3 text-xs font-bold text-amber-700">بستن نیازسنجی</button>}
              {survey.status==='CLOSED'&&<button disabled={busy} type="button" onClick={()=>void updateStatus('ARCHIVED')} className="min-h-11 rounded-xl border border-slate-300 px-3 text-xs font-bold">آرشیو</button>}
              <button type="button" disabled={busy} onClick={()=>void exportFile()} className="flex min-h-11 items-center gap-2 rounded-xl border border-blue-400 px-3 text-xs font-bold text-blue-800 dark:text-blue-200"><Download className="h-4 w-4"/> CSV ریز تقاضا</button>
            </div>
          </div>
          <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40"><p className="text-xs font-semibold text-blue-800 dark:text-blue-200">تعداد دانشجویان پاسخ‌دهنده</p><strong className="text-3xl font-black">{report?.participantCount ?? '—'}</strong></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report?.byCourse.map(item=>(
              <div key={item.courseId} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <h4 className="text-sm font-black">{courseMap.get(item.courseId)?.name || item.courseId}</h4>
                <div className="mt-3 flex items-end justify-between gap-2"><strong className="text-2xl font-black text-blue-700 dark:text-blue-300">{item.count}</strong><span className="text-xs text-slate-500">حدنصاب پیشنهادی: {item.threshold||'تعریف نشده'}</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full bg-blue-600" style={{width:`${item.threshold>0?Math.min(100,item.count/item.threshold*100):0}%`}}/></div>
                <p className="mt-2 text-xs">{item.meetsSuggestedThreshold?'تقاضا به حدنصاب پیشنهادی رسیده؛ نیازمند تأیید تشکیل کلاس':'در حال جمع‌آوری تقاضا'}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">خوداظهاری ترم آخر: {item.selfReportedFinalSemester}</p>
              </div>
            ))}
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300"><ShieldCheck className="h-4 w-4"/> گزارش ریز فقط برای مدیر دارای مجوز صادر می‌شود؛ این آمار تشکیل کلاس نیست.</p>
        </section>
      )}
    </div>
  );
};
