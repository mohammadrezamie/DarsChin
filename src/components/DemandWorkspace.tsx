import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, ClipboardList, Download, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { createRequestEpoch } from '../utils/request-epoch';
import { demandDetailKey, isCurrentDemandDetail } from '../utils/demand-detail-context';
import { isDemandResponseForContext } from '../utils/demand-response-context';
import { parseDemandQuestions, validateDemandAnswers, visibleDemandQuestions } from '../domain/demand-form';
import { DemandFormBuilder } from './DemandFormBuilder';
import { DemandCourseReport } from './DemandCourseReport';
import { DemandQuestionFields } from './DemandQuestionFields';
import { downstreamCourseIds } from '../domain/course-demand';
import {
  changeDemandChartScope,demandChartScopeOptions,demandChartsForScope,
  demandCourseThresholds,demandEligibleCourseIds,emptyDemandChartScope,
  manageableDemandCharts,type DemandChartScope,
} from '../domain/demand-chart-workflow';
import type {
  AcademicRule, Course, Curriculum, DemandResponse, DemandSurvey, StudentAcademicProfile,
  DemandFormQuestion,DemandFormAnswers,
} from '../types';

type Option = { id: string; name: string; active?: boolean; universityId?: string; campusId?: string; majorId?: string; degreeLevelId?: string; entryYearId?: string };
type SurveyStats = {
  participantCount:number;
  byCourse:{courseId:string;count:number;threshold:number;meetsSuggestedThreshold:boolean;selfReportedFinalSemester:number}[];
  byQuestion?:{id:string;title:string;kind:string;visibleCount?:number;answeredCount:number;options:{label:string;count:number}[];textAnswersPrivate:boolean}[];
};
type CourseAssigned = { courseId: string; active?: boolean; trackId?: string | null; course?: Course };

// A new account, role, permission set or department scope must remount this
// workspace before the first paint. Effects alone cannot hide private records
// in the render immediately following an identity/role switch.
export const DemandWorkspace: React.FC<{ role: 'student' | 'admin' }> = ({ role }) => {
  const { user } = useAuth();
  const principalKey = JSON.stringify([
    role, user?.id ?? null, user?.roles ?? [],
    user?.permissions ?? [], user?.demandScopes ?? [],
  ]);
  return <DemandWorkspaceSession key={principalKey} role={role} />;
};

const DemandWorkspaceSession: React.FC<{ role: 'student' | 'admin' }> = ({ role }) => {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<DemandSurvey[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [profile, setProfile] = useState<StudentAcademicProfile | null>(null);
  const [myResponse, setMyResponse] = useState<DemandResponse | null>(null);
  const [studentNumber, setStudentNumber] = useState('');
  const [graduation, setGraduation] = useState<'YES'|'NO'|'UNKNOWN'>('UNKNOWN');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [answers,setAnswers]=useState<DemandFormAnswers>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [terms, setTerms] = useState<Option[]>([]);
  const [universities,setUniversities]=useState<Option[]>([]);
  const [campuses,setCampuses]=useState<Option[]>([]);
  const [degreeLevels,setDegreeLevels]=useState<Option[]>([]);
  const [majors,setMajors]=useState<Option[]>([]);
  const [entryYears, setEntryYears] = useState<{id:string;year:number}[]>([]);
  const [tracks, setTracks] = useState<Option[]>([]);
  const [assigned, setAssigned] = useState<CourseAssigned[]>([]);
  const [rules, setRules] = useState<AcademicRule[]>([]);
  const [report, setReport] = useState<SurveyStats | null>(null);
  const [detailState, setDetailState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [detailRevision, setDetailRevision] = useState(0);
  const [settledDetailKey, setSettledDetailKey] = useState<string | null>(null);
  const [loadedChartId, setLoadedChartId] = useState<string | null>(null);
  const [loadedChartRevision, setLoadedChartRevision] = useState<number | null>(null);
  const refreshVersionRef = useRef(createRequestEpoch());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newQuestions,setNewQuestions]=useState<DemandFormQuestion[]>([]);
  const [newStartsAt,setNewStartsAt]=useState('');
  const [newEndsAt,setNewEndsAt]=useState('');
  const [editingSurveyId,setEditingSurveyId]=useState('');
  const [editTitle,setEditTitle]=useState('');
  const [editDescription,setEditDescription]=useState('');
  const [editQuestions,setEditQuestions]=useState<DemandFormQuestion[]>([]);
  const [editStartsAt,setEditStartsAt]=useState('');
  const [editEndsAt,setEditEndsAt]=useState('');
  const [editTerm,setEditTerm]=useState('');
  const [editCourseIds,setEditCourseIds]=useState<string[]>([]);
  const [editMinimums,setEditMinimums]=useState<Record<string,number>>({});
  const [editSearch,setEditSearch]=useState('');
  const [editAssigned,setEditAssigned]=useState<CourseAssigned[]>([]);
  const [editLoadedKey,setEditLoadedKey]=useState('');
  const [editLoadError,setEditLoadError]=useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newCurriculum, setNewCurriculum] = useState('');
  const [newScope,setNewScope]=useState<DemandChartScope>(emptyDemandChartScope);
  const [thresholdByCourse,setThresholdByCourse]=useState<Record<string,number>>({});
  const [courseSearch,setCourseSearch]=useState('');
  const [newTrack, setNewTrack] = useState('');
  const [newCourseIds, setNewCourseIds] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(15);

  const survey = surveys.find(x=>x.id===selectedId);
  const courseMap = useMemo(()=>new Map(courses.map(c=>[c.id,c])),[courses]);
  const editContextKey=editingSurveyId&&survey?.id===editingSurveyId
    ?editingSurveyId+'|'+survey.curriculumId:'';
  const editReady=!!editContextKey&&editLoadedKey===editContextKey;
  const editAvailableIds=editReady&&survey
    ?demandEligibleCourseIds(editAssigned,survey.trackIds[0]||'',courses):[];
  const editMissingIds=editCourseIds.filter(id=>!editAvailableIds.includes(id));
  const managerCharts=manageableDemandCharts(curricula,user);
  const scopeOptions=demandChartScopeOptions(managerCharts,newScope);
  const scopedCharts=demandChartsForScope(managerCharts,newScope);
  const curriculum = scopedCharts.find(c=>c.id===newCurriculum);
  const changeScope=(field:keyof DemandChartScope,value:string)=>{
    setNewScope(previous=>changeDemandChartScope(previous,field,value));
    setNewCurriculum('');setNewTrack('');setNewCourseIds([]);
    setThresholdByCourse({});setCourseSearch('');setSuccess('');setError('');
  };
  const chartContextId = role === 'student' ? survey?.curriculumId : newCurriculum;
  // Rechecking the same chart after a refresh is not equivalent to reusing the
  // previous academic relationships: the revision must also match.
  const chartReady = Boolean(chartContextId && loadedChartId === chartContextId &&
    loadedChartRevision === detailRevision);
  const availableDemandCourseIds=chartReady && curriculum
    ? demandEligibleCourseIds(assigned,newTrack,courses):[];
  const matchingDemandCourseIds=availableDemandCourseIds.filter(id=>{
    const search=courseSearch.trim().toLocaleLowerCase('fa');
    const course=courseMap.get(id);
    return !search||[course?.name||'',course?.code||'',id].some(value=>value.toLocaleLowerCase('fa').includes(search));
  });
  const currentDetailKey = demandDetailKey(role, survey?.id, detailRevision);
  // A save response may arrive after the selected form has changed. The ref
  // updates during render, before effects get a chance to clean up old data.
  const activeDetailKeyRef = useRef(currentDetailKey);
  activeDetailKeyRef.current = currentDetailKey;
  const saveRequestRef = useRef(createRequestEpoch());
  const exportRequestRef = useRef(createRequestEpoch());
  // Protect the render before useEffect clears data from the previously selected survey.
  const detailReady = isCurrentDemandDetail(currentDetailKey, settledDetailKey, detailState);
  const currentDetailError = Boolean(currentDetailKey && settledDetailKey === currentDetailKey && detailState === 'error');
  const visibleSelectedCourses = detailReady ? selectedCourses : [];
  const visibleAnswers = detailReady ? answers : {};
  const requiredAnswers=survey&&detailReady?visibleDemandQuestions(survey.questions||[],visibleAnswers)
    .filter(q=>q.required):[];
  const answeredRequired=requiredAnswers.filter(q=>{
    const a=visibleAnswers[q.id];
    return Array.isArray(a)?a.length>0:typeof a==='string'&&a.trim().length>0;
  }).length;
  const visibleResponse = detailReady ? myResponse : null;
  const visibleReport = detailReady ? report : null;

  const refresh = async (resetDefaults = false) => {
    const requestVersion = refreshVersionRef.current.begin();
    // Immediately invalidate visible answers/reports, even if list loading
    // subsequently fails. Never keep a stale form editable during an outage.
    setDetailRevision(value => value + 1);
    saveRequestRef.current.invalidate();
    exportRequestRef.current.invalidate();
    setError('');
    const [list, courseResult, meta, chart] = await Promise.all([
      apiRequest<DemandSurvey[]>('/api/demand/surveys'),
      apiRequest<Course[]>('/api/academic/courses'),
      apiRequest<{ academicTerms:Option[]; entryYears:{id:string;year:number;active?:boolean}[]; tracks:Option[];
        universities:Option[];campuses:Option[];degreeLevels:Option[];majors:Option[] }>('/api/academic/all-meta'),
      apiRequest<Curriculum[]>('/api/curriculum'),
    ]);
    // An older refresh must never replace a newer request, role, or survey.
    if (!refreshVersionRef.current.isCurrent(requestVersion)) return;
    if (!list.success || !Array.isArray(list.data)) {
      setError(list.error || 'فهرست نیازسنجی بارگذاری نشد؛ برای تلاش دوباره به‌روزرسانی کن.');
      return;
    }
    setSurveys(list.data);
    // Shared form links select only a survey that THIS authenticated student can see.
    const linkedId=role==='student'&&typeof window!=='undefined'
      ?new URLSearchParams(window.location.search).get('survey'):null;
    setSelectedId(prev=>list.data.some(item=>item.id===prev)?prev:
      linkedId&&list.data.some(item=>item.id===linkedId)?linkedId:list.data[0]?.id||'');
    // The revision was already invalidated when refresh began, so the current
    // survey detail must be reloaded even if its ID has not changed.
    if (courseResult.success && Array.isArray(courseResult.data)) setCourses(courseResult.data);
    if (meta.success && meta.data) {
      if (Array.isArray(meta.data.academicTerms)) setTerms(meta.data.academicTerms);
      if (Array.isArray(meta.data.entryYears)) setEntryYears(meta.data.entryYears);
      if (Array.isArray(meta.data.tracks)) setTracks(meta.data.tracks);
      if (Array.isArray(meta.data.universities)) setUniversities(meta.data.universities);
      if (Array.isArray(meta.data.campuses)) setCampuses(meta.data.campuses);
      if (Array.isArray(meta.data.degreeLevels)) setDegreeLevels(meta.data.degreeLevels);
      if (Array.isArray(meta.data.majors)) setMajors(meta.data.majors);
    }
    if (chart.success && Array.isArray(chart.data)) setCurricula(chart.data);
    if (role === 'student') {
      const response = await apiRequest<{profile:StudentAcademicProfile}>('/api/student/profile');
      if (!refreshVersionRef.current.isCurrent(requestVersion)) return;
      if (response.success && response.data?.profile) {
        setProfile(response.data.profile);
        setStudentNumber(previous => previous || response.data?.profile.studentNumber || '');
      }
    }
    if ((resetDefaults || !newTerm) && meta.success && meta.data?.academicTerms?.length) {
      setNewTerm(meta.data.academicTerms.find(t=>t.active)?.id || meta.data.academicTerms[0].id);
    }
    // A survey must never default to the first chart from an unrelated cohort.
    // The manager explicitly selects all five academic dimensions and a chart version.
  };

  useEffect(()=>{
    // The demo can replace the workspace role without a full reload. Treat that
    // boundary like a new session: never render identity fields, draft choices,
    // chart relationships or a prior manager's report under the new role.
    setSurveys([]);
    setSelectedId('');
    setProfile(null);
    setMyResponse(null);
    setReport(null);
    setDetailState('idle');
    setSettledDetailKey(null);
    setSelectedCourses([]);
    setAnswers({});
    setEditingSurveyId('');
    setNewQuestions([]);
    setNewStartsAt('');
    setNewEndsAt('');
    setStudentNumber('');
    setGraduation('UNKNOWN');
    setAssigned([]);
    setRules([]);
    setLoadedChartId(null);
    setLoadedChartRevision(null);
    setNewCourseIds([]);
    setNewCurriculum('');
    setNewScope(emptyDemandChartScope());
    setThresholdByCourse({});
    setCourseSearch('');
    setNewTrack('');
    setError('');
    setSuccess('');
    setBusy(false);
    void refresh(true);
    return () => {
      refreshVersionRef.current.invalidate();
      saveRequestRef.current.invalidate();
      exportRequestRef.current.invalidate();
    };
  },[role]);

  useEffect(()=>{
    if (!survey) {
      setMyResponse(null); setReport(null); setDetailState('idle');
      setSettledDetailKey(null);
      setSelectedCourses([]);
      setAnswers({});
      return;
    }
    const requestedKey = demandDetailKey(role, survey.id, detailRevision);
    let active=true;
    setSettledDetailKey(null);
    setDetailState('loading');
    setMyResponse(null);
    setReport(null);
    setSelectedCourses([]);
    setAnswers({});
    setSuccess('');
    if (role==='student') {
      void apiRequest<DemandResponse | null>(`/api/demand/surveys/${survey.id}/response`).then(result=>{
        if(!active) return;
        if (!result.success || !isDemandResponseForContext(result.data, user?.id, survey.id, survey.courseIds,survey.questions||[])) {
          setError(result.success ? 'پاسخ دریافتی با دانشجو یا این فرم مطابقت ندارد؛ برای حفظ حریم خصوصی امکان ویرایش موقتاً متوقف شد.' : (result.error || 'پاسخ قبلی این نیازسنجی دریافت نشد؛ ذخیره تا بازیابی اطلاعات غیرفعال است.'));
          setSettledDetailKey(requestedKey);
          setDetailState('error');
          return;
        }
        setMyResponse(result.data || null);
        setSelectedCourses(result.data?.courseIds || []);
        setAnswers(result.data?.answers || {});
        setStudentNumber(previous => result.data?.studentNumber || previous);
        setGraduation(result.data?.anticipatedGraduation || 'UNKNOWN');
        setSettledDetailKey(requestedKey);
        setDetailState('ready');
      });
    } else {
      void apiRequest<SurveyStats>(`/api/demand/surveys/${survey.id}/report`).then(result=>{
        if(!active) return;
        if (!result.success || !result.data) {
          setError(result.error || 'گزارش نیازسنجی دریافت نشد؛ دوباره تلاش کنید.');
          setSettledDetailKey(requestedKey);
          setDetailState('error');
          return;
        }
        setReport(result.data);
        setSettledDetailKey(requestedKey);
        setDetailState('ready');
      });
    }
    return ()=>{active=false};
  },[survey?.id,role,detailRevision,user?.id]);

  useEffect(()=>{
    const curriculumId = role==='student' ? survey?.curriculumId : newCurriculum;
    let active=true;
    setAssigned([]);
    setRules([]);
    setLoadedChartId(null);
    setLoadedChartRevision(null);
    if (!curriculumId) return ()=>{active=false};
    void apiRequest<{courses: CourseAssigned[]; prerequisites:AcademicRule[]; corequisites:AcademicRule[]}>(`/api/curriculum/${encodeURIComponent(curriculumId)}/full`).then(result=>{
      if(!active) return;
      if (!result.success || !result.data || !Array.isArray(result.data.courses) ||
          !Array.isArray(result.data.prerequisites) || !Array.isArray(result.data.corequisites)) {
        setError(result.error || 'چارت و روابط درسی دریافت نشدند؛ ابتدا اطلاعات را دوباره بررسی کن.');
        return;
      }
      setAssigned(result.data.courses);
      setRules([...result.data.prerequisites,...result.data.corequisites]);
      setLoadedChartId(curriculumId);
      setLoadedChartRevision(detailRevision);
    });
    return ()=>{active=false};
  },[role,survey?.curriculumId,newCurriculum,detailRevision]);

  const submit = async () => {
    if(!survey || !detailReady || busy || survey.status !== 'OPEN')return;
    const submittedKey = currentDetailKey;
    const submissionEpoch = saveRequestRef.current.begin();
    const stillCurrent = () => activeDetailKeyRef.current === submittedKey &&
      saveRequestRef.current.isCurrent(submissionEpoch);
    const validated=validateDemandAnswers(survey.questions||[],answers);
    if(!validated.ok){setError(validated.error||'سؤال‌ها را بررسی کن.');return;}
    setError('');setSuccess('');setBusy(true);
    try {
      const r=await apiRequest<DemandResponse>(`/api/demand/surveys/${survey.id}/response`,{
        method:'PUT',
        body:JSON.stringify({courseIds:selectedCourses,studentNumber,
          anticipatedGraduation:graduation,answers:validated.answers}),
      });
      if (!stillCurrent()) return;
      if(!r.success){setError(r.error || 'ذخیره نشد.');return;}
      if (!isDemandResponseForContext(r.data, user?.id, survey.id, survey.courseIds,survey.questions||[]) || !r.data) {
        setError('تأیید پاسخ ذخیره‌شده معتبر نبود؛ وضعیت فرم را دوباره بارگذاری کن.');
        return;
      }
      setMyResponse(r.data);
      setSuccess('پاسخ نیازسنجی ذخیره شد. این کار انتخاب واحد یا تضمین تشکیل گروه نیست.');
    } finally{if (stillCurrent()) setBusy(false)}
  };

  const createSurvey=async()=>{
    if(busy)return;
    if(!curriculum||!chartReady||!newTerm) {
      setError('اول حوزهٔ رشته/مقطع/ورودی، چارت و نیمسال هدف را کامل انتخاب کن.');return;
    }
    if(!newCourseIds.length||newCourseIds.some(id=>!availableDemandCourseIds.includes(id))) {
      setError('دروس نیازسنجی باید متعلق به همین چارت و گرایش باشند.');return;
    }
    const parsedQuestions=parseDemandQuestions(newQuestions);
    if(!parsedQuestions.ok){setError(parsedQuestions.error||'سؤال‌های فرم نامعتبرند.');return;}
    const start=newStartsAt?new Date(newStartsAt):null;
    const end=newEndsAt?new Date(newEndsAt):null;
    if((start&&!Number.isFinite(start.getTime()))||(end&&!Number.isFinite(end.getTime()))||
      (start&&end&&end<=start)){
      setError('زمان شروع و پایان پاسخ‌دهی معتبر نیست؛ پایان باید پس از شروع باشد.');return;
    }
    let minimums:Record<string,number>;
    try {minimums=demandCourseThresholds(newCourseIds,thresholdByCourse,threshold);}
    catch (e) {setError(e instanceof Error?e.message:'حدنصاب‌ها معتبر نیستند.');return;}
    const chartId=curriculum.id;
    setBusy(true);setError('');setSuccess('');
    try {
      const r=await apiRequest<DemandSurvey>('/api/demand/surveys',{
        method:'POST',body:JSON.stringify({
          title:newTitle,description:newDescription,targetTermId:newTerm,
          universityId:curriculum.universityId,campusId:curriculum.campusId,
          degreeLevelId:curriculum.degreeLevelId,majorId:curriculum.majorId,
          curriculumId:chartId,entryYearIds:[curriculum.entryYearId],
          trackIds:newTrack?[newTrack]:[],courseIds:newCourseIds,
          recommendedMinimumByCourse:minimums,
          questions:parsedQuestions.questions,
          ...(start?{startsAt:start.toISOString()}:{}),
          ...(end?{endsAt:end.toISOString()}:{}),
        }),
      });
      if(!r.success||!r.data){setError(r.error||'ایجاد نیازسنجی ناموفق بود.');return;}
      setSuccess('پیش‌نویس مستقل این رشته و ورودی ساخته شد؛ برای پاسخ دانشجویان آن را باز کن.');
      await refresh();setSelectedId(r.data.id);
      setNewCourseIds([]);setThresholdByCourse({});setNewQuestions([]);
      setNewStartsAt('');setNewEndsAt('');
    } catch {setError('ساخت نیازسنجی به‌علت مشکل ارتباط ذخیره نشد.');}
    finally {setBusy(false);}
  };

  // Draft editor loads its OWN chart, independently of the create-survey wizard.
  // A response for a previous survey can never populate a newly selected form.
  useEffect(()=>{
    let active=true;
    setEditLoadedKey('');setEditAssigned([]);setEditLoadError('');
    if(!editContextKey||!survey?.curriculumId)return;
    const key=editContextKey;
    void apiRequest<{courses:CourseAssigned[]}>(
      '/api/curriculum/'+encodeURIComponent(survey.curriculumId)+'/full'
    ).then(result=>{
      if(!active)return;
      if(!result.success||!result.data?.courses){
        setEditLoadError(result.error||'بارگذاری درس‌های چارت ویرایش ناموفق بود.');
        return;
      }
      setEditAssigned(result.data.courses);
      setEditLoadedKey(key);
    }).catch(()=>{if(active)setEditLoadError('ارتباط با سرور هنگام دریافت دروس چارت قطع شد.');});
    return ()=>{active=false;};
  },[editContextKey,survey?.curriculumId]);

  const asLocalInput=(value:string|undefined)=>{
    if(!value)return '';
    const date=new Date(value);
    if(!Number.isFinite(date.getTime()))return '';
    return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  };
  const beginDraftEdit=(target:DemandSurvey)=>{
    if(target.status!=='DRAFT')return;
    setEditingSurveyId(target.id);
    setEditTitle(target.title);
    setEditDescription(target.description);
    setEditQuestions(structuredClone(target.questions||[]));
    setEditStartsAt(asLocalInput(target.startsAt));
    setEditEndsAt(asLocalInput(target.endsAt));
    setEditTerm(target.targetTermId);
    setEditCourseIds([...target.courseIds]);
    setEditMinimums({...target.recommendedMinimumByCourse});
    setEditSearch('');
    setEditLoadedKey('');
    setEditLoadError('');
    setError('');setSuccess('');
  };
  const saveDraft=async()=>{
    if(!survey||survey.status!=='DRAFT'||editingSurveyId!==survey.id||busy||!editReady)return;
    if(!editCourseIds.length||editCourseIds.length>100||editMissingIds.length){
      setError('ابتدا فهرست درس‌های همین چارت را تکمیل کن و درس‌های نامعتبر را حذف کن.');return;
    }
    let minimums:Record<string,number>;
    try{minimums=demandCourseThresholds(editCourseIds,editMinimums,0);}
    catch(e){setError(e instanceof Error?e.message:'حدنصاب دروس معتبر نیست.');return;}
    const checked=parseDemandQuestions(editQuestions);
    if(!checked.ok){setError(checked.error||'سؤال‌ها معتبر نیستند.');return;}
    const start=editStartsAt?new Date(editStartsAt):null,end=editEndsAt?new Date(editEndsAt):null;
    if((start&&!Number.isFinite(start.getTime()))||(end&&!Number.isFinite(end.getTime()))||
      (start&&end&&end<=start)){
      setError('زمان‌بندی فرم معتبر نیست.');return;
    }
    setBusy(true);setError('');
    try{
      const result=await apiRequest<DemandSurvey>(
        '/api/demand/surveys/'+encodeURIComponent(survey.id)+'/draft',{
          method:'PUT',body:JSON.stringify({
            title:editTitle.trim(),description:editDescription.trim(),
            targetTermId:editTerm,
            courseIds:editCourseIds,recommendedMinimumByCourse:minimums,
            questions:checked.questions,
            startsAt:start?start.toISOString():null,endsAt:end?end.toISOString():null,
          }),
        });
      if(!result.success||!result.data){setError(result.error||'ویرایش پیش‌نویس ذخیره نشد.');return;}
      setSurveys(previous=>previous.map(item=>item.id===result.data!.id?result.data!:item));
      setEditingSurveyId('');
      setSuccess('تغییرات فرم ذخیره شد. پیش از انتشار، سؤال‌ها را بررسی کن.');
    }catch{setError('ذخیرهٔ تغییرات به‌دلیل قطع ارتباط انجام نشد.');}
    finally{setBusy(false);}
  };
  const shareSurvey=async(target:DemandSurvey)=>{
    if(target.status!=='OPEN'||typeof window==='undefined')return;
    const url=new URL('/dashboard',window.location.origin);
    url.searchParams.set('tab','demand');
    url.searchParams.set('survey',target.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      setSuccess('لینک ورود به همین فرم کپی شد. دانشجو باید با حساب واقعی و ورودی مرتبط وارد شود.');
    } catch {setError('کپی لینک در این مرورگر فعال نیست؛ از HTTPS و مجوز کلیپ‌بورد استفاده کن.');}
  };

  const copySurveyTemplate=(target:DemandSurvey)=>{
    const chart=managerCharts.find(c=>c.id===target.curriculumId);
    if(!chart){setError('چارت این فرم در حوزهٔ مجاز شما نیست.');return;}
    setNewScope({universityId:chart.universityId,campusId:chart.campusId,
      degreeLevelId:chart.degreeLevelId,majorId:chart.majorId,entryYearId:chart.entryYearId});
    setNewCurriculum(chart.id);
    setNewTrack(target.trackIds[0]||'');
    setNewTerm(target.targetTermId);
    setNewTitle(target.title+' (نسخه جدید)');
    setNewDescription(target.description);
    setNewQuestions(structuredClone(target.questions||[]));
    setNewCourseIds([...target.courseIds]);
    setThresholdByCourse({...target.recommendedMinimumByCourse});
    setNewStartsAt('');
    setNewEndsAt('');
    setSuccess('الگوی فرم به سازنده منتقل شد؛ چارت و دروس را پیش از ثبت دوباره بررسی کن. هیچ پاسخی کپی نشده است.');
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
    if(!survey || !detailReady || busy)return;
    // CSV is student-identifying data: NEVER download an old export after a
    // different form, permission scope or account replaces this workspace.
    const exportedKey=currentDetailKey;
    const exportEpoch=exportRequestRef.current.begin();
    const stillCurrent=()=>activeDetailKeyRef.current===exportedKey &&
      exportRequestRef.current.isCurrent(exportEpoch);
    setBusy(true);setError('');setSuccess('');
    try {
      const r=await apiRequest<{csv:string}>(`/api/demand/surveys/${survey.id}/export.csv?format=json`);
      if(!stillCurrent())return;
      if(!r.success || typeof r.data?.csv!=='string' || !r.data.csv) {
        setError(r.error || 'مجوز صادرات ریز اطلاعات لازم است.');return;
      }
      const blob=new Blob([r.data.csv],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      try {
        const a=document.createElement('a');
        a.href=url;a.download=`darschin-demand-${survey.id}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setSuccess('گزارش ریز نیازسنجی دریافت شد.');
      } finally {
        // Safari may consume the temporary Blob after the click event returns.
        window.setTimeout(()=>URL.revokeObjectURL(url),2000);
      }
    } finally {
      if(stillCurrent())setBusy(false);
    }
  };

  const exportSummary=async(section:'summary'|'questions'='summary')=>{
    if(!survey||!detailReady||busy)return;
    const expectedKey=currentDetailKey;
    const epoch=exportRequestRef.current.begin();
    const isCurrent=()=>activeDetailKeyRef.current===expectedKey&&
      exportRequestRef.current.isCurrent(epoch);
    setBusy(true);setError('');setSuccess('');
    try {
      const result=await apiRequest<{csv:string}>(
        '/api/demand/surveys/'+encodeURIComponent(survey.id)+'/'+section+'.csv?format=json');
      if(!isCurrent())return;
      if(!result.success||typeof result.data?.csv!=='string'){
        setError(result.error||'گزارش تجمیعی دریافت نشد.');return;
      }
      const blob=new Blob([result.data.csv],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      try {
        const link=document.createElement('a');
        link.href=url;link.download='darschin-demand-'+section+'-'+survey.id+'.csv';
        document.body.appendChild(link);link.click();link.remove();
        setSuccess('خروجی تجمیعی بدون اطلاعات شناسایی دانشجویان دریافت شد.');
      } finally {window.setTimeout(()=>URL.revokeObjectURL(url),2000);}
    } catch {if(isCurrent())setError('دریافت خروجی تجمیعی با مشکل ارتباط مواجه شد.');}
    finally {if(isCurrent())setBusy(false);}
  };

  const exportPrivateAnswers=async()=>{
    if(!survey||!detailReady||busy)return;
    const requestedKey=currentDetailKey;
    const ticket=exportRequestRef.current.begin();
    const stillCurrent=()=>activeDetailKeyRef.current===requestedKey&&
      exportRequestRef.current.isCurrent(ticket);
    setBusy(true);setError('');setSuccess('');
    try {
      const r=await apiRequest<{csv:string}>('/api/demand/surveys/'+
        encodeURIComponent(survey.id)+'/answers.csv?format=json');
      if(!stillCurrent())return;
      if(!r.success||typeof r.data?.csv!=='string'){
        setError(r.error||'برای دریافت متن پاسخ‌ها مجوز ویژه لازم است.');return;
      }
      const blob=new Blob([r.data.csv],{type:'text/csv;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      try {
        const a=document.createElement('a');a.href=url;
        a.download='darschin-private-answers-'+survey.id+'.csv';
        document.body.appendChild(a);a.click();a.remove();
        setSuccess('خروجی خصوصی پاسخ‌ها دریافت شد؛ از اطلاعات دانشجویان محافظت کن.');
      } finally {window.setTimeout(()=>URL.revokeObjectURL(url),2000);}
    } catch {if(stillCurrent())setError('دریافت خروجی خصوصی ناموفق بود.');}
    finally {if(stillCurrent())setBusy(false);}
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
    <div className="darschin-page space-y-5" dir="rtl">
      <div className="rounded-2xl border border-teal-200 bg-gradient-to-l from-teal-50 to-white p-5 dark:border-teal-950 dark:from-teal-950/50 dark:to-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-950 dark:text-white"><ClipboardList className="h-6 w-6 text-teal-800 dark:text-teal-300"/> نیازسنجی دروس ترم آینده</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {role==='student'?'درس‌های موردنیازت را درخواست کن؛ مشخصات پرونده‌ات دوباره پرسیده نمی‌شود.':'نیازسنجی مستقل برای مدیر گروه؛ آمار تقاضا و ریزگزارش امن دانشجویان.'}
            </p>
          </div>
          <button type="button" disabled={busy} onClick={()=>void refresh()} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold dark:border-slate-700"><RefreshCw className="h-4 w-4"/> به‌روزرسانی</button>
        </div>
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          تقاضا به‌معنی ثبت‌نام قطعی نیست. حدنصاب‌ها فقط شاخص برنامه‌ریزی‌اند؛ تشکیل کلاس یا مجازبودن درس نیاز به تأیید آموزشی دارد.
        </p>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{success}</div>}
      {survey && !detailReady && !currentDetailError && <p role="status" aria-live="polite" className="rounded-xl bg-teal-50 p-3 text-xs font-bold text-teal-950 dark:bg-teal-950/40 dark:text-teal-200">در حال دریافت پاسخ و گزارش همین نیازسنجی…</p>}
      {survey && currentDetailError && <button type="button" onClick={()=>setDetailRevision(value=>value+1)} className="min-h-11 rounded-xl border border-amber-300 px-4 text-xs font-bold text-amber-900 dark:text-amber-200">تلاش دوباره برای دریافت اطلاعات همین فرم</button>}

      {isDemoStudent && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-950 dark:bg-emerald-950/40">
          <div>
            <p className="text-sm font-black text-emerald-950 dark:text-emerald-100">آزمایش تفکیک ورودی‌ها</p>
            <p className="mt-1 text-xs leading-6 text-emerald-800 dark:text-emerald-200">
              فقط در محیط دمو؛ دو ورودی دارای چارت‌های متفاوت هستند و برای ۱۴۰۳ نیازسنجی مشترک و گرایش‌های جداگانه هم وجود دارد.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="انتخاب ورودی آزمایشی" value={profile?.entryYearId || ''}
              disabled={busy} onChange={e=>void switchDemoEntryYear(e.target.value)}
              className="min-h-11 rounded-xl border border-emerald-300 bg-white px-3 text-sm font-black text-emerald-950 dark:border-emerald-800 dark:bg-slate-900 dark:text-white">
              {entryYears.map(y=><option key={y.id} value={y.id}>ورودی {y.year}</option>)}
            </select>
            {entryYears.find(y=>y.id===profile?.entryYearId)?.year===1403 && (
              <select aria-label="انتخاب گرایش آزمایشی" value={profile?.selectedTrackId || ''}
                disabled={busy} onChange={e=>void switchDemoEntryYear(profile!.entryYearId,e.target.value)}
                className="min-h-11 rounded-xl border border-emerald-300 bg-white px-3 text-sm font-black text-emerald-950 dark:border-emerald-800 dark:bg-slate-900 dark:text-white">
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
        <section aria-label="تعریف نیازسنجی برای رشته و ورودی مستقل"
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-black">تعریف نیازسنجی جدید برای چارت مشخص</h3>
          <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
            ابتدا رشته، مقطع و ورودی را تعیین کن. هر نیازسنجی فقط به یک چارت و یک ورودی وصل می‌شود؛
            هیچ چارت دیگری خودکار انتخاب نمی‌شود.
          </p>
          <div className="mt-4 space-y-4">
            <fieldset className="rounded-2xl border border-teal-200 p-3 dark:border-teal-900">
              <legend className="px-2 text-sm font-black text-teal-900 dark:text-teal-200">
                ۱. حوزهٔ تحصیلی
              </legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {([
                  ['universityId','دانشگاه',scopeOptions.universityIds,universities,'دانشگاه را انتخاب کن'],
                  ['campusId','واحد دانشگاهی',scopeOptions.campusIds,campuses,'ابتدا دانشگاه را انتخاب کن'],
                  ['degreeLevelId','مقطع',scopeOptions.degreeLevelIds,degreeLevels,'ابتدا واحد دانشگاهی را انتخاب کن'],
                  ['majorId','رشته',scopeOptions.majorIds,majors,'ابتدا مقطع را انتخاب کن'],
                  ['entryYearId','سال ورود',scopeOptions.entryYearIds,entryYears,'ابتدا رشته را انتخاب کن'],
                ] as const).map(([field,label,ids,entities,placeholder])=>
                  <label key={field} className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {label}
                    <select value={newScope[field]} disabled={busy || (field!=='universityId'&&!ids.length)}
                      onChange={e=>changeScope(field,e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-2 text-xs dark:border-slate-700">
                      <option value="">{placeholder}</option>
                      {ids.map(id=>{
                        const row=entities.find(item=>item.id===id) as (Option & {year?:number})|undefined;
                        return <option value={id} key={id}>
                          {typeof row?.year==='number'
                            ? 'ورودی '+row.year.toLocaleString('fa-IR')
                            : row?.name||'بدون عنوان'}
                        </option>;
                      })}
                    </select>
                  </label>)}
              </div>
              {!managerCharts.length&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                چارت قابل دسترسی برای این مدیر وجود ندارد. مدیر کل باید چارت رشته، مقطع و ورودی را
                تعریف/فعال کند و مجوز مدیریت نیازسنجی این رشته را بدهد.
              </p>}
            </fieldset>
            <fieldset className="rounded-2xl border border-teal-200 p-3 dark:border-teal-900">
              <legend className="px-2 text-sm font-black text-teal-900 dark:text-teal-200">
                ۲. انتخاب نسخهٔ چارت و گرایش
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">چارت همین رشته، مقطع و ورودی
                  <select value={newCurriculum} disabled={busy||!scopedCharts.length}
                    onChange={e=>{setNewCurriculum(e.target.value);setNewTrack('');setNewCourseIds([]);setThresholdByCourse({});}}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-2 text-xs dark:border-slate-700">
                    <option value="">نسخهٔ چارت را صریحاً انتخاب کن</option>
                    {scopedCharts.map(chart=><option key={chart.id} value={chart.id}>
                      {chart.name} · نسخه {chart.version} · {chart.status==='active'?'فعال':'پیش‌نویس'}
                    </option>)}
                  </select>
                </label>
                <label className="text-xs font-bold">محدودهٔ گرایش
                  <select value={newTrack} disabled={busy||!curriculum}
                    onChange={e=>{setNewTrack(e.target.value);setNewCourseIds([]);setThresholdByCourse({});}}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-2 text-xs dark:border-slate-700">
                    <option value="">تمام ورودی (فقط دروس مشترک)</option>
                    {tracks.filter(t=>t.active!==false&&t.majorId===curriculum?.majorId).map(t=>
                      <option key={t.id} value={t.id}>فقط گرایش {t.name}</option>)}
                  </select>
                </label>
              </div>
              {scopedCharts.length===0 && newScope.entryYearId&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                برای این رشته و ورودی چارت قابل استفاده پیدا نشد؛ آن را در «چارت‌های تحصیلی» تعریف
                و منتشر کن، سپس نیازسنجی را بساز.
              </p>}
              {curriculum&&<p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                چارت انتخابی: {curriculum.name} · ورودی {yearLabel(curriculum.entryYearId)} ·
                {curriculum.status==='active'?'فعال':'پیش‌نویس'} ·
                {chartReady?'دروس چارت بارگذاری شدند':'در حال بررسی دروس همین چارت'}
              </p>}
            </fieldset>
            <fieldset className="rounded-2xl border border-teal-200 p-3 dark:border-teal-900">
              <legend className="px-2 text-sm font-black text-teal-900 dark:text-teal-200">
                ۳. مشخصات نیازسنجی و نیمسال هدف
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">عنوان نیازسنجی
                  <input maxLength={160} value={newTitle} disabled={busy}
                    onChange={e=>setNewTitle(e.target.value)} placeholder="مثلاً نیازسنجی برق ورودی ۱۴۰۴"
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700"/>
                </label>
                <label className="text-xs font-bold">نیمسال هدف
                  <select value={newTerm} disabled={busy} onChange={e=>setNewTerm(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700">
                    <option value="">نیمسال هدف را انتخاب کن</option>
                    {terms.filter(t=>t.active!==false).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold">حدنصاب پیشنهادی پیش‌فرض برای هر درس
                  <input type="number" min={0} max={500} step={1} value={threshold} disabled={busy}
                    onChange={e=>setThreshold(Number(e.target.value))}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700"/>
                </label>
                <label className="text-xs font-bold sm:col-span-2">توضیحات و اطلاعیه
                  <textarea maxLength={1000} rows={2} value={newDescription} disabled={busy}
                    onChange={e=>setNewDescription(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-slate-700"/>
                </label>
                <label className="text-xs font-bold">شروع پاسخ‌دهی (اختیاری)
                  <input type="datetime-local" value={newStartsAt} disabled={busy}
                    onChange={e=>setNewStartsAt(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700"/>
                </label>
                <label className="text-xs font-bold">پایان پاسخ‌دهی (اختیاری)
                  <input type="datetime-local" value={newEndsAt} disabled={busy}
                    onChange={e=>setNewEndsAt(e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700"/>
                </label>
              </div>
            </fieldset>
            <fieldset className="rounded-2xl border border-teal-200 p-3 dark:border-teal-900">
              <legend className="px-2 text-sm font-black text-teal-900 dark:text-teal-200">
                ۴. دروس مورد نیازسنجی و حدنصاب اختصاصی
              </legend>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {newCourseIds.length.toLocaleString('fa-IR')} از {availableDemandCourseIds.length.toLocaleString('fa-IR')} درس
                  · فقط دروس همین چارت و گرایش
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" disabled={busy||!chartReady||!availableDemandCourseIds.length}
                    onClick={()=>setNewCourseIds(availableDemandCourseIds.slice(0,100))}
                    className="min-h-10 rounded-lg border border-teal-300 px-2.5 text-xs font-bold disabled:opacity-40">
                    انتخاب همه (تا ۱۰۰ درس)
                  </button>
                  <button type="button" disabled={busy||!newCourseIds.length} onClick={()=>setNewCourseIds([])}
                    className="min-h-10 rounded-lg border border-slate-300 px-2.5 text-xs font-bold disabled:opacity-40">
                    پاک‌کردن انتخاب
                  </button>
                </div>
              </div>
              <input type="search" aria-label="جستجوی درس‌های چارت"
                value={courseSearch} disabled={busy||!chartReady} onChange={e=>setCourseSearch(e.target.value)}
                className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 text-xs dark:border-slate-700"
                placeholder="جستجوی نام یا کد درس در همین چارت"/>
              <div className="mt-2 grid max-h-96 gap-2 overflow-auto sm:grid-cols-2">
                {matchingDemandCourseIds.map(courseId=><div key={courseId}
                  className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  <label className="flex min-h-11 items-center gap-2 text-xs">
                    <input type="checkbox" disabled={busy} checked={newCourseIds.includes(courseId)}
                      onChange={()=>setNewCourseIds(toggle(courseId))}/>
                    <span className="min-w-0 font-bold">
                      {courseMap.get(courseId)?.name||courseId}
                      <span className="block text-[11px] font-normal text-slate-500">{courseMap.get(courseId)?.code||''}</span>
                    </span>
                  </label>
                  {newCourseIds.includes(courseId)&&<label className="mt-1 block text-[11px] font-bold">
                    حدنصاب مخصوص همین درس (صفر یعنی بدون حدنصاب)
                    <input type="number" min={0} max={500} step={1}
                      value={thresholdByCourse[courseId]??threshold} disabled={busy}
                      onChange={e=>setThresholdByCourse(previous=>({...previous,[courseId]:Number(e.target.value)}))}
                      className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-transparent px-2 text-xs dark:border-slate-700"/>
                  </label>}
                </div>)}
                {chartReady&&!availableDemandCourseIds.length&&
                  <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    این چارت/گرایش درس فعال قابل نیازسنجی ندارد؛ ابتدا دروس چارت را تعریف کن.
                  </p>}
              </div>
            </fieldset>
            <DemandFormBuilder value={newQuestions} onChange={setNewQuestions} disabled={busy}/>
          </div>
          <button type="button"
            disabled={busy||!curriculum||!chartReady||!newTerm||newTitle.trim().length<5||
              !newCourseIds.length||newCourseIds.length>100||
              newCourseIds.some(id=>!availableDemandCourseIds.includes(id))||
              !parseDemandQuestions(newQuestions).ok}
            onClick={()=>void createSurvey()}
            className="mt-4 min-h-12 w-full rounded-xl bg-teal-800 px-5 text-sm font-black text-white disabled:opacity-40 sm:w-auto">
            {busy?'در حال ثبت پیش‌نویس…':'ساخت نیازسنجی مستقل برای همین ورودی'}
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-black">{role==='admin'?'پایش نیازسنجی‌ها':'نیازسنجی‌های قابل پاسخ'}</h3>
        {!surveys.length && <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-800">فعلاً نیازسنجی قابل دسترسی وجود ندارد.</p>}
        <div className="mt-3 flex flex-wrap gap-2">{surveys.map(s=><button key={s.id} type="button" disabled={busy} onClick={()=>setSelectedId(s.id)} className={`min-h-11 rounded-xl border px-4 text-xs font-bold ${selectedId===s.id?'border-teal-700 bg-teal-50 text-teal-950 dark:bg-teal-950 dark:text-teal-100':'border-slate-200 dark:border-slate-700'}`}>{s.title} · ورودی {yearLabel(s.entryYearIds[0] || curricula.find(c=>c.id===s.curriculumId)?.entryYearId || '')}{s.trackIds.length?' · گرایش '+(tracks.find(t=>t.id===s.trackIds[0])?.name || s.trackIds[0]):' · مشترک'} · {s.status==='OPEN'?'باز':s.status==='DRAFT'?'پیش‌نویس':s.status==='CLOSED'?'بسته':'آرشیو'}</button>)}</div>
      </section>

      {survey && role==='student' && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-black">{survey.title}</h3>
          <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">{survey.description || 'این فرم صرفاً برای برآورد تقاضای ترم هدف است.'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold">شماره دانشجویی (یک‌بار ثبت می‌شود)
              <input inputMode="numeric" value={detailReady ? studentNumber : ''} disabled={busy || !detailReady} onChange={e=>setStudentNumber(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700" placeholder="شماره دانشجویی خودت"/>
            </label>
            <label className="text-xs font-bold">آیا احتمال می‌دهی در ترم هدف فارغ‌التحصیل شوی؟
              <select value={detailReady ? graduation : 'UNKNOWN'} disabled={busy || !detailReady} onChange={e=>setGraduation(e.target.value as typeof graduation)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700"><option value="UNKNOWN">هنوز مشخص نیست</option><option value="YES">بله (اظهار من)</option><option value="NO">خیر (اظهار من)</option></select>
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
              return <label key={courseId} className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-teal-400 dark:border-slate-700">
                <input type="checkbox" checked={visibleSelectedCourses.includes(courseId)} disabled={busy||!detailReady||survey.status!=='OPEN'} onChange={()=>setSelectedCourses(toggle(courseId))} className="h-4 w-4"/>
                <span className="min-w-0"><span className="block text-sm font-bold">{courseMap.get(courseId)?.name||courseId}</span><span className="text-xs text-slate-500 dark:text-slate-400">{!chartReady?'روابط درسی هنوز بارگذاری نشده‌اند':impacted>0?`بر اساس گراف موجود، به ${impacted} درس بعدی وابستگی دارد (پیشنهاد، نه مجوز)`:'بدون وابستگی مستقیم یا غیرمستقیمِ ثبت‌شده'}</span></span>
              </label>;
            })}
          </div>
          {!!survey.questions?.length&&<DemandQuestionFields
            questions={survey.questions} answers={visibleAnswers}
            disabled={busy||!detailReady||survey.status!=='OPEN'}
            onChange={setAnswers}/>}
          {!!survey.questions?.length&&detailReady&&<div role="status"
            className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs font-bold text-teal-900 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-200">
            تکمیل سؤال‌های اجباری قابل‌مشاهده: {answeredRequired.toLocaleString('fa-IR')}
            {' از '}{requiredAnswers.length.toLocaleString('fa-IR')}
            {requiredAnswers.length>0&&<div className="mt-2 h-2 overflow-hidden rounded-full bg-white dark:bg-slate-800">
              <div className="h-full bg-teal-700 transition-all" style={{
                width:((answeredRequired/requiredAnswers.length)*100)+'%',
              }}/>
            </div>}
          </div>}
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-600 dark:text-slate-300">{visibleSelectedCourses.length} درس انتخاب شده · {visibleResponse?'پاسخ قبلی قابل ویرایش است':'اولین پاسخ شما'}</p>
            <button type="button" disabled={busy||!detailReady||survey.status!=='OPEN'} onClick={()=>void submit()} className="min-h-12 rounded-xl bg-teal-800 px-6 text-sm font-black text-white disabled:opacity-50">{busy?'در حال ذخیره…':'ثبت/به‌روزرسانی درخواست‌ها'}</button>
          </div>
        </section>
      )}

      {survey && role==='admin' && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="text-lg font-black">{survey.title}</h3><p className="text-xs text-slate-500 dark:text-slate-400">وضعیت: {survey.status} · نیمسال: {terms.find(t=>t.id===survey.targetTermId)?.name || survey.targetTermId}</p></div>
            <div className="flex flex-wrap gap-2">
              {(survey.status==='DRAFT'||survey.status==='CLOSED')&&<button disabled={busy} type="button" onClick={()=>void updateStatus('OPEN')} className="min-h-11 rounded-xl bg-teal-800 px-3 text-xs font-bold text-white">بازکردن برای دانشجویان</button>}
              {survey.status==='DRAFT'&&<button disabled={busy} type="button"
                onClick={()=>beginDraftEdit(survey)}
                className="min-h-11 rounded-xl border border-violet-400 px-3 text-xs font-bold text-violet-900 dark:text-violet-200">
                ویرایش سؤال‌ها و زمان‌بندی پیش‌نویس
              </button>}
              {survey.status==='OPEN'&&<button disabled={busy} type="button"
                onClick={()=>void shareSurvey(survey)}
                className="min-h-11 rounded-xl border border-teal-300 px-3 text-xs font-bold text-teal-900 dark:text-teal-200">
                کپی لینک امن فرم برای دانشجویان
              </button>}
              <button disabled={busy} type="button" onClick={()=>copySurveyTemplate(survey)}
                className="min-h-11 rounded-xl border border-indigo-300 px-3 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                استفاده از این فرم به‌عنوان الگو
              </button>
              {survey.status==='OPEN'&&<button disabled={busy} type="button" onClick={()=>void updateStatus('CLOSED')} className="min-h-11 rounded-xl border border-amber-400 px-3 text-xs font-bold text-amber-700">بستن نیازسنجی</button>}
              {survey.status==='CLOSED'&&<button disabled={busy} type="button" onClick={()=>void updateStatus('ARCHIVED')} className="min-h-11 rounded-xl border border-slate-300 px-3 text-xs font-bold">آرشیو</button>}
              <button type="button" disabled={busy||!detailReady} onClick={()=>void exportSummary()}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-teal-400 px-3 text-xs font-bold text-teal-900 dark:text-teal-200">
                <Download className="h-4 w-4"/> گزارش تجمیعی بدون نام دانشجو
              </button>
              {(user?.permissions?.includes('demand.export')||user?.roles?.includes('super-admin'))&&
                <button type="button" disabled={busy||!detailReady} onClick={()=>void exportFile()}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-400 px-3 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <Download className="h-4 w-4"/> CSV با مشخصات دانشجویان (مجوز ویژه)
                </button>}
              {(user?.permissions?.includes('demand.export')||user?.roles?.includes('super-admin'))&&
                !!survey.questions?.length&&<button type="button" disabled={busy||!detailReady}
                  onClick={()=>void exportPrivateAnswers()}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-rose-300 px-3 text-xs font-bold text-rose-800 dark:text-rose-200">
                  <Download className="h-4 w-4"/> خروجی خصوصی پاسخ سؤال‌ها
                </button>}
            </div>
          </div>
          {survey.status==='DRAFT'&&editingSurveyId===survey.id&&<section
            aria-label="ویرایش امن فرم پیش‌نویس"
            className="space-y-3 rounded-2xl border border-violet-300 bg-violet-50/30 p-3 dark:border-violet-800 dark:bg-violet-950/20">
            <h4 className="text-sm font-black">ویرایش پیش‌نویس فرم</h4>
            <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
              تمام اجزای پیش‌نویس، از جمله نیمسال هدف، دروس، حدنصاب‌ها، زمان‌بندی و سؤال‌ها قابل اصلاح‌اند.
              رشته و ورودی همین فرم ثابت می‌مانند تا تقاضای ورودی‌ها مخلوط نشود.
            </p>
            <label className="block text-xs font-bold">عنوان فرم
              <input maxLength={160} value={editTitle} disabled={busy}
                onChange={e=>setEditTitle(e.target.value)} className="darschin-field mt-1 min-h-11"/>
            </label>
            <label className="block text-xs font-bold">راهنمای فرم
              <textarea rows={2} maxLength={1000} value={editDescription} disabled={busy}
                onChange={e=>setEditDescription(e.target.value)} className="darschin-field mt-1"/>
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-bold">شروع پاسخ‌دهی
                <input type="datetime-local" value={editStartsAt} disabled={busy}
                  onChange={e=>setEditStartsAt(e.target.value)} className="darschin-field mt-1 min-h-11"/>
              </label>
              <label className="text-xs font-bold">پایان پاسخ‌دهی
                <input type="datetime-local" value={editEndsAt} disabled={busy}
                  onChange={e=>setEditEndsAt(e.target.value)} className="darschin-field mt-1 min-h-11"/>
              </label>
            </div>
            <section className="space-y-3 rounded-2xl border border-teal-200 bg-white p-3 dark:border-teal-900 dark:bg-slate-900"
              aria-label="ویرایش دروس و حدنصاب پیش‌نویس">
              <h5 className="text-sm font-black">دروس نیازسنجی و حدنصاب پیشنهادی</h5>
              <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
                چارت همین ورودی مبناست؛ افزودن، حذف و تغییر حدنصاب فقط پیش از انتشار ذخیره می‌شود.
              </p>
              <label className="block text-xs font-bold">نیمسال مورد نیازسنجی
                <select value={editTerm} disabled={busy} onChange={e=>setEditTerm(e.target.value)}
                  className="darschin-field mt-1 min-h-11 w-full">
                  {terms.filter(t=>t.active!==false||t.id===editTerm).map(term=>
                    <option key={term.id} value={term.id}>{term.name}</option>)}
                </select>
              </label>
              {!editReady&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                {editLoadError||'در حال دریافت فهرست دروس همین چارت…'}
              </p>}
              {editReady&&<>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold">
                    {editCourseIds.length.toLocaleString('fa-IR')} درس انتخاب‌شده
                  </span>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy||!editAvailableIds.length}
                      onClick={()=>setEditCourseIds(editAvailableIds.slice(0,100))}
                      className="min-h-10 rounded-lg border border-teal-300 px-3 text-xs font-bold disabled:opacity-40">
                      انتخاب همه
                    </button>
                    <button type="button" disabled={busy||!editCourseIds.length}
                      onClick={()=>setEditCourseIds([])}
                      className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-bold disabled:opacity-40">
                      پاک‌کردن
                    </button>
                  </div>
                </div>
                {!!editMissingIds.length&&<div role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
                  <p className="text-xs font-bold text-rose-800 dark:text-rose-200">
                    تعدادی درس قبلی دیگر در چارت فعال نیستند؛ قبل از ذخیره حذفشان کن.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">{editMissingIds.map(id=>
                    <button key={id} type="button" disabled={busy}
                      onClick={()=>setEditCourseIds(prev=>prev.filter(x=>x!==id))}
                      className="min-h-10 rounded-lg border border-rose-300 px-2 text-xs text-rose-800 dark:text-rose-200">
                      حذف {courseMap.get(id)?.name||id}
                    </button>)}</div>
                </div>}
                <input type="search" value={editSearch} disabled={busy} aria-label="جستجوی دروس پیش‌نویس"
                  onChange={e=>setEditSearch(e.target.value)}
                  placeholder="نام یا کد درس را جستجو کن"
                  className="darschin-field min-h-11 w-full"/>
                <div className="grid max-h-96 gap-2 overflow-auto sm:grid-cols-2">
                  {editAvailableIds.filter(id=>{
                    const query=editSearch.trim().toLocaleLowerCase('fa');
                    const course=courseMap.get(id);
                    return !query||[course?.name||'',course?.code||''].some(value=>
                      value.toLocaleLowerCase('fa').includes(query));
                  }).map(id=><div key={id}
                    className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                    <label className="flex min-h-11 items-center gap-2 text-xs font-bold">
                      <input type="checkbox" checked={editCourseIds.includes(id)} disabled={busy}
                        onChange={()=>setEditCourseIds(prev=>prev.includes(id)?
                          prev.filter(x=>x!==id):prev.length>=100?prev:[...prev,id])}/>
                      <span>{courseMap.get(id)?.name||id}
                        <span className="block text-[11px] font-normal text-slate-500">
                          {courseMap.get(id)?.code||''}
                        </span>
                      </span>
                    </label>
                    {editCourseIds.includes(id)&&<label className="mt-1 block text-xs font-bold">
                      حدنصاب پیشنهادی این درس
                      <input type="number" min={0} max={500} step={1} disabled={busy}
                        value={editMinimums[id]??0}
                        onChange={e=>setEditMinimums(old=>({...old,[id]:Number(e.target.value)}))}
                        className="darschin-field mt-1 min-h-10 w-full"/>
                    </label>}
                  </div>)}
                </div>
              </>}
            </section>
            <DemandFormBuilder value={editQuestions} onChange={setEditQuestions} disabled={busy}/>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={()=>void saveDraft()}
                disabled={busy||!editReady||!editTerm||!editCourseIds.length||editCourseIds.length>100||
                  !!editMissingIds.length||editTitle.trim().length<5||!parseDemandQuestions(editQuestions).ok}
                className="min-h-11 rounded-xl bg-violet-800 px-4 text-xs font-black text-white disabled:opacity-40">
                ذخیره تغییرات پیش‌نویس
              </button>
              <button type="button" onClick={()=>setEditingSurveyId('')}
                className="min-h-11 rounded-xl border border-slate-300 px-4 text-xs font-bold">
                انصراف
              </button>
            </div>
          </section>}
          {survey.startsAt||survey.endsAt?<p className="rounded-xl bg-slate-50 p-3 text-xs leading-6 dark:bg-slate-800">
            بازه پاسخ‌دهی: {survey.startsAt?new Date(survey.startsAt).toLocaleString('fa-IR'):'بدون تاریخ شروع'}
            {' تا '}{survey.endsAt?new Date(survey.endsAt).toLocaleString('fa-IR'):'بدون تاریخ پایان'}
            · انتشار فرم به معنای نادیده‌گرفتن بازهٔ زمانی نیست.
          </p>:null}
          <div className="rounded-xl bg-teal-50 p-4 dark:bg-teal-950/40"><p className="text-xs font-semibold text-teal-900 dark:text-teal-200">تعداد دانشجویان پاسخ‌دهنده</p><strong className="text-3xl font-black">{visibleReport?.participantCount ?? '—'}</strong></div>
          {visibleReport&&<DemandCourseReport key={currentDetailKey} rows={visibleReport?.byCourse.map(item=>({
            ...item,name:courseMap.get(item.courseId)?.name||item.courseId,
            code:courseMap.get(item.courseId)?.code||'',
          }))}/>}
          {!!visibleReport?.byQuestion?.length&&<section aria-label="آمار سؤال‌های فرم" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-black">نتایج سؤال‌های اختصاصی (فقط آمار کلی)</h4>
              <button type="button" disabled={busy||!detailReady} onClick={()=>void exportSummary('questions')}
                className="min-h-11 rounded-xl border border-slate-300 px-3 text-xs font-bold disabled:opacity-40 dark:border-slate-600">
                دریافت CSV آمار سؤال‌ها
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleReport.byQuestion.map(item=><article key={item.id}
                className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <strong className="text-xs text-slate-950 dark:text-white">{item.title}</strong>
                <p className="mt-1 text-[11px] text-slate-500">
                  {item.answeredCount.toLocaleString('fa-IR')} پاسخ
                  {typeof item.visibleCount==='number'&&` از ${item.visibleCount.toLocaleString('fa-IR')} نفر مشمول سؤال`}
                  {item.textAnswersPrivate?' · متن پاسخ‌ها خصوصی است':''}
                </p>
                {!!item.options.length&&<div className="mt-2 space-y-1">
                  {item.options.map(option=><div key={option.label}
                    className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800">
                    <span>{option.label}</span><strong>{option.count.toLocaleString('fa-IR')}</strong>
                  </div>)}
                </div>}
              </article>)}
            </div>
            <p className="text-xs text-slate-500">متن پاسخ‌های تشریحی در این گزارش عمومی نمایش داده نمی‌شود؛ فقط مدیر دارای مجوز ویژه می‌تواند خروجی جداگانه دریافت کند.</p>
          </section>}
          <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300"><ShieldCheck className="h-4 w-4"/> گزارش ریز فقط برای مدیر دارای مجوز صادر می‌شود؛ این آمار تشکیل کلاس نیست.</p>
        </section>
      )}
    </div>
  );
};
