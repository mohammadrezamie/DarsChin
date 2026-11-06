import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { apiRequest } from '../utils/api';
import type { Curriculum } from '../types';
import {
  changeCurriculumScope, curriculumScopeOptions, emptyCurriculumScope,
  validateCurriculumScope, type AcademicScopeEntity, type CurriculumScopeMeta,
  type CurriculumScopeSelection,
} from '../domain/curriculum-scope';

type FormState = CurriculumScopeSelection & {name:string;version:string;notes:string};
const initialForm = ():FormState => ({
  ...emptyCurriculumScope(),name:'',version:'1.0',notes:'',
});
const emptyMeta = ():CurriculumScopeMeta => ({
  universities:[],campuses:[],degreeLevels:[],majors:[],entryYears:[],
});

/** ساخت چارت فقط پس از انتخاب آگاهانهٔ تمام اجزای حوزهٔ تحصیلی انجام می‌شود. */
export const NewCurriculumForm: React.FC<{onCreated:(chart:Curriculum)=>void}> = ({onCreated}) => {
  const [open,setOpen] = useState(false);
  const [meta,setMeta] = useState<CurriculumScopeMeta>(emptyMeta);
  const [loaded,setLoaded] = useState(false);
  const [metaError,setMetaError] = useState('');
  const [form,setForm] = useState<FormState>(initialForm);
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);

  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      try {
        const response=await apiRequest<CurriculumScopeMeta>('/api/academic/all-meta');
        if(!alive)return;
        if(!response.success||!response.data) {
          setMetaError(response.error||'فهرست دانشگاه و رشته دریافت نشد.');return;
        }
        setMeta(response.data);
        setLoaded(true);
      } catch {
        if(alive)setMetaError('ارتباط برای دریافت ساختار دانشگاه برقرار نشد.');
      }
    };
    void load();
    return()=>{alive=false;};
  },[]);

  const options=curriculumScopeOptions(meta,form);
  const scopeError=loaded?validateCurriculumScope(meta,form):'اطلاعات دانشگاه دریافت نشده است.';
  const chosenCount=([
    'universityId','campusId','degreeLevelId','majorId','entryYearId',
  ] as const).filter(key=>Boolean(form[key])).length;
  const updateScope=(field:keyof CurriculumScopeSelection,value:string)=>{
    setForm(previous=>({...previous,...changeCurriculumScope(previous,field,value)}));
    setError('');
  };
  const update=(field:'name'|'version'|'notes',value:string)=>{
    setForm(previous=>({...previous,[field]:value}));setError('');
  };
  const save=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(saving)return;
    const issue=validateCurriculumScope(meta,form);
    if(!loaded||issue){setError(issue||'فهرست‌های دانشگاه هنوز آماده نیست.');return;}
    if(!form.name.trim()||!form.version.trim()){
      setError('عنوان و نسخهٔ چارت را کامل کن.');return;
    }
    setSaving(true);setError('');
    try {
      const response=await apiRequest<Curriculum>('/api/curriculum',{
        method:'POST',body:JSON.stringify({
          universityId:form.universityId,campusId:form.campusId,
          degreeLevelId:form.degreeLevelId,majorId:form.majorId,
          entryYearId:form.entryYearId,name:form.name.trim(),
          version:form.version.trim(),notes:form.notes.trim(),status:'draft',
        }),
      });
      if(!response.success||!response.data) {
        setError(response.error||'ثبت پیش‌نویس چارت انجام نشد.');return;
      }
      onCreated(response.data);
      setOpen(false);
      setForm(initialForm());
    } catch {setError('ارتباط در زمان ساخت چارت برقرار نشد؛ فرم حفظ شده است.');}
    finally {setSaving(false);}
  };
  const select=(
    label:string,field:keyof CurriculumScopeSelection,items:AcademicScopeEntity[],
    placeholder:string,disabled=false,
  )=><label className="text-xs font-bold text-slate-800 dark:text-slate-100">{label}
    <select value={form[field]} required disabled={disabled||saving||!loaded}
      onChange={e=>updateScope(field,e.target.value)}
      className="darschin-field mt-1 min-h-11 w-full">
      <option value="">{placeholder}</option>
      {items.map(item=><option key={item.id} value={item.id}>
        {item.year ? 'ورودی '+item.year.toLocaleString('fa-IR') : item.name||'بدون عنوان'}
      </option>)}
    </select>
  </label>;

  return <section dir="rtl" className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-bold">ایجاد چارت تحصیلی جدید</h3>
        <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
          دانشگاه، واحد، مقطع، رشته و ورودی را خودت به‌ترتیب انتخاب کن؛ هیچ موردی به‌صورت پیش‌فرض به چارت نسبت داده نمی‌شود.
        </p>
      </div>
      <button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">
        {open?<X size={16}/>:<Plus size={16}/>} {open?'بستن فرم':'چارت جدید'}
      </button>
    </div>
    {open&&<form onSubmit={event=>void save(event)} className="mt-4 space-y-4 border-t border-blue-200 pt-4 dark:border-blue-900">
      <div className="rounded-xl bg-white p-3 text-xs leading-6 text-blue-900 dark:bg-slate-900 dark:text-blue-200">
        <strong>مشخصات حوزهٔ تحصیلی: {chosenCount.toLocaleString('fa-IR')} از ۵</strong>
        <p>برای هر سال ورود، نسخهٔ مستقل چارت تعریف می‌شود. چارت جدید ابتدا پیش‌نویس است و بعداً از پنل منتشر می‌شود.</p>
      </div>
      {metaError&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{metaError}</p>}
      <fieldset className="grid gap-3 sm:grid-cols-2" disabled={saving}>
        <legend className="mb-2 text-sm font-extrabold">۱. دانشگاه و رشته</legend>
        {select('دانشگاه','universityId',options.universities,'دانشگاه را انتخاب کن')}
        {select('واحد دانشگاهی','campusId',options.campuses,
          form.universityId?'واحد این دانشگاه را انتخاب کن':'ابتدا دانشگاه را انتخاب کن',!form.universityId)}
        {select('مقطع تحصیلی','degreeLevelId',options.degreeLevels,'مقطع را انتخاب کن')}
        {select('رشتهٔ تحصیلی','majorId',options.majors,
          form.degreeLevelId?'رشتهٔ همین مقطع را انتخاب کن':'ابتدا مقطع را انتخاب کن',!form.degreeLevelId)}
        {select('سال ورود','entryYearId',options.entryYears,'ورودی را انتخاب کن')}
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-extrabold">۲. اطلاعات نسخهٔ چارت</legend>
        <label className="text-xs font-bold">نسخه
          <input required maxLength={48} value={form.version} disabled={saving}
            onChange={e=>update('version',e.target.value)}
            className="darschin-field mt-1 min-h-11" placeholder="مثلاً 1403-v1"/>
        </label>
        <label className="text-xs font-bold sm:col-span-2">عنوان چارت
          <input required maxLength={150} value={form.name} disabled={saving}
            onChange={e=>update('name',e.target.value)}
            className="darschin-field mt-1 min-h-11"
            placeholder="مثلاً کارشناسی مهندسی برق ـ ورودی ۱۴۰۳"/>
        </label>
        <label className="text-xs font-bold sm:col-span-2">مرجع مصوبه یا یادداشت
          <textarea maxLength={2000} rows={2} value={form.notes} disabled={saving}
            onChange={e=>update('notes',e.target.value)}
            className="darschin-field mt-1" placeholder="شماره مصوبه و توضیح تغییر نسخه"/>
        </label>
      </fieldset>
      {error&&<p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
      <button type="submit" disabled={saving||!loaded||Boolean(scopeError)||!form.name.trim()}
        className="min-h-11 w-full rounded-xl bg-blue-700 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
        {saving?'در حال ثبت چارت…':'ساخت پیش‌نویس برای این رشته و ورودی'}
      </button>
    </form>}
  </section>;
};
