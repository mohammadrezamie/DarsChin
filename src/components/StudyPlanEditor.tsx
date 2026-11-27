import React,{useEffect,useRef,useState} from 'react';
import type {Curriculum,CurriculumCourse,Course,Track} from '../types';
import type {StudyPlanDraft,StudyPeriod,StudyPlanValidation} from '../domain/study-plan-draft';
import {validateStudyPlanDraft} from '../domain/study-plan-draft';
import {ruleScopeCourseIds} from '../domain/curriculum-rule-scope';
import {apiRequest} from '../utils/api';

type ResponseData={plan:StudyPlanDraft|null;revision:string|null;validation:StudyPlanValidation};
export type StudyPlanLeaveGuard={dirty:boolean;saving:boolean};
export function StudyPlanEditor({chart,assignments,courses,tracks,leaveGuard}:{
 chart:Curriculum;assignments:CurriculumCourse[];courses:Course[];tracks:Track[];leaveGuard?:React.MutableRefObject<StudyPlanLeaveGuard>;
}){
 const [track,setTrack]=useState('');
 const [revision,setRevision]=useState<string|null>(null);
 const [saved,setSaved]=useState<StudyPlanDraft|null>(null);
 const [draft,setDraft]=useState<StudyPlanDraft|null>(null);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [retry,setRetry]=useState(0);
 const [periodLabel,setPeriodLabel]=useState('');
 const [periodKind,setPeriodKind]=useState<StudyPeriod['kind']>('regular');
 const [courseId,setCourseId]=useState('');
 const [periodId,setPeriodId]=useState('');
 const sequence=useRef(0);
 const busy=useRef(false);
 const generation=useRef(0);
 const dirty=JSON.stringify(saved)!==JSON.stringify(draft);
 const relevant=tracks.filter(t=>t.active&&t.majorId===chart.majorId);
 const scopeValid=!track||relevant.some(t=>t.id===track);
 const ids=ruleScopeCourseIds(assignments,chart.id,track||null);
 const allowed=courses.filter(c=>c.active&&ids.has(c.id));
 const validation=validateStudyPlanDraft({curriculumId:chart.id,courseIds:allowed.map(c=>c.id),choicePoolIds:[]},draft);
 const endpoint='/api/curriculum/'+encodeURIComponent(chart.id)+'/study-plan-draft';
 const blocked=status!=='ready'||saving||chart.status==='archived'||!scopeValid;
 useEffect(()=>{
   const controller=new AbortController();
   const gen=++generation.current;
   setStatus('loading');setError('');setMessage('');setSaved(null);setDraft(null);setRevision(null);
   setPeriodId('');setCourseId('');setPeriodLabel('');
   void apiRequest<ResponseData>(endpoint+'?trackId='+encodeURIComponent(track),{signal:controller.signal}).then(result=>{
     if(controller.signal.aborted||gen!==generation.current)return;
     if(!result.success||!result.data||!Object.hasOwn(result.data,'plan')||!(result.data.revision===null||typeof result.data.revision==='string')){
       setStatus('error');setError(result.error||'دریافت برنامهٔ پیشنهادی ناموفق بود.');return;
     }
     setSaved(result.data.plan);setDraft(result.data.plan);setRevision(result.data.revision);setStatus('ready');
   }).catch(()=>{if(!controller.signal.aborted&&gen===generation.current){setStatus('error');setError('ارتباط با سرور برقرار نشد.');}});
   return ()=>{controller.abort();generation.current++;};
 },[endpoint,track,retry]);
 useEffect(()=>{
   if(!leaveGuard)return;
   leaveGuard.current={dirty,saving};
   return ()=>{leaveGuard.current={dirty:false,saving:false};};
 },[leaveGuard,dirty,saving]);
 useEffect(()=>{
   if(!dirty&&!saving)return;
   const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
   window.addEventListener('beforeunload',warn);return ()=>window.removeEventListener('beforeunload',warn);
 },[dirty,saving]);
 const nextId=(prefix:string)=>{
   const used=new Set([...(draft?.periods||[]).map(p=>p.id),...(draft?.items||[]).map(i=>i.id)]);
   let value:string;do{value=prefix+'-'+(++sequence.current);}while(used.has(value));return value;
 };
 function changeTrack(value:string){
   if(saving||busy.current||value===track)return;
   if(dirty&&!window.confirm('تغییرات ذخیره‌نشدهٔ این گرایش کنار گذاشته شود؟'))return;
   setStatus('loading');setTrack(value);
 }
 function addPeriod(){
   if(blocked||!draft||!periodLabel.trim()||draft.periods.length>=100)return;
   const id=nextId('period');
   setDraft({...draft,periods:[...draft.periods,{id,label:periodLabel.trim(),kind:periodKind}]});setPeriodLabel('');setPeriodId(id);
 }
 function movePeriod(index:number,delta:number){
   if(blocked||!draft||index+delta<0||index+delta>=draft.periods.length)return;
   const periods=[...draft.periods];[periods[index],periods[index+delta]]=[periods[index+delta],periods[index]];
   setDraft({...draft,periods});
 }
 function removePeriod(id:string){
   if(blocked||!draft)return;
   if(draft.items.some(item=>item.periodId===id)){setError('ابتدا درس‌های این دوره را از برنامه حذف یا منتقل کنید.');return;}
   setDraft({...draft,periods:draft.periods.filter(p=>p.id!==id)});
   if(periodId===id)setPeriodId('');
 }
 function addCourse(){
   if(blocked||!draft||!allowed.some(c=>c.id===courseId)||!draft.periods.some(p=>p.id===periodId)||draft.items.some(i=>i.kind==='course'&&i.courseId===courseId)||draft.items.length>=2000)return;
   setDraft({...draft,items:[...draft.items,{id:nextId('item'),kind:'course',courseId,periodId}]});setCourseId('');
 }
 async function save(value:StudyPlanDraft|null){
   if(blocked||busy.current)return;
   if(value!==null&&validation.status!=='valid')return;
   busy.current=true;if(leaveGuard)leaveGuard.current={dirty,saving:true};setSaving(true);setError('');setMessage('');
   const gen=generation.current;
   try{
     const result=await apiRequest<ResponseData>(endpoint,{method:'PUT',body:JSON.stringify({trackId:track||null,plan:value,expectedRevision:revision})});
     if(gen!==generation.current)return;
     if(!result.success||!result.data||!Object.hasOwn(result.data,'plan')||!(result.data.revision===null||typeof result.data.revision==='string')){setError(result.error||'ذخیره انجام نشد؛ پیش‌نویس محلی حفظ شد.');return;}
     setSaved(result.data.plan);setDraft(result.data.plan);setRevision(result.data.revision);setMessage('برنامهٔ پیشنهادی ذخیره شد.');
   }catch{if(gen===generation.current)setError('نتیجهٔ ذخیره مشخص نیست؛ پس از بررسی اتصال، دوباره بارگذاری کنید.');}
   finally{busy.current=false;if(gen===generation.current)setSaving(false);}
 }
 const field='block min-h-11 min-w-0 w-full max-w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-900';
 // Native RTL single-line fields may propagate long text overflow in WebKit.
 // Keep full titles in wrapping editors; compact select labels are only presentation.
 const titleField=field+' resize-y whitespace-pre-wrap break-words [overflow-wrap:anywhere]';
 const periodOptionLabel=(period:StudyPeriod,index:number)=>{
   const title=Array.from(period.label);
   return (index+1).toLocaleString('fa-IR')+' · '+title.slice(0,18).join('')+(title.length>18?'…':'');
 };
 const action='min-h-11 min-w-0 max-w-full whitespace-normal break-words rounded-lg border border-slate-300 px-3 text-xs font-bold dark:border-slate-700 disabled:opacity-50';
 return <section aria-label="ویرایش برنامهٔ پیشنهادی مستقل" className="min-w-0 w-full max-w-full space-y-4 rounded-2xl border border-slate-200 p-3 sm:p-4 dark:border-slate-700">
  <div className="space-y-1"><h3 className="font-black">برنامهٔ پیشنهادی مستقل</h3>
   <p className="text-xs leading-6 text-slate-500 dark:text-slate-300">اختیاری؛ تغییر این برنامه هیچ درس یا قانون الزامی چارت را تغییر نمی‌دهد. تغییرات را قبل از خروج از چارت ذخیره کنید.</p></div>
  <label className="block min-w-0 max-w-full text-xs font-bold">دامنهٔ برنامهٔ پیشنهادی<select aria-label="دامنهٔ برنامهٔ پیشنهادی" className={field} value={track} disabled={saving} onChange={e=>changeTrack(e.target.value)}>
    <option value="">دروس مشترک</option>{relevant.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
  </select></label>
  {error&&<p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
  {message&&<p role="status" className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{message}</p>}
  {status==='loading'&&<p role="status">در حال دریافت برنامه…</p>}
  {status==='error'&&<button type="button" className={action} onClick={()=>setRetry(n=>n+1)}>تلاش مجدد دریافت برنامه</button>}
  {status==='ready'&&<button type="button" className={action} disabled={saving} onClick={()=>{if(!dirty||window.confirm('تغییرات محلی کنار گذاشته و آخرین نسخه دریافت شود؟')){setStatus('loading');setRetry(n=>n+1);}}}>دریافت آخرین نسخه</button>}
  {dirty&&<p role="status" className="text-xs font-bold text-amber-800 dark:text-amber-200">تغییرات ذخیره‌نشده</p>}
  {status==='ready'&&(!draft?<div className="space-y-2">
   <p className="text-sm text-slate-500">برای این دامنه برنامهٔ مستقلی ثبت نشده است.</p>
   <button type="button" className={action} disabled={blocked} onClick={()=>setDraft({curriculumId:chart.id,periods:[],items:[]})}>ایجاد برنامهٔ پیشنهادی</button>
  </div>:<>
   <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
    <label className="min-w-0 max-w-full text-xs font-bold">عنوان دوره<textarea aria-label="عنوان دوره" dir="rtl" rows={2} className={titleField} disabled={blocked} maxLength={150} value={periodLabel} onChange={e=>setPeriodLabel(e.target.value.replace(/[\r\n]+/g," "))}/></label>
    <label className="min-w-0 max-w-full text-xs font-bold">نوع دوره<select aria-label="نوع دوره" className={field} disabled={blocked} value={periodKind} onChange={e=>setPeriodKind(e.target.value as StudyPeriod['kind'])}><option value="regular">نیمسال عادی</option><option value="summer">تابستان</option><option value="other">دورهٔ دیگر</option></select></label>
    <button type="button" className={action+' self-end'} disabled={blocked||!periodLabel.trim()||draft.periods.length>=100} onClick={addPeriod}>افزودن دوره</button>
   </div>
   <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">{draft.periods.map((p,index)=><article key={p.id} className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
     <label className="block min-w-0 max-w-full text-xs font-bold">عنوان دورهٔ {index+1}<textarea aria-label={'عنوان دورهٔ '+(index+1)} dir="rtl" rows={2} className={titleField} disabled={blocked} maxLength={150} value={p.label} onChange={e=>setDraft({...draft,periods:draft.periods.map(row=>row.id===p.id?{...row,label:e.target.value.replace(/[\r\n]+/g," ")}:row)})}/></label>
     <p className="text-xs text-slate-500">{p.kind==='summer'?'تابستان':p.kind==='regular'?'نیمسال عادی':'دورهٔ دیگر'}</p>
     <div className="my-2 flex flex-wrap gap-1"><button type="button" className={action} disabled={blocked||index===0} onClick={()=>movePeriod(index,-1)}>زودتر</button><button type="button" className={action} disabled={blocked||index===draft.periods.length-1} onClick={()=>movePeriod(index,1)}>دیرتر</button><button type="button" className={action} disabled={blocked} onClick={()=>removePeriod(p.id)}>حذف دوره</button></div>
     {draft.items.filter(i=>i.periodId===p.id).map(i=><div key={i.id} className="grid min-w-0 grid-cols-1 items-center gap-2 border-t py-2 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
       <span className="min-w-0 break-words [overflow-wrap:anywhere]">{i.kind==='course'?courses.find(c=>c.id===i.courseId)?.name||'درس نامشخص':i.label}</span>
       <label className="block min-w-0 max-w-full">انتقال به<select aria-label="انتقال به" className={field} disabled={blocked} value={i.periodId} onChange={e=>setDraft({...draft,items:draft.items.map(row=>row.id===i.id?{...row,periodId:e.target.value}:row)})}>{draft.periods.map((period,index)=><option key={period.id} value={period.id}>{periodOptionLabel(period,index)}</option>)}</select><span className="mt-1 block text-xs font-normal [overflow-wrap:anywhere]">{draft.periods.find(period=>period.id===i.periodId)?.label}</span></label>
       <button type="button" className={action} disabled={blocked} onClick={()=>setDraft({...draft,items:draft.items.filter(row=>row.id!==i.id)})}>حذف از برنامه</button>
     </div>)}
   </article>)}</div>
   <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
     <label className="min-w-0 max-w-full text-xs font-bold">درس پیشنهادی<select aria-label="درس پیشنهادی" className={field} disabled={blocked} value={courseId} onChange={e=>setCourseId(e.target.value)}><option value="">انتخاب درس</option>{allowed.filter(c=>!draft.items.some(i=>i.kind==='course'&&i.courseId===c.id)).map(c=><option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}</select></label>
     <label className="min-w-0 max-w-full text-xs font-bold">دورهٔ مقصد<select aria-label="دورهٔ مقصد" className={field} disabled={blocked} value={periodId} onChange={e=>setPeriodId(e.target.value)}><option value="">انتخاب دوره</option>{draft.periods.map((p,index)=><option key={p.id} value={p.id}>{periodOptionLabel(p,index)}</option>)}</select><span className="mt-1 block text-xs font-normal [overflow-wrap:anywhere]">{draft.periods.find(p=>p.id===periodId)?.label}</span></label>
     <button type="button" className={action+' self-end'} disabled={blocked||!courseId||!periodId} onClick={addCourse}>افزودن درس به برنامه</button>
   </div>
   {validation.status==='invalid'&&<p role="alert" className="text-xs text-rose-700">{validation.issues.join('؛ ')}</p>}
   {validation.status==='valid'&&<p className="text-xs text-slate-500">{validation.unplannedCourseIds.length.toLocaleString('fa-IR')} درس بدون پیشنهاد؛ پوشش کامل الزامی نیست.</p>}
   <div className="flex min-w-0 flex-wrap gap-2">
    <button type="button" disabled={blocked||!dirty||validation.status!=='valid'} onClick={()=>void save(draft)} className="min-h-11 min-w-0 max-w-full whitespace-normal break-words rounded-lg bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-50">{saving?'در حال ذخیره…':'ذخیرهٔ برنامهٔ پیشنهادی'}</button>
    <button type="button" className={action} disabled={blocked||!dirty} onClick={()=>setDraft(saved)}>لغو تغییرات محلی</button>
    {saved&&<button type="button" className={action} disabled={blocked} onClick={()=>{if(window.confirm('فقط برنامهٔ پیشنهادی این دامنه حذف شود؟'))void save(null);}}>حذف برنامهٔ ذخیره‌شده</button>}
   </div>
  </>)}
 </section>;
}
