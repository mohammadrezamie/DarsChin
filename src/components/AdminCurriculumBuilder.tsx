import React, { useState, useEffect, useRef } from 'react';
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
  const [operationError, setOperationError] = useState('');
  const [chartSearch,setChartSearch]=useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishNotice, setPublishNotice] = useState('');
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string | null>(null);
  const detailsRequestRef = useRef(0);
  
  const [curriculumFull, setCurriculumFull] = useState<any>(null); // Details
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  const [addCourseForm, setAddCourseForm] = useState({
    courseId: '', trackId: '', suggestedSemester: 1, classification: 'MAJOR_REQUIRED'
  });
  const [addRuleForm, setAddRuleForm] = useState({
    sourceCourseId: '', relationshipType: 'PREREQUISITE', conditionType: 'AND', ruleGroup: ''
  });

  const matchingCharts=curricula.filter(c=>{
    const major=majors.find(m=>m.id===c.majorId)?.name||'';
    const year=entryYears.find(y=>y.id===c.entryYearId)?.year?.toString()||'';
    const search=chartSearch.trim().toLowerCase();
    return !search||[c.name,c.version,major,year].some(value=>value.toLowerCase().includes(search));
  });
  const selectedChart=curriculumFull?.curriculum as Curriculum|undefined;
  const relevantTracks=tracks.filter(t=>t.active&&t.majorId===selectedChart?.majorId);
  const chartCourseIds=new Set<string>((curriculumFull?.courses||[]).map((item:CurriculumCourse)=>item.courseId));
  const relevantRuleCourses=courses.filter(c=>c.active&&chartCourseIds.has(c.id)&&c.id!==activeCourseId);

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
    const requestId=++detailsRequestRef.current;
    const res=await apiRequest(`/api/curriculum/${encodeURIComponent(id)}/full`);
    if(requestId!==detailsRequestRef.current)return;
    if(res.success)setCurriculumFull(res.data);
    else {setCurriculumFull(null);setOperationError(res.error||'جزئیات چارت دریافت نشد.');}
  };

  useEffect(() => {
    ++detailsRequestRef.current;
    setCurriculumFull(null);
    setOperationError('');
    setPublishNotice('');
    setAddCourseForm({courseId:'',trackId:'',suggestedSemester:1,classification:'MAJOR_REQUIRED'});
    setAddRuleForm({sourceCourseId:'',relationshipType:'PREREQUISITE',conditionType:'AND',ruleGroup:''});
    setActiveCourseId(null);
    if (selectedCurriculumId) void loadCurriculumDetails(selectedCurriculumId);
  }, [selectedCurriculumId]);

  const handlePublishChart = async () => {
    const id=selectedCurriculumId;
    if(!id||!curriculumFull?.courses?.length||publishing)return;
    if(!window.confirm('پس از فعال‌سازی، این چارت برای دانشجویان همین رشته و ورودی در دسترس قرار می‌گیرد. ادامه می‌دهید؟'))return;
    setPublishing(true);setPublishNotice('');
    try {
      const result=await apiRequest<Curriculum>('/api/curriculum/'+encodeURIComponent(id),{
        method:'PUT',body:JSON.stringify({status:'active'}),
      });
      if(!result.success||!result.data){setPublishNotice(result.error||'فعال‌سازی چارت انجام نشد.');return;}
      setCurricula(prev=>prev.map(c=>c.id===id?result.data!:c));
      setCurriculumFull((prev:any)=>prev?.curriculum?.id===id?{...prev,curriculum:result.data}:prev);
      setPublishNotice('چارت با موفقیت فعال شد.');
    } catch {setPublishNotice('ارتباط هنگام انتشار چارت برقرار نشد؛ وضعیت قبلی حفظ شده است.');}
    finally {setPublishing(false);}
  };

  const handleAddCourse = async () => {
    setOperationError('');
    if(!selectedCurriculumId)return;
    if(!addCourseForm.courseId){setOperationError('ابتدا درس را انتخاب کن.');return;}
    if(addCourseForm.trackId&&!relevantTracks.some(t=>t.id===addCourseForm.trackId)){
      setOperationError('گرایش انتخاب‌شده متعلق به رشتهٔ همین چارت نیست.');return;
    }
    if(!Number.isInteger(addCourseForm.suggestedSemester)||addCourseForm.suggestedSemester<1||
       addCourseForm.suggestedSemester>16){
      setOperationError('نیمسال پیشنهادی باید بین ۱ تا ۱۶ باشد.');return;
    }
    const res = await apiRequest(`/api/curriculum/${selectedCurriculumId}/courses`, {
      method: 'POST',
      body: JSON.stringify(addCourseForm)
    });
    if (res.success) {
      loadCurriculumDetails(selectedCurriculumId!);
      setAddCourseForm({ courseId: '', trackId: '', suggestedSemester: 1, classification: 'MAJOR_REQUIRED' });
    } else {
      setOperationError(res.error || 'افزودن درس انجام نشد.');
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
    setOperationError('');
    if(!selectedCurriculumId||!activeCourseId)return;
    if(!relevantRuleCourses.some(c=>c.id===addRuleForm.sourceCourseId)){
      setOperationError('مبدأ پیش‌نیاز یا هم‌نیاز باید درس دیگری از همین چارت باشد.');return;
    }
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
      setOperationError(res.error || 'ثبت قانون انجام نشد.');
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
          <Layers className="w-5 h-5 text-emerald-600" />
          مدیریت ساختار چارت تحصیلی
        </h2>
        
        <div className="mb-6">
          <label htmlFor="chart-filter" className="mb-1 block text-sm font-medium">جستجوی چارت بر اساس رشته، ورودی یا عنوان</label>
          <input id="chart-filter" type="search" value={chartSearch} onChange={e=>setChartSearch(e.target.value)}
            className="darschin-field mb-3 min-h-11" placeholder="مثلاً برق ۱۴۰۳"/>
          <label className="block text-sm font-medium mb-2">چارت‌های فعال و پیش‌نویس:</label>
          <select 
            className="w-full p-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm focus:ring-2 focus:ring-emerald-600"
            value={selectedCurriculumId || ''}
            onChange={(e) => setSelectedCurriculumId(e.target.value)}
          >
            <option value="">-- یک چارت انتخاب کنید --</option>
            {matchingCharts.map(c => (
              <option key={c.id} value={c.id}>{c.name} ·
                {majors.find(m=>m.id===c.majorId)?.name||'رشته نامشخص'} ·
                ورودی {entryYears.find(y=>y.id===c.entryYearId)?.year||'نامشخص'} ·
                {c.status === 'active' ? 'فعال' : c.status === 'draft' ? 'پیش‌نویس' : 'آرشیو'} ({c.version})</option>
            ))}
          </select>
        </div>

        {operationError&&<p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{operationError}</p>}
        {curriculumFull && (
          <>
          <section aria-label="وضعیت انتشار چارت" className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black text-emerald-950 dark:text-emerald-200">
                  {curriculumFull.curriculum?.name} · {curriculumFull.curriculum?.status==='active'?'فعال':
                    curriculumFull.curriculum?.status==='draft'?'پیش‌نویس':'آرشیو'}
                </p>
                <p className="mt-1 text-xs leading-6 text-emerald-900 dark:text-emerald-200">
                  {(curriculumFull.courses?.length||0).toLocaleString('fa-IR')} درس ·
                  {((curriculumFull.prerequisites?.length||0)+(curriculumFull.corequisites?.length||0)).toLocaleString('fa-IR')} رابطهٔ آموزشی
                </p>
              </div>
              {curriculumFull.curriculum?.status==='draft'&&<button type="button"
                disabled={publishing||!curriculumFull.courses?.length} onClick={()=>void handlePublishChart()}
                className="min-h-11 rounded-xl bg-emerald-800 px-4 text-xs font-black text-white disabled:opacity-50">
                {publishing?'در حال فعال‌سازی…':'فعال‌کردن چارت پس از بررسی'}
              </button>}
            </div>
            {curriculumFull.curriculum?.status==='draft'&&!curriculumFull.courses?.length&&
              <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">پیش از فعال‌سازی، درس‌ها را به چارت اضافه کن.</p>}
            {publishNotice&&<p role="status" className="mt-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">{publishNotice}</p>}
          </section>
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
                    {courses.filter(c=>c.active).map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
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
                    <option value="">مشترک بین گرایش‌ها</option>
                    {relevantTracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <label className="flex flex-col gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                    نیمسال پیشنهادی
                    <input type="number" aria-label="نیمسال پیشنهادی درس" min={1} max={16} step={1}
                      value={addCourseForm.suggestedSemester}
                      onChange={e=>setAddCourseForm(prev=>({...prev,suggestedSemester:Number(e.target.value)}))}
                      className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/>
                  </label>
                  <button type="button" disabled={!addCourseForm.courseId}
                    onClick={()=>void handleAddCourse()}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold p-2 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> افزودن
                  </button>
                </div>
              </div>

              <div className="hidden overflow-x-auto md:block">
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
                        className={`border-b dark:border-slate-700/50 cursor-pointer transition-colors ${activeCourseId === cc.courseId ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                        onClick={()=>{
                          setActiveCourseId(cc.courseId);
                          setAddRuleForm(prev=>({...prev,sourceCourseId:''}));
                          setOperationError('');
                        }}
                      >
                        <td className="p-2 font-mono text-xs">{cc.course?.code}</td>
                        <td className="p-2 font-bold">{cc.course?.name}</td>
                        <td className="p-2 text-xs">
                          {cc.classification === 'MAJOR_REQUIRED' && 'رشته‌ای اجباری'}
                          {cc.classification === 'MAJOR_ELECTIVE' && 'رشته‌ای اختیاری'}
                          {cc.classification === 'TRACK_REQUIRED' && 'گرایشی اجباری'}
                          {cc.classification === 'TRACK_ELECTIVE' && 'گرایشی اختیاری'}
                        </td>
                        <td className="p-2 text-xs">
                          {cc.trackId ? relevantTracks.find(t=>t.id===cc.trackId)?.name||'گرایش نامعتبر' : 'مشترک'}
                          <span className="mt-0.5 block text-[11px] text-slate-500">نیمسال {Number(cc.suggestedSemester).toLocaleString('fa-IR')}</span>
                        </td>
                        <td className="p-2 flex items-center gap-2">
                           <button onClick={(e) => { e.stopPropagation(); void handleRemoveCourse(cc.courseId,cc.trackId); }} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-2 md:hidden" aria-label="دروس چارت در موبایل">
                {curriculumFull.courses.map((cc:any)=><article key={cc.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <strong className="text-sm text-slate-950 dark:text-white">{cc.course?.name||'درس نامشخص'}</strong>
                  <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
                    کد {cc.course?.code||'نامشخص'} · نیمسال {Number(cc.suggestedSemester).toLocaleString('fa-IR')} ·
                    {cc.trackId ? relevantTracks.find(t=>t.id===cc.trackId)?.name||'گرایش نامعتبر' : 'مشترک'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={()=>{
                      setActiveCourseId(cc.courseId);
                      setAddRuleForm(prev=>({...prev,sourceCourseId:''}));
                      setOperationError('');
                    }} className="min-h-11 rounded-lg bg-teal-700 px-3 text-xs font-bold text-white">
                      تنظیم پیش‌نیاز و هم‌نیاز
                    </button>
                    <button type="button" aria-label={'حذف درس '+(cc.course?.name||'نامشخص')+' از چارت'}
                      onClick={()=>void handleRemoveCourse(cc.courseId,cc.trackId)}
                      className="min-h-11 rounded-lg border border-rose-300 px-3 text-xs font-bold text-rose-700 dark:border-rose-800 dark:text-rose-300">
                      حذف انتساب
                    </button>
                  </div>
                </article>)}
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
                      <option value="">درس دیگری از همین چارت را انتخاب کن</option>
                      {relevantRuleCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                      <span className="self-center text-[11px] text-slate-500 dark:text-slate-300">فقط درس‌های همین چارت</span>
                    </div>
                    <button type="button"
                      onClick={()=>void handleAddRule()}
                      disabled={!relevantRuleCourses.some(c=>c.id===addRuleForm.sourceCourseId)}
                      className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 text-white rounded-lg text-xs font-bold p-2 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> ثبت قانون
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
};
