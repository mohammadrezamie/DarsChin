import { describe,expect,it } from 'vitest';
import { parseDemandQuestions,validateDemandAnswers,summarizeFormAnswers } from '../src/domain/demand-form';
import type { DemandFormQuestion } from '../src/types';

const sample:DemandFormQuestion[]=[
  {id:'time',title:'ساعت پیشنهادی',kind:'single_choice',required:true,options:['صبح','عصر']},
  {id:'week',title:'روزهای مورد علاقه',kind:'multiple_choice',required:false,options:['شنبه','دوشنبه']},
  {id:'reason',title:'توضیحات',kind:'short_text',required:false},
  {id:'notes',title:'توضیح بلند',kind:'long_text',required:false},
  {id:'rating',title:'اهمیت برگزاری',kind:'rating',required:true},
];
describe('فرم‌ساز امن نیازسنجی',()=>{
  it('پنج نوع سؤال حرفه‌ای با گزینه‌ها و الزام پاسخ را می‌پذیرد',()=>{
    expect(parseDemandQuestions(sample)).toEqual({ok:true,questions:sample});
    expect(validateDemandAnswers(sample,{
      time:'صبح',week:['شنبه','دوشنبه'],reason:'درخواست  ',notes:'جزئیات',rating:'5',
    })).toMatchObject({
      ok:true,answers:{time:'صبح',week:['شنبه','دوشنبه'],reason:'درخواست',notes:'جزئیات',rating:'5'},
    });
  });
  it('شناسهٔ تکراری، گزینه تکراری و سؤال ناشناخته را رد می‌کند',()=>{
    expect(parseDemandQuestions([...sample,{...sample[0]}]).ok).toBe(false);
    expect(parseDemandQuestions([{...sample[0],options:['صبح','صبح']}]).ok).toBe(false);
    expect(parseDemandQuestions([{...sample[0],id:'__proto__'}]).ok).toBe(false);
    expect(validateDemandAnswers(sample,{time:'صبح',rating:'3',hacked:'data'}).ok).toBe(false);
    expect(parseDemandQuestions(Array.from({length:21},(_,i)=>({...sample[2],id:'q'+i}))).ok).toBe(false);
  });
  it('هیچ سؤال اجباری بی‌پاسخ یا گزینه جعلی را ذخیره نمی‌کند',()=>{
    expect(validateDemandAnswers(sample,{}).ok).toBe(false);
    expect(validateDemandAnswers(sample,{time:'شب',rating:'5'}).ok).toBe(false);
    expect(validateDemandAnswers(sample,{time:'صبح',week:['شنبه','شنبه'],rating:'5'}).ok).toBe(false);
    expect(validateDemandAnswers(sample,{time:'صبح',rating:'10'}).ok).toBe(false);
    expect(validateDemandAnswers(sample,{time:'صبح',rating:'5',reason:'a'.repeat(501)}).ok).toBe(false);
    expect(validateDemandAnswers(sample,{time:'صبح',rating:'5',notes:'a'.repeat(2001)}).ok).toBe(false);
    expect(validateDemandAnswers(sample,{time:'صبح',rating:'5',week:[{}]}).ok).toBe(false);
  });
  it('سازگاری فرم‌های قدیمی فاقد سؤال سفارشی حفظ می‌شود',()=>{
    expect(parseDemandQuestions(undefined)).toEqual({ok:true,questions:[]});
    expect(validateDemandAnswers([],undefined)).toEqual({ok:true,answers:{}});
    expect(validateDemandAnswers([],{someUnknown:'x'}).ok).toBe(false);
  });
  it('گزارش فقط تعداد گزینه‌ها را دارد و هیچ متن خصوصی منتشر نمی‌کند',()=>{
    const results=summarizeFormAnswers(sample,[
      {answers:{time:'صبح',week:['شنبه'],rating:'4',reason:'اطلاعات شخصی محرمانه'}},
      {answers:{time:'عصر',week:['شنبه','دوشنبه'],rating:'5'}},
    ]);
    expect(results.find(q=>q.id==='time')?.options).toEqual([
      {label:'صبح',count:1},{label:'عصر',count:1},
    ]);
    expect(results.find(q=>q.id==='week')?.options).toEqual([
      {label:'شنبه',count:2},{label:'دوشنبه',count:1},
    ]);
    expect(results.find(q=>q.id==='reason')).toMatchObject({
      answeredCount:1,options:[],textAnswersPrivate:true,
    });
    expect(JSON.stringify(results)).not.toContain('اطلاعات شخصی');
  });
});
