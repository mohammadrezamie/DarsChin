import React from 'react';
import type { DemandFormAnswers, DemandFormQuestion } from '../types';

/** Semantic, mobile-friendly student answer controls. Server revalidates all inputs. */
export const DemandQuestionFields:React.FC<{
  questions:readonly DemandFormQuestion[];
  answers:DemandFormAnswers;
  disabled:boolean;
  onChange:(next:DemandFormAnswers)=>void;
}> = ({questions,answers,disabled,onChange})=>{
  const set=(id:string,value:string|string[])=>onChange({...answers,[id]:value});
  return <div dir="rtl" className="space-y-3" aria-label="سؤال‌های تکمیلی نیازسنجی">
    {questions.map((question,index)=>{
      const answer=answers[question.id];
      const current=typeof answer==='string'?answer:'';
      const currentMany=Array.isArray(answer)?answer:[];
      return <fieldset key={question.id}
        disabled={disabled}
        className="min-w-0 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:p-4">
        <legend className="px-1 text-sm font-black text-slate-950 dark:text-white">
          {(index+1).toLocaleString('fa-IR')}. {question.title}
          {question.required&&<span aria-label="اجباری" className="mr-1 text-rose-600">*</span>}
        </legend>
        {question.description&&<p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
          {question.description}
        </p>}
        {question.kind==='single_choice'&&<div className="grid gap-1.5 sm:grid-cols-2">
          {(question.options||[]).map(option=><label key={option}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
            <input type="radio" name={'demand-q-'+question.id} value={option}
              checked={current===option} onChange={()=>set(question.id,option)}/>
            <span>{option}</span>
          </label>)}
        </div>}
        {question.kind==='multiple_choice'&&<div className="grid gap-1.5 sm:grid-cols-2">
          {(question.options||[]).map(option=><label key={option}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700">
            <input type="checkbox" value={option} checked={currentMany.includes(option)}
              onChange={()=>set(question.id,currentMany.includes(option)?
                currentMany.filter(v=>v!==option):[...currentMany,option])}/>
            <span>{option}</span>
          </label>)}
        </div>}
        {question.kind==='short_text'&&<input type="text" maxLength={500} value={current}
          onChange={e=>set(question.id,e.target.value)}
          placeholder="پاسخ شما" aria-label={question.title}
          className="darschin-field min-h-11 w-full"/>}
        {question.kind==='long_text'&&<textarea rows={4} maxLength={2000} value={current}
          onChange={e=>set(question.id,e.target.value)}
          placeholder="پاسخ تشریحی شما" aria-label={question.title}
          className="darschin-field w-full"/>}
        {question.kind==='rating'&&<div className="flex flex-wrap gap-2" role="group" aria-label="امتیاز از یک تا پنج">
          {['1','2','3','4','5'].map(rating=><label key={rating}
            className={'flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-bold '+
              (current===rating?'border-teal-800 bg-teal-800 text-white':
                'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200')}>
            <input type="radio" name={'demand-q-'+question.id} value={rating}
              checked={current===rating} onChange={()=>set(question.id,rating)}
              className="sr-only"/>
            {Number(rating).toLocaleString('fa-IR')}
          </label>)}
        </div>}
        {!question.required&&current!==''&&question.kind!=='multiple_choice'&&<button type="button"
          disabled={disabled} onClick={()=>set(question.id,'')}
          className="min-h-10 rounded-lg px-2 text-xs font-semibold text-slate-500 underline">
          پاک‌کردن پاسخ اختیاری
        </button>}
      </fieldset>;
    })}
  </div>;
};
