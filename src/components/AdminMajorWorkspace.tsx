import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronLeft, GraduationCap, Layers, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { apiRequest } from '../utils/api';
import type { Campus, Curriculum, DegreeLevel, EntryYear, Major, Track, University } from '../types';
import { groupAcademicMajors } from '../domain/admin-major-tree';

type AcademicMeta = {
  majors:Major[];
  degreeLevels:DegreeLevel[];
  tracks:Track[];
  entryYears:EntryYear[];
  campuses:Campus[];
  universities:University[];
};
const initialMeta:AcademicMeta={majors:[],degreeLevels:[],tracks:[],entryYears:[],campuses:[],universities:[]};
const field='mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const action='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';
type BusyAction = 'major'|'degree'|'track'|'chart'|'delete-track'|'refresh'|'year'|null;

/**
 * Administrative entry point: select a major by its human name, then a degree
 * and see its track list, entry-year curricula and next actions in one place.
 * IDs remain API-only, with no destructive migration of existing cohorts.
 */
export const AdminMajorWorkspace:React.FC=()=>{
  const [,setSearchParams]=useSearchParams();
  const [meta,setMeta]=useState<AcademicMeta>(initialMeta);
  const [charts,setCharts]=useState<Curriculum[]>([]);
  const [selectedKey,setSelectedKey]=useState('');
  const [selectedDegreeId,setSelectedDegreeId]=useState('');
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState<BusyAction>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [createMajorOpen,setCreateMajorOpen]=useState(false);
  const [majorName,setMajorName]=useState('');
  const [majorDegree,setMajorDegree]=useState('');
  const [newDegreeName,setNewDegreeName]=useState('');
  const [newDegreeChoice,setNewDegreeChoice]=useState('');
  const [addingTrack,setAddingTrack]=useState(false);
  const [trackName,setTrackName]=useState('');
  const [addingChart,setAddingChart]=useState(false);
  const [campusId,setCampusId]=useState('');
  const [yearId,setYearId]=useState('');
  const [newYear,setNewYear]=useState('');
  const [advanced,setAdvanced]=useState(false);
  const [chartVersion,setChartVersion]=useState('1.0');
  const [chartTitle,setChartTitle]=useState('');

  const groups=useMemo(()=>groupAcademicMajors(meta.majors),[meta.majors]);
  const group=groups.find(x=>x.key===selectedKey)||groups[0];
  const majors=group?.members||[];
  const degreeMajors=majors.filter(m=>meta.degreeLevels.some(d=>d.id===m.degreeLevelId && d.active!==false));
  const currentMajor=degreeMajors.find(m=>m.degreeLevelId===selectedDegreeId)||degreeMajors[0];
  const degree=meta.degreeLevels.find(d=>d.id===currentMajor?.degreeLevelId);
  const tracks=meta.tracks.filter(t=>t.majorId===currentMajor?.id && t.active!==false);
  const currentCharts=charts.filter(c=>c.majorId===currentMajor?.id && c.degreeLevelId===currentMajor?.degreeLevelId)
    .sort((a,b)=>{
      const yearA=meta.entryYears.find(y=>y.id===a.entryYearId)?.year||0;
      const yearB=meta.entryYears.find(y=>y.id===b.entryYearId)?.year||0;
      return yearB-yearA || a.version.localeCompare(b.version,'fa');
    });
  const normalizedSearch=search.trim().normalize('NFKC')
    .replace(/ي/g,'ی').replace(/ك/g,'ک');
  const filtered=groups.filter(g=>!normalizedSearch || g.label.normalize('NFKC')
    .replace(/ي/g,'ی').replace(/ك/g,'ک').includes(normalizedSearch));
  const selectedCampus=meta.campuses.find(c=>c.id===campusId && c.active!==false)||
    meta.campuses.find(c=>c.active!==false);
  // Newest entry year should be the visibly selected default, rather than
  // the first unsorted database row (which could be an old cohort).
  const selectedYear=meta.entryYears.find(y=>y.id===yearId && y.active!==false)||
    meta.entryYears.filter(y=>y.active!==false).sort((a,b)=>b.year-a.year)[0];
  const degreeChoices=meta.degreeLevels.filter(d=>d.active!==false && !majors.some(m=>m.degreeLevelId===d.id));

  const refresh=async()=>{
    const [m,c]=await Promise.all([
      apiRequest<AcademicMeta>('/api/academic/all-meta'),
      apiRequest<Curriculum[]>('/api/curriculum'),
    ]);
    if(m.success&&m.data)setMeta(m.data);
    else setError(m.error||'اطلاعات آموزشی دریافت نشد؛ از بارگذاری مجدد استفاده کن.');
    if(c.success&&c.data)setCharts(c.data);
    else setError(c.error||'چارت‌های تحصیلی دریافت نشدند.');
    setLoading(false);
  };
  useEffect(()=>{void refresh()},[]);

  const write=async<T,>(type:BusyAction,path:string,body:object,successMsg:string):Promise<T|null>=>{
    setBusy(type);setError('');setNotice('');
    try{
      const r=await apiRequest<T>(path,{method:'POST',body:JSON.stringify(body)});
      if(!r.success||!r.data){setError(r.error||'ذخیره انجام نشد؛ دوباره تلاش کن.');return null;}
      setNotice(successMsg);
      await refresh();
      return r.data;
    }catch{
      setError('اتصال برقرار نشد؛ دوباره تلاش کن.');
      return null;
    }finally{setBusy(null);}
  };
  const addMajor=async()=>{
    const name=majorName.trim();
    let chosen=majorDegree||meta.degreeLevels.find(x=>x.active!==false)?.id;
    if(!chosen && newDegreeName.trim()){
      const createdDegree=await write<DegreeLevel>('degree','/api/academic/degrees',
        {name:newDegreeName.trim()},'مقطع اولیه ساخته شد.');
      if(!createdDegree)return;
      chosen=createdDegree.id;setNewDegreeName('');
    }
    if(!name||!chosen){setError('نام رشته و مقطع تحصیلی را انتخاب کن.');return;}
    if(meta.majors.some(m=>m.name.trim()===name && m.degreeLevelId===chosen)){
      setError('این رشته برای این مقطع قبلاً ثبت شده است.');return;
    }
    const created=await write<Major>('major','/api/academic/majors',
      {name,degreeLevelId:chosen},'رشته ایجاد شد؛ حالا می‌توانی گرایش و ورودی‌هایش را تنظیم کنی.');
    if(created){
      setSelectedKey(name.normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('fa')
        .replace(/ي/g,'ی').replace(/ك/g,'ک'));
      setSelectedDegreeId(chosen);setMajorName('');setCreateMajorOpen(false);
    }
  };
  const attachDegree=async()=>{
    if(!group)return;
    if(!newDegreeChoice){setError('یک مقطع انتخاب کن.');return;}
    const created=await write<Major>('degree','/api/academic/majors',
      {degreeLevelId:newDegreeChoice,name:group.label},'مقطع به این رشته اضافه شد.');
    if(created){setSelectedDegreeId(newDegreeChoice);setNewDegreeChoice('');}
  };
  const addDegree=async()=>{
    if(!group||!newDegreeName.trim())return;
    const newItem=await write<DegreeLevel>('degree','/api/academic/degrees',
      {name:newDegreeName.trim()},'مقطع جدید ایجاد شد.');
    if(!newItem)return;
    setNewDegreeName('');
    const created=await write<Major>('degree','/api/academic/majors',
      {name:group.label,degreeLevelId:newItem.id},'مقطع جدید به رشته اضافه شد.');
    if(created)setSelectedDegreeId(newItem.id);
  };
  const addTrack=async()=>{
    if(!currentMajor||!trackName.trim())return;
    const created=await write<Track>('track','/api/academic/tracks',
      {majorId:currentMajor.id,name:trackName.trim()},'گرایش به همین رشته و مقطع اضافه شد.');
    if(created){setTrackName('');setAddingTrack(false);}
  };
  const removeTrack=async(t:Track)=>{
    if(!window.confirm(`گرایش «${t.name}» حذف شود؟ اگر به چارت یا دانشجو متصل باشد حذف نخواهد شد.`))return;
    setBusy('delete-track');setError('');
    try{
      const r=await apiRequest(`/api/academic/tracks/${t.id}`,{method:'DELETE'});
      if(!r.success)setError(r.error||'این گرایش قابل حذف نیست.');
      else{setNotice('گرایش حذف شد.');await refresh();}
    }finally{setBusy(null);}
  };
  const createYear=async()=>{
    const asciiYear=newYear.replace(/[۰-۹]/g,ch=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
      .replace(/[٠-٩]/g,ch=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)));
    const year=Number(asciiYear);
    if(!Number.isInteger(year)||year<1300||year>1600){
      setError('سال ورودی را به صورت چهار رقم شمسی، مثلاً ۱۴۰۳، وارد کن.');return;
    }
    const existing=meta.entryYears.find(y=>y.year===year);
    if(existing){setYearId(existing.id);setNewYear('');return;}
    const created=await write<EntryYear>('year','/api/academic/entry-years',
      {year},'سال ورود به فهرست اضافه شد.');
    if(created){setYearId(created.id);setNewYear('');}
  };
  const createChart=async()=>{
    if(!group||!currentMajor||!degree||!selectedCampus||!selectedYear){
      setError('برای ساخت چارت، مقطع، واحد و ورودی لازم است.');return;
    }
    const version=advanced&&chartVersion.trim()?chartVersion.trim():'1.0';
    if(currentCharts.some(c=>c.campusId===selectedCampus.id&&
      c.entryYearId===selectedYear.id&&c.version===version)){
      setError('برای این ورودی و واحد یک چارت با همین نسخه وجود دارد؛ آن را باز کن یا در تنظیمات پیشرفته نسخهٔ دیگری انتخاب کن.');
      return;
    }
    const name=advanced&&chartTitle.trim()?chartTitle.trim():
      `چارت ${degree.name} ${group.label} ورودی ${selectedYear.year} - ${selectedCampus.name}`;
    const created=await write<Curriculum>('chart','/api/curriculum',{
      universityId:selectedCampus.universityId,campusId:selectedCampus.id,
      degreeLevelId:degree.id,majorId:currentMajor.id,entryYearId:selectedYear.id,
      version,name,status:'draft',
    },'چارت به‌صورت پیش‌نویس ساخته شد؛ هنوز قانون یا ارائهٔ رسمی نیست.');
    if(created){setAddingChart(false);setAdvanced(false);setChartVersion('1.0');setChartTitle('');}
  };
  const openChart=(chart:Curriculum)=>
    setSearchParams({tab:'curricula',curriculumId:chart.id});
  const openRules=(chart:Curriculum)=>
    setSearchParams({tab:'academic-rules',curriculumId:chart.id});
  const goDemand=()=>setSearchParams({tab:'demand'});

  if(loading)return <div className="rounded-2xl border border-slate-200 p-6 text-sm dark:border-slate-800" role="status">
    در حال آماده‌کردن فهرست رشته‌ها…
  </div>;

  return <div dir="rtl" className="min-w-0 space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-black text-slate-950 dark:text-white">رشته‌ها و چارت‌های تحصیلی</h2>
        <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
          اول رشته را انتخاب کن؛ مقطع، گرایش‌ها و ورودی‌هایش همین‌جا هستند. به شناسهٔ فنی نیازی نداری.
        </p>
      </div>
      <button type="button" aria-label="بازخوانی رشته‌ها" onClick={()=>void refresh()}
        className={action}><RefreshCw className="h-4 w-4"/> به‌روزرسانی</button>
    </header>
    {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <label className="relative block">
          <Search className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400"/>
          <span className="sr-only">جست‌وجوی رشته</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="نام رشته را جست‌وجو کن…"
            className={field+' mt-0 pr-10'}/>
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {filtered.map(item=>{
            const selected=group?.key===item.key;
            return <button key={item.key} type="button"
              aria-current={selected?'true':undefined}
              onClick={()=>{setSelectedKey(item.key);setSelectedDegreeId('');setAddingTrack(false);setAddingChart(false);setNotice('');}}
              className={'flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3 text-right transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 '+
                (selected?'border-blue-400 bg-blue-50 text-blue-950 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-100':
                'border-slate-200 text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800')}>
              <span className="min-w-0"><strong className="block break-words text-sm">{item.label}</strong>
                <span className="mt-1 block text-xs opacity-75">{item.members.length} مقطع</span></span>
              <ChevronLeft className="h-4 w-4 shrink-0"/>
            </button>;
          })}
          {!filtered.length&&<p className="p-3 text-xs text-slate-500">رشته‌ای پیدا نشد.</p>}
        </div>
        <button type="button" onClick={()=>setCreateMajorOpen(x=>!x)}
          className={action+' mt-3 w-full'} aria-expanded={createMajorOpen}>
          <Plus className="h-4 w-4"/> تعریف رشتهٔ جدید
        </button>
        {createMajorOpen&&<form className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
          onSubmit={e=>{e.preventDefault();void addMajor()}}>
          <label className="block text-xs font-bold">نام رشته
            <input className={field} value={majorName} onChange={e=>setMajorName(e.target.value)}
              maxLength={120} required placeholder="مثلاً مهندسی برق"/>
          </label>
          {meta.degreeLevels.some(d=>d.active!==false)?<label className="block text-xs font-bold">مقطع اولیه
            <select className={field} value={majorDegree||meta.degreeLevels.find(d=>d.active)?.id||''}
              onChange={e=>setMajorDegree(e.target.value)}>
              {meta.degreeLevels.filter(d=>d.active!==false).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>:<label className="block text-xs font-bold">نام مقطع اولیه
            <input className={field} value={newDegreeName} maxLength={120}
              onChange={e=>setNewDegreeName(e.target.value)}
              placeholder="مثلاً کارشناسی پیوسته" required/>
          </label>}
          <button type="submit" disabled={busy!==null} className={action+' w-full bg-blue-700 text-white hover:bg-blue-800'}>
            ثبت رشته
          </button>
        </form>}
      </section>
      {group?<section className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-lg font-black"><BookOpen className="h-5 w-5 text-blue-600"/>{group.label}</h3>
          <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-300">مقطع را انتخاب کن؛ گرایش‌ها و چارت‌های ورودی همان مقطع پایین نمایش داده می‌شوند.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {degreeMajors.map(m=>{
              const d=meta.degreeLevels.find(x=>x.id===m.degreeLevelId);
              return <button key={m.id} type="button" onClick={()=>{setSelectedDegreeId(m.degreeLevelId);setAddingChart(false);setAddingTrack(false);}}
                aria-pressed={currentMajor?.id===m.id}
                className={'min-h-11 rounded-xl border px-4 text-sm font-bold '+
                (currentMajor?.id===m.id?'border-blue-700 bg-blue-700 text-white':'border-slate-200 dark:border-slate-700')}>
                {d?.name||'مقطع نامشخص'}
              </button>;
            })}
          </div>
          <details className="mt-4 rounded-xl border border-dashed border-slate-200 p-3 dark:border-slate-700">
            <summary className="cursor-pointer text-xs font-bold">افزودن مقطع به همین رشته</summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="text-xs">از مقاطع موجود انتخاب کن
                <select className={field} value={newDegreeChoice} onChange={e=>setNewDegreeChoice(e.target.value)}>
                  <option value="">انتخاب مقطع</option>
                  {degreeChoices.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <button type="button" disabled={busy!==null||!newDegreeChoice} onClick={()=>void attachDegree()}
                className={action+' self-end'}>افزودن</button>
            </div>
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void addDegree()}}>
              <label className="min-w-[12rem] flex-1 text-xs">یا مقطع تازه تعریف کن
                <input className={field} value={newDegreeName} onChange={e=>setNewDegreeName(e.target.value)}
                  maxLength={120} placeholder="نام مقطع جدید"/>
              </label>
              <button type="submit" className={action+' self-end'} disabled={busy!==null||!newDegreeName.trim()}>ثبت مقطع تازه</button>
            </form>
          </details>
        </div>
        {currentMajor&&degree&&<>
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h4 className="font-black">گرایش‌های {degree.name}</h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">اعلام گرایش برای دانشجو اختیاری است؛ گرایش را فقط وقتی لازم است تعریف کن.</p></div>
              <button className={action} type="button" onClick={()=>setAddingTrack(x=>!x)}>
                <Plus className="h-4 w-4"/> گرایش جدید
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {tracks.map(t=><div key={t.id} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-bold dark:bg-slate-800">
                <span>{t.name}</span>
                <button type="button" disabled={busy!==null} onClick={()=>void removeTrack(t)}
                  aria-label={`حذف گرایش ${t.name}`} className="rounded-lg p-1 text-rose-700 dark:text-rose-300">
                  <Trash2 className="h-3.5 w-3.5"/>
                </button>
              </div>)}
              {!tracks.length&&<span className="text-xs text-slate-500">هنوز گرایشی برای این مقطع ثبت نشده؛ مشکلی نیست.</span>}
            </div>
            {addingTrack&&<form className="mt-3 flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void addTrack()}}>
              <label className="min-w-[12rem] flex-1 text-xs">نام گرایش
                <input className={field} value={trackName} maxLength={120} required onChange={e=>setTrackName(e.target.value)}
                  placeholder="مثلاً کنترل"/>
              </label>
              <button type="submit" disabled={busy!==null} className={action+' self-end'}>ثبت گرایش</button>
            </form>}
          </section>
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h4 className="flex items-center gap-2 font-black"><Layers className="h-4 w-4 text-blue-600"/> ورودی‌ها و چارت‌ها</h4>
                <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-300">ورودی‌ها به همین رشته و مقطع وصل هستند. چارت جدید همیشه اول «پیش‌نویس» است.</p></div>
              <button type="button" className={action} onClick={()=>setAddingChart(x=>!x)}>
                <Plus className="h-4 w-4"/> چارت ورودی جدید
              </button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {currentCharts.map(c=>{
                const year=meta.entryYears.find(y=>y.id===c.entryYearId)?.year;
                const campus=meta.campuses.find(x=>x.id===c.campusId)?.name||'واحد نامشخص';
                return <article key={c.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm">ورودی {year||'نامشخص'}</strong>
                    <span className="rounded-full bg-white px-2 py-1 text-xs dark:bg-slate-900">
                      {c.status==='active'?'فعال':c.status==='draft'?'پیش‌نویس':'آرشیو'}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs leading-6 text-slate-500 dark:text-slate-300">{campus} · {c.name}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={action} onClick={()=>openChart(c)}>دروس چارت</button>
                    <button type="button" className={action} onClick={()=>openRules(c)}>شرط‌های اخذ</button>
                  </div>
                </article>;
              })}
              {!currentCharts.length&&<p className="rounded-xl bg-slate-50 p-4 text-xs leading-7 dark:bg-slate-800">
                هنوز چارتی وجود ندارد. با «چارت ورودی جدید» اولین پیش‌نویس را بساز.
              </p>}
            </div>
            {addingChart&&<form className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20"
              onSubmit={e=>{e.preventDefault();void createChart()}}>
              <strong className="text-sm">ساخت چارت برای {group.label}، {degree.name}</strong>
              {!meta.campuses.some(c=>c.active!==false)&&<p role="note" className="rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
                هنوز واحد دانشگاهی تعریف نشده است.
                <button type="button" onClick={()=>setSearchParams({tab:'campuses'})}
                  className="mx-2 font-bold underline underline-offset-4">رفتن به تعریف واحد دانشگاهی</button>
              </p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold">واحد دانشگاهی
                  <select className={field} value={selectedCampus?.id||''} onChange={e=>setCampusId(e.target.value)}>
                    {meta.campuses.filter(c=>c.active!==false).map(c=><option key={c.id} value={c.id}>
                      {c.name} · {meta.universities.find(u=>u.id===c.universityId)?.name||'دانشگاه'}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold">ورودی
                  <select className={field} value={selectedYear?.id||''} onChange={e=>setYearId(e.target.value)}>
                    {meta.entryYears.filter(y=>y.active!==false).sort((a,b)=>b.year-a.year)
                      .map(y=><option key={y.id} value={y.id}>ورودی {y.year}</option>)}
                  </select>
                </label>
              </div>
              <details className="rounded-xl border border-dashed border-blue-200 p-3 text-xs dark:border-blue-900">
                <summary className="cursor-pointer font-bold">سال ورودی در فهرست نیست؟</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input type="number" min={1300} max={1600} className={field+' max-w-[12rem]'} value={newYear}
                    onChange={e=>setNewYear(e.target.value)} placeholder="مثلاً ۱۴۰۴"/>
                  <button type="button" disabled={busy!==null} onClick={()=>void createYear()} className={action}>افزودن ورودی</button>
                </div>
              </details>
              <label className="flex min-h-11 items-center gap-2 text-xs">
                <input type="checkbox" checked={advanced} onChange={e=>setAdvanced(e.target.checked)}/>
                تنظیمات بیشتر (نسخه یا عنوان دلخواه چارت)
              </label>
              {advanced&&<div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs">نسخهٔ چارت
                  <input className={field} maxLength={48} value={chartVersion} onChange={e=>setChartVersion(e.target.value)}/>
                </label>
                <label className="text-xs">عنوان دلخواه
                  <input className={field} maxLength={150} value={chartTitle} onChange={e=>setChartTitle(e.target.value)}/>
                </label>
              </div>}
              <button type="submit" className="min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50"
                disabled={busy!==null}>ساخت چارت پیش‌نویس</button>
            </form>}
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
            <p className="text-xs leading-7 text-blue-950 dark:text-blue-100">
              <GraduationCap className="ml-1 inline h-4 w-4"/> آماده‌سازی چارت‌ها مقدمهٔ نیازسنجی است؛ درخواست دانشجو، انتخاب واحد رسمی نیست.
            </p>
            <button type="button" className={action} onClick={goDemand}>رفتن به نیازسنجی <ChevronLeft className="h-4 w-4"/></button>
          </div>
        </>}
      </section>:<div className="rounded-2xl border border-slate-200 p-5 text-sm dark:border-slate-800">
        هنوز رشته‌ای تعریف نشده است. برای شروع، از دکمهٔ «تعریف رشتهٔ جدید» استفاده کن.
      </div>}
    </div>
  </div>;
};
