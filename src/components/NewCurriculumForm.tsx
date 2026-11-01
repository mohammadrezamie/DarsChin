import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { apiRequest } from '../utils/api';
import type { Curriculum } from '../types';

type Entity = { id:string; name:string; year?:number; universityId?:string; degreeLevelId?:string; active?:boolean };
type Meta = { universities:Entity[];campuses:Entity[];degreeLevels:Entity[];majors:Entity[];entryYears:Entity[] };
export const NewCurriculumForm: React.FC<{onCreated:(c:Curriculum)=>void}> = ({onCreated}) => {
  const [open,setOpen]=useState(false);
  const [meta,setMeta]=useState<Meta>({universities:[],campuses:[],degreeLevels:[],majors:[],entryYears:[]});
  const [form,setForm]=useState({universityId:'',campusId:'',degreeLevelId:'',majorId:'',entryYearId:'',name:'',version:'1.0',notes:''});
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  useEffect(()=>{let alive=true;void apiRequest<Meta>('/api/academic/all-meta').then(r=>{if(alive&&r.success&&r.data)setMeta(r.data)});return()=>{alive=false}},[]);
  const u=form.universityId||meta.universities[0]?.id||'';
  const d=form.degreeLevelId||meta.degreeLevels[0]?.id||'';
  const campuses=meta.campuses.filter(x=>x.active!==false&&x.universityId===u);
  const majors=meta.majors.filter(x=>x.active!==false&&x.degreeLevelId===d);
  const c=campuses.some(x=>x.id===form.campusId)?form.campusId:campuses[0]?.id||'';
  const m=majors.some(x=>x.id===form.majorId)?form.majorId:majors[0]?.id||'';
  const y=form.entryYearId||meta.entryYears[0]?.id||'';
  const update=(key:keyof typeof form,value:string)=>setForm(s=>({...s,[key]:value}));
  const save=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');
    if(!u||!c||!d||!m||!y||!form.name.trim()){setError('تمام مشخصات اصلی را کامل کن.');return;}
    setSaving(true);
    try{
      const r=await apiRequest<Curriculum>('/api/curriculum',{method:'POST',body:JSON.stringify({
        universityId:u,campusId:c,degreeLevelId:d,majorId:m,entryYearId:y,
        name:form.name.trim(),version:form.version.trim()||'1.0',notes:form.notes.trim(),status:'draft'
      })});
      if(!r.success||!r.data){setError(r.error||'ثبت چارت موفق نبود.');return;}
      onCreated(r.data);setOpen(false);setForm(s=>({...s,name:'',notes:''}));
    }finally{setSaving(false);}
  };
  const select=(label:string,key:keyof typeof form,items:Entity[],onChange?:(v:string)=>void)=>
    <label className="text-xs font-bold">{label}
      <select value={key==='universityId'?u:key==='degreeLevelId'?d:key==='campusId'?c:key==='majorId'?m:key==='entryYearId'?y:form[key]}
        onChange={e=>onChange?onChange(e.target.value):update(key,e.target.value)}
        className="darschin-field mt-1" required>
        {items.map(item=><option key={item.id} value={item.id}>{item.year?'ورودی '+item.year:item.name}</option>)}
      </select>
    </label>;
  return <section dir="rtl" className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-base font-bold">افزودن چارت تحصیلی</h3>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">برای هر ورودی یک چارت مستقل تعریف کن؛ چارت ابتدا پیش‌نویس است.</p></div>
      <button type="button" aria-expanded={open} onClick={()=>setOpen(x=>!x)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">{open?<X size={16}/>:<Plus size={16}/>} {open?'بستن':'چارت جدید'}</button>
    </div>
    {open&&<form onSubmit={save} className="mt-4 grid gap-3 border-t border-blue-200 pt-4 sm:grid-cols-2 dark:border-blue-900">
      {select('دانشگاه','universityId',meta.universities.filter(x=>x.active!==false),v=>setForm(s=>({...s,universityId:v,campusId:''})))}
      {select('واحد دانشگاهی','campusId',campuses)}
      {select('مقطع','degreeLevelId',meta.degreeLevels.filter(x=>x.active!==false),v=>setForm(s=>({...s,degreeLevelId:v,majorId:''})))}
      {select('رشته','majorId',majors)}
      {select('ورودی','entryYearId',meta.entryYears.filter(x=>x.active!==false))}
      <label className="text-xs font-bold">نسخه
        <input className="darschin-field mt-1" value={form.version} onChange={e=>update('version',e.target.value)} maxLength={48} required/></label>
      <label className="text-xs font-bold sm:col-span-2">عنوان چارت
        <input className="darschin-field mt-1" value={form.name} onChange={e=>update('name',e.target.value)} maxLength={150} placeholder="چارت کارشناسی مهندسی برق ورودی ۱۴۰۳" required/></label>
      <label className="text-xs font-bold sm:col-span-2">یادداشت و مرجع مصوبه
        <textarea className="darschin-field mt-1" rows={2} value={form.notes} onChange={e=>update('notes',e.target.value)} placeholder="بعداً شماره و تاریخ مصوبه را ثبت کن."/></label>
      {error&&<p role="alert" className="text-xs text-rose-700 sm:col-span-2">{error}</p>}
      <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{saving?'در حال ذخیره…':'ساخت پیش‌نویس چارت'}</button>
    </form>}
  </section>;
};
