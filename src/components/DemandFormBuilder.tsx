import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import type { DemandFormQuestion, DemandQuestionKind, DemandFormAnswers } from '../types';
import { DemandQuestionFields } from './DemandQuestionFields';
import { demandCourseSurveyStarter } from '../domain/demand-form-presets';
import { parseDemandQuestions } from '../domain/demand-form';

const TYPES:{kind:DemandQuestionKind;label:string}[]=[
  {kind:'single_choice',label:'چندگزینه‌ای (یک پاسخ)'},
  {kind:'multiple_choice',label:'چک‌باکس (چند پاسخ)'},
  {kind:'short_text',label:'پاسخ کوتاه'},
  {kind:'long_text',label:'پاسخ تشریحی'},
  {kind:'rating',label:'امتیاز ۱ تا ۵'},
];
const isChoice=(q:DemandFormQuestion)=>q.kind==='single_choice'||q.kind==='multiple_choice';
const freshQuestion=():DemandFormQuestion=>({
  id:'q_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9),
  kind:'single_choice',title:'',required:false,options:['گزینه اول','گزینه دوم'],
});

/** No arbitrary HTML, scripts, attachments or question logic; all questions are server validated. */
export const DemandFormBuilder:React.FC<{
  value:DemandFormQuestion[];onChange:(next:DemandFormQuestion[])=>void;
  disabled?:boolean;
}> = ({value,onChange,disabled=false})=>{
  const [preview,setPreview]=useState(false);
  const [previewAnswers,setPreviewAnswers]=useState<DemandFormAnswers>({});
  const update=(index:number,change:Partial<DemandFormQuestion>)=>
    onChange(value.map((q,i)=>i===index?{...q,...change}:q));
  const move=(index:number,delta:number)=>{
    const to=index+delta;if(to<0||to>=value.length)return;
    const next=[...value];[next[index],next[to]]=[next[to],next[index]];
    onChange(next);
  };
  const status=parseDemandQuestions(value);
  return <section aria-label="فرم‌ساز سؤال‌های اختصاصی" dir="rtl"
    className="rounded-2xl border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900 dark:bg-violet-950/20 sm:p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h4 className="text-sm font-black text-violet-950 dark:text-violet-100">
          سؤال‌های اختصاصی فرم
        </h4>
        <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
          شبیه فرم‌سازهای حرفه‌ای، سؤال بساز؛ نوع، گزینه‌ها، اجباری بودن و ترتیبشان را تنظیم کن.
          اطلاعات درسی و ورودی همچنان از پروندهٔ دانشجو دریافت می‌شوند.
        </p>
      </div>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-800 dark:bg-slate-900 dark:text-violet-200">
        {value.length.toLocaleString('fa-IR')} از ۲۰ سؤال
      </span>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={disabled||value.length>=20}
        onClick={()=>onChange([...value,freshQuestion()])}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-800 px-4 text-xs font-black text-white disabled:opacity-40">
        <Plus className="h-4 w-4"/> افزودن سؤال جدید
      </button>
      <button type="button" disabled={disabled||value.length!==0}
        onClick={()=>{onChange(demandCourseSurveyStarter());setPreviewAnswers({});}}
        className="min-h-11 rounded-xl border border-teal-300 bg-teal-50 px-3 text-xs font-black text-teal-900 disabled:opacity-40 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
        الگوی آماده نیازسنجی دانشگاهی
      </button>
      <button type="button" disabled={!value.length} aria-pressed={preview}
        onClick={()=>setPreview(p=>!p)}
        className="min-h-11 rounded-xl border border-violet-300 px-3 text-xs font-bold text-violet-950 dark:text-violet-100 disabled:opacity-40">
        {preview?'بازگشت به ویرایش':'پیش‌نمایش سؤال‌ها'}
      </button>
    </div>
    {!value.length&&<p className="mt-3 rounded-xl bg-white p-3 text-xs leading-6 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
      افزودن سؤال اختیاری است؛ فرم سادهٔ انتخاب درس مثل قبل کار می‌کند. برای فرم‌های پیشرفته، سؤال سفارشی اضافه کن.
    </p>}
    {preview&&<div className="mt-3 rounded-2xl border border-teal-200 bg-white p-3 dark:border-teal-900 dark:bg-slate-900"
      aria-label="پیش‌نمایش تعاملی فرم">
      <p className="mb-3 text-xs font-bold text-teal-900 dark:text-teal-200">
        پیش‌نمایش تعاملی: پاسخ‌های آزمایشی ذخیره یا برای دانشجویان ارسال نمی‌شوند.
      </p>
      <DemandQuestionFields questions={value} answers={previewAnswers}
        disabled={false} onChange={setPreviewAnswers}/>
    </div>}
    <div className="mt-3 space-y-3">
      {!preview&&value.map((question,index)=><article key={question.id}
        className="rounded-2xl border border-violet-200 bg-white p-3 shadow-xs dark:border-violet-900 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-xs font-black text-violet-900 dark:text-violet-200">
            سؤال {(index+1).toLocaleString('fa-IR')}
          </strong>
          {!preview&&<div className="flex flex-wrap gap-1">
            <button type="button" aria-label="انتقال سؤال به بالا" title="بالا"
              disabled={disabled||index===0} onClick={()=>move(index,-1)}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border disabled:opacity-30">
              <ArrowUp className="h-4 w-4"/>
            </button>
            <button type="button" aria-label="انتقال سؤال به پایین" title="پایین"
              disabled={disabled||index===value.length-1} onClick={()=>move(index,1)}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border disabled:opacity-30">
              <ArrowDown className="h-4 w-4"/>
            </button>
            <button type="button" aria-label="تکثیر سؤال" title="تکثیر"
              disabled={disabled||value.length>=20} onClick={()=>onChange([
                ...value.slice(0,index+1),{...question,id:freshQuestion().id},...value.slice(index+1)
              ])} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border disabled:opacity-30">
              <Copy className="h-4 w-4"/>
            </button>
            <button type="button" aria-label="حذف سؤال" title="حذف" disabled={disabled}
              onClick={()=>onChange(value.filter((_,i)=>i!==index))}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-rose-300 text-rose-700 disabled:opacity-30">
              <Trash2 className="h-4 w-4"/>
            </button>
          </div>}
        </div>
        {preview?<div className="mt-2 space-y-2">
          <p className="text-sm font-bold">{question.title||'عنوان سؤال هنوز مشخص نشده'}
            {question.required&&<span className="mr-1 text-rose-600"> * </span>}
          </p>
          {question.description&&<p className="text-xs text-slate-500">{question.description}</p>}
          {question.visibleWhen&&<p className="rounded-lg bg-violet-50 px-2 py-1 text-xs text-violet-800 dark:bg-violet-950 dark:text-violet-200">
            نمایش شرطی: وقتی پاسخ سؤال مرتبط «{question.visibleWhen.equals}» باشد
          </p>}
          {isChoice(question)?<div className="space-y-1 text-xs">{question.options?.map(option=>
            <p key={option}>{question.kind==='single_choice'?'◯':'□'} {option}</p>)}</div>:
            <p className="text-xs text-slate-500">
              {question.kind==='rating'?'☆ ☆ ☆ ☆ ☆':question.kind==='short_text'?'پاسخ کوتاه…':'پاسخ تشریحی…'}
            </p>}
        </div>:<div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold sm:col-span-2">عنوان سؤال
            <input value={question.title} disabled={disabled} maxLength={160}
              onChange={e=>update(index,{title:e.target.value})}
              placeholder="مثلاً ترجیح شما برای ساعت برگزاری کلاس چیست؟"
              className="darschin-field mt-1 min-h-11"/>
          </label>
          <label className="text-xs font-bold">نوع سؤال
            <select value={question.kind} disabled={disabled}
              onChange={e=>{
                const kind=e.target.value as DemandQuestionKind;
                update(index,{kind,options:kind==='single_choice'||kind==='multiple_choice'?
                  question.options?.length?question.options:['گزینه اول','گزینه دوم']:undefined});
              }}
              className="darschin-field mt-1 min-h-11">
              {TYPES.map(t=><option key={t.kind} value={t.kind}>{t.label}</option>)}
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 self-end text-xs font-bold">
            <input type="checkbox" checked={question.required} disabled={disabled}
              onChange={e=>update(index,{required:e.target.checked})}/>
            پاسخ اجباری باشد
          </label>
          <label className="text-xs font-bold sm:col-span-2">توضیح راهنما (اختیاری)
            <textarea rows={2} maxLength={400} value={question.description||''} disabled={disabled}
              onChange={e=>update(index,{description:e.target.value})}
              className="darschin-field mt-1"/>
          </label>
          <div className="space-y-2 rounded-xl border border-dashed border-violet-200 p-3 dark:border-violet-800 sm:col-span-2">
            <label className="block text-xs font-bold">قانون نمایش هوشمند سؤال
              <select aria-label={'شرط نمایش سؤال '+(index+1)}
                value={question.visibleWhen?.questionId||''} disabled={disabled}
                onChange={e=>{
                  const parent=value.slice(0,index).find(q=>q.id===e.target.value);
                  update(index,{visibleWhen:parent?{
                    questionId:parent.id,
                    equals:parent.kind==='rating'?'1':parent.options?.[0]||'',
                  }:undefined});
                }} className="darschin-field mt-1 min-h-11">
                <option value="">همیشه نمایش داده شود</option>
                {value.slice(0,index).filter(q=>q.kind==='single_choice'||q.kind==='rating').map(parent=>
                  <option key={parent.id} value={parent.id}>
                    فقط پس از پاسخ به «{parent.title||'سؤال بدون عنوان'}»
                  </option>)}
              </select>
            </label>
            {question.visibleWhen&&<label className="block text-xs font-bold">وقتی پاسخ سؤال قبلی برابر باشد با
              <select value={question.visibleWhen.equals} disabled={disabled}
                onChange={e=>update(index,{visibleWhen:{...question.visibleWhen!,equals:e.target.value}})}
                className="darschin-field mt-1 min-h-11">
                {(()=>{
                  const parent=value.find(q=>q.id===question.visibleWhen?.questionId);
                  const choices=parent?.kind==='rating'?['1','2','3','4','5']:parent?.options||[];
                  return choices.map(choice=><option key={choice} value={choice}>{choice}</option>);
                })()}
              </select>
            </label>}
            <p className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">
              شرط فقط به سؤال تک‌انتخابی یا امتیازیِ بالاتر در همین فرم متصل می‌شود.
              پاسخ سؤال‌های پنهان ذخیره نمی‌شوند.
            </p>
          </div>
          {isChoice(question)&&<fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-xs font-black">گزینه‌های پاسخ</legend>
            {question.options?.map((option,i)=><div key={i} className="flex items-center gap-2">
              <input aria-label={'متن گزینه '+(i+1)} maxLength={120} value={option} disabled={disabled}
                onChange={e=>update(index,{options:question.options?.map((old,j)=>j===i?e.target.value:old)})}
                className="darschin-field min-h-11 flex-1"/>
              <button type="button" aria-label={'حذف گزینه '+(i+1)}
                disabled={disabled||(question.options?.length||0)<=2}
                onClick={()=>update(index,{options:question.options?.filter((_,j)=>i!==j)})}
                className="min-h-11 min-w-11 rounded-lg border border-rose-300 text-rose-700 disabled:opacity-30">
                <Trash2 className="mx-auto h-4 w-4"/>
              </button>
            </div>)}
            <button type="button" disabled={disabled||(question.options?.length||0)>=15}
              onClick={()=>update(index,{options:[...(question.options||[]),'']})}
              className="min-h-10 rounded-lg border border-violet-300 px-3 text-xs font-bold disabled:opacity-40">
              افزودن گزینه
            </button>
          </fieldset>}
        </div>}
      </article>)}
    </div>
    {!status.ok&&<p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      {status.error} پیش از ذخیره، عنوان و گزینه‌ها را تکمیل کن.
    </p>}
    <p className="mt-3 text-[11px] leading-6 text-slate-600 dark:text-slate-300">
      پس از انتشار فرم، سؤال‌ها برای حفظ اعتبار پاسخ‌های قبلی قفل می‌شوند.
      آپلود فایل، شرط‌های شاخه‌ای و ارسال ناشناس هنوز در این نسخه پشتیبانی نمی‌شوند.
    </p>
  </section>;
};
