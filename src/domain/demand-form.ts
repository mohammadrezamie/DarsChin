import type {
  DemandFormAnswers, DemandFormQuestion, DemandQuestionKind, DemandResponse,
} from '../types';

const KINDS:DemandQuestionKind[]=[
  'single_choice','multiple_choice','short_text','long_text','rating',
];
const CHOICES=new Set<DemandQuestionKind>(['single_choice','multiple_choice']);
const IDS=/^[A-Za-z0-9_-]{1,64}$/;
const MAX_QUESTIONS=20;
const MAX_OPTIONS=15;

export function parseDemandQuestions(input:unknown):{
  ok:boolean;questions:DemandFormQuestion[];error?:string;
} {
  if(input===undefined)return {ok:true,questions:[]};
  if(!Array.isArray(input)||input.length>MAX_QUESTIONS)
    return {ok:false,questions:[],error:'حداکثر ۲۰ سؤال برای هر فرم مجاز است.'};
  const seen=new Set<string>();
  const previous=new Map<string,DemandFormQuestion>();
  const questions:DemandFormQuestion[]=[];
  for(const candidate of input){
    if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))
      return {ok:false,questions:[],error:'تعریف سؤال معتبر نیست.'};
    const q=candidate as Record<string,unknown>;
    if(Object.keys(q).some(key=>!['id','kind','title','description','required','options','visibleWhen'].includes(key))||
      typeof q.id!=='string'||!IDS.test(q.id)||['__proto__','constructor','prototype'].includes(q.id)||seen.has(q.id)||
      typeof q.title!=='string'||!q.title.trim()||q.title.trim().length>160||
      !KINDS.includes(q.kind as DemandQuestionKind)||typeof q.required!=='boolean'||
      (q.description!==undefined&&(typeof q.description!=='string'||q.description.length>400)))
      return {ok:false,questions:[],error:'شناسه، عنوان، نوع یا اجباری‌بودن سؤال معتبر نیست.'};
    seen.add(q.id);
    const kind=q.kind as DemandQuestionKind;
    const question:DemandFormQuestion={
      id:q.id,kind,title:q.title.trim(),required:q.required,
      ...(typeof q.description==='string'&&q.description.trim()?{description:q.description.trim()}:{}),
    };
    if(CHOICES.has(kind)){
      if(!Array.isArray(q.options)||q.options.length<2||q.options.length>MAX_OPTIONS)
        return {ok:false,questions:[],error:'سؤال گزینه‌ای باید بین ۲ تا ۱۵ گزینه داشته باشد.'};
      if(q.options.some(option=>typeof option!=='string'||!option.trim()||option.trim().length>120))
        return {ok:false,questions:[],error:'متن گزینه معتبر نیست.'};
      const options=q.options.map(option=>(option as string).trim());
      if(new Set(options).size!==options.length)
        return {ok:false,questions:[],error:'گزینه تکراری در سؤال مجاز نیست.'};
      question.options=options;
    } else if(q.options!==undefined&&(!(Array.isArray(q.options))||q.options.length>0)){
      return {ok:false,questions:[],error:'این نوع سؤال گزینهٔ انتخابی ندارد.'};
    }
    if(q.visibleWhen!==undefined){
      if(!q.visibleWhen||typeof q.visibleWhen!=='object'||Array.isArray(q.visibleWhen))
        return {ok:false,questions:[],error:'شرط نمایش سؤال معتبر نیست.'};
      const rule=q.visibleWhen as Record<string,unknown>;
      if(Object.keys(rule).some(key=>!['questionId','equals'].includes(key))||
        typeof rule.questionId!=='string'||typeof rule.equals!=='string') {
        return {ok:false,questions:[],error:'شرط نمایش باید به یک پاسخ مشخص اشاره کند.'};
      }
      // Only a PREVIOUS single-choice or rating controller can be referenced;
      // this prevents loops, hidden future controllers and ambiguous conditions.
      const controller=previous.get(rule.questionId);
      if(!controller||!['single_choice','rating'].includes(controller.kind)||
        (controller.kind==='single_choice'&&!controller.options?.includes(rule.equals))||
        (controller.kind==='rating'&&!['1','2','3','4','5'].includes(rule.equals))) {
        return {ok:false,questions:[],
          error:'شرط نمایش باید به یک گزینهٔ معتبر از سؤال تک‌انتخابی یا امتیازیِ قبلی اشاره کند.'};
      }
      question.visibleWhen={questionId:rule.questionId,equals:rule.equals};
    }
    questions.push(question);
    previous.set(question.id,question);
  }
  return {ok:true,questions};
}

/** Questions may depend on an earlier answer. Earlier hidden controls never trigger descendants. */
export function visibleDemandQuestions(
  questions:readonly DemandFormQuestion[],answers:Readonly<DemandFormAnswers>,
):DemandFormQuestion[] {
  const shown=new Set<string>();
  const result:DemandFormQuestion[]=[];
  for(const question of questions){
    const condition=question.visibleWhen;
    if(condition&&(!shown.has(condition.questionId)||
      answers[condition.questionId]!==condition.equals))continue;
    shown.add(question.id);result.push(question);
  }
  return result;
}

/** Remove answers that are now hidden when a student changes a controlling choice. */
export function pruneDemandAnswers(
  questions:readonly DemandFormQuestion[],answers:DemandFormAnswers,
):DemandFormAnswers {
  const visible=new Set(visibleDemandQuestions(questions,answers).map(q=>q.id));
  return Object.fromEntries(Object.entries(answers).filter(([id])=>visible.has(id)));
}

/** Validates even when a crafted client bypasses all browser controls. */
export function validateDemandAnswers(questions:readonly DemandFormQuestion[],value:unknown):{
  ok:boolean;answers:DemandFormAnswers;error?:string;
} {
  if(value===undefined)value={};
  if(!value||typeof value!=='object'||Array.isArray(value))
    return {ok:false,answers:{},error:'پاسخ سؤال‌های فرم معتبر نیست.'};
  const raw=value as Record<string,unknown>;
  const ids=new Set(questions.map(q=>q.id));
  const fields=Object.keys(raw);
  if(fields.length>MAX_QUESTIONS||fields.some(id=>!ids.has(id)))
    return {ok:false,answers:{},error:'پاسخ مربوط به سؤال ناشناخته یا فرم دیگری است.'};
  const answers:DemandFormAnswers={};
  for(const q of questions){
    const condition=q.visibleWhen;
    if(condition&&answers[condition.questionId]!==condition.equals){
      if(Object.prototype.hasOwnProperty.call(raw,q.id))
        return {ok:false,answers:{},error:'پاسخ سؤال مخفی یا خارج از مسیر فرم قابل ثبت نیست.'};
      continue;
    }
    const value=raw[q.id];
    const empty=value===undefined||value===null||value===''||
      (Array.isArray(value)&&value.length===0);
    if(empty){
      if(q.required)return {ok:false,answers:{},error:'پاسخ سؤال اجباری «'+q.title+'» لازم است.'};
      continue;
    }
    if(q.kind==='multiple_choice'){
      if(!Array.isArray(value)||value.length>MAX_OPTIONS||
        value.some(v=>typeof v!=='string'||!(q.options||[]).includes(v))||
        new Set(value).size!==value.length){
        return {ok:false,answers:{},error:'گزینه‌های سؤال «'+q.title+'» معتبر نیست.'};
      }
      if(value.length)answers[q.id]=value as string[];
      continue;
    }
    if(typeof value!=='string')
      return {ok:false,answers:{},error:'نوع پاسخ سؤال «'+q.title+'» معتبر نیست.'};
    if(q.kind==='single_choice'&&!(q.options||[]).includes(value))
      return {ok:false,answers:{},error:'گزینهٔ سؤال «'+q.title+'» در فرم تعریف نشده است.'};
    if(q.kind==='rating'&&!['1','2','3','4','5'].includes(value))
      return {ok:false,answers:{},error:'امتیاز باید بین ۱ تا ۵ باشد.'};
    if((q.kind==='short_text'||q.kind==='long_text')&&
      (!value.trim()||value.length>(q.kind==='short_text'?500:2000)))
      return {ok:false,answers:{},error:'متن پاسخ سؤال «'+q.title+'» بیش از حد مجاز یا خالی است.'};
    answers[q.id]=q.kind==='short_text'||q.kind==='long_text'?value.trim():value;
  }
  if(JSON.stringify(answers).length>12000)
    return {ok:false,answers:{},error:'حجم کل پاسخ‌های فرم بیش از حد مجاز است.'};
  return {ok:true,answers};
}

/** Aggregate choice/rating answers only; never reveal free-text response contents to demand.manage. */
export function summarizeFormAnswers(
  questions:readonly DemandFormQuestion[],responses:readonly Pick<DemandResponse,'answers'>[],
){
  return questions.map(question=>{
    const count:Record<string,number>={};
    const options=question.kind==='rating'?['1','2','3','4','5']:question.options||[];
    if(question.kind==='single_choice'||question.kind==='multiple_choice'||question.kind==='rating')
      for(const option of options)count[option]=0;
    let answeredCount=0;
    for(const response of responses){
      const answer=response.answers?.[question.id];
      if(!answer||(Array.isArray(answer)&&!answer.length))continue;
      answeredCount++;
      if(question.kind==='short_text'||question.kind==='long_text')continue;
      for(const option of Array.isArray(answer)?answer:[answer])
        if(Object.prototype.hasOwnProperty.call(count,option))count[option]++;
    }
    return {
      id:question.id,title:question.title,kind:question.kind,
      answeredCount,options:Object.entries(count).map(([label,count])=>({label,count})),
      textAnswersPrivate:question.kind==='short_text'||question.kind==='long_text',
    };
  });
}
