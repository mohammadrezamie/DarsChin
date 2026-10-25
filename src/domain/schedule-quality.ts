import type { CourseEligibilityResult } from '../types';
import type { TeacherRatingSummary } from './teacher-ratings';

export type QualityOffering = Pick<CourseEligibilityResult,
  'offeringId'|'courseId'|'courseName'|'dayOfWeek'|'startTime'|'endTime'|'instructor'|'examDate'|'canSelect'|'isEligible'|'overallStatus'>;
export interface ScheduleQuality {
  dayScore: number | null;
  activeDays: number | null;
  minimumDays: number | null;
  maximumDays: number | null;
  searchedExactly: boolean;
  dayReason: string;
  professorScore: number | null;
  ratedCount: number;
  selectedCount: number;
  ratingVotes: number;
  teacherReason: string;
  recommendedFewestDays: string[];
  recommendedTeachers: string[];
  suggestedDays: number | null;
  suggestedProfessorScore: number | null;
}
const dayLabels=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
const ascii=(v:string)=>v.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
const day=(s:string)=>dayLabels.find(d=>d.replace(/‌|\s/g,'')===s.replace(/‌|\s/g,''));
const minutes=(s:string):number|null=>{
  if(!/^\s*\d{1,2}:\d{2}\s*$/.test(ascii(s)))return null;
  const [h,m]=ascii(s.trim()).split(':').map(Number);
  return h<24&&m<60?h*60+m:null;
};
const clock=(o:QualityOffering)=>{
  const d=day(o.dayOfWeek||'');
  const start=minutes(o.startTime||''),end=minutes(o.endTime||'');
  return d && start!==null && end!==null && end>start?{d,start,end}:null;
};
const valid=(o:QualityOffering)=>o.canSelect===true&&o.isEligible===true&&o.overallStatus==='AVAILABLE';
const teacherKey=(c:string,i:string)=>JSON.stringify([c,i.trim()]);
const teacherScore=(o:QualityOffering, summaries:TeacherRatingSummary[]):number|null=>{
  const available=summaries.filter(r=>r.courseId===o.courseId&&r.average!==null&&r.sampleSize>=3);
  const thisTeacher=available.find(r=>r.instructor.trim()===o.instructor.trim());
  if(!thisTeacher||thisTeacher.average===null)return null;
  const grades=available.map(r=>r.average!);
  const lo=Math.min(...grades),hi=Math.max(...grades);
  // A relative 0–100 score is meaningful only if multiple rated choices exist.
  // Otherwise use the documented absolute one-to-five scale.
  return Math.round(hi>lo ? (thisTeacher.average-lo)/(hi-lo)*100 :
    (thisTeacher.average-1)/4*100);
};
const overlap=(a:QualityOffering,b:QualityOffering):boolean=>{
  const x=clock(a),y=clock(b);
  return !!x&&!!y&&x.d===y.d&&x.start<y.end&&y.start<x.end;
};
const examClash=(a:QualityOffering,b:QualityOffering):boolean=>{
  // A string equality is enough to flag an explicit exact exam collision,
  // but unknown or merely same-day exams require a separate human review.
  return !!a.examDate&&!!b.examDate&&a.examDate===b.examDate;
};
const compatible=(one:QualityOffering,chosen:QualityOffering[])=>
  !chosen.some(other=>overlap(one,other)||examClash(one,other));
const countDays=(offers:QualityOffering[])=>new Set(offers.map(o=>clock(o)?.d).filter(Boolean)).size;
const score=(days:number,min:number,max:number)=>
  max===min?100:Math.max(0,Math.min(100,Math.round((max-days)/(max-min)*100)));
const mean=(values:number[])=>values.length?
  Math.round(values.reduce((sum,n)=>sum+n,0)/values.length):null;

/**
 * A quality suggestion can replace sections, never change the student's
 * chosen course set. Pure helper shared by server and browser-only demo.
 */
export function preservesSelectedCourses(
  previous:string[],proposed:string[],
  offeringRefs:ReadonlyArray<{offeringId:string;courseId:string}>,
):boolean {
  const mapping=new Map(offeringRefs.map(o=>[o.offeringId,o.courseId]));
  const courseList=(ids:string[])=>ids.map(id=>mapping.get(id));
  if(!previous.length || previous.length!==proposed.length ||
    new Set(previous).size!==previous.length ||
    new Set(proposed).size!==proposed.length)return false;
  const before=courseList(previous),after=courseList(proposed);
  if(before.some(id=>!id)||after.some(id=>!id))return false;
  if(new Set(before).size!==before.length||new Set(after).size!==after.length)
    return false;
  const oldSet=new Set(before);
  return after.every(id=>oldSet.has(id));
}

export function evaluateScheduleQuality(
  all:QualityOffering[],selectedIds:string[],ratings:TeacherRatingSummary[]=[],
  maxVisits=40000,
):ScheduleQuality {
  const lookup=new Map(all.map(o=>[o.offeringId,o]));
  const selected=selectedIds.map(id=>lookup.get(id)).filter((o):o is QualityOffering=>!!o);
  const courses=[...new Set(selected.map(o=>o.courseId))];
  // Unclean imported plans can contain two groups for one course. Do not let
  // them double-weight that course in the teacher-quality indicator.
  const distinctSelected=selected.filter((o,index)=>
    selected.findIndex(item=>item.courseId===o.courseId)===index);
  const ratedCourses=new Map(ratings.filter(r=>r.average!==null&&r.sampleSize>=3)
    .map(r=>[teacherKey(r.courseId,r.instructor),r]));
  const scored=distinctSelected.map(o=>teacherScore(o,ratings));
  const knownScores=scored.filter((s):s is number=>s!==null);
  const ratingVotes=distinctSelected.reduce((sum,o)=>
    sum+(ratedCourses.get(teacherKey(o.courseId,o.instructor))?.sampleSize||0),0);
  const teacherReason= !selected.length?'اول درس و گروه انتخاب کن.' :
    !knownScores.length?'هنوز هیچ استاد انتخاب‌شده‌ای تعداد رأی کافی برای امتیازدهی ندارد.' :
    knownScores.length<courses.length?`برای ${knownScores.length} درس از ${courses.length} درس امتیاز معتبر داریم؛ بقیه در میانگین لحاظ نشده‌اند.`:
    'میانگین برابر هر درس، بر پایهٔ ارزشیابی منتشرشدهٔ همان استاد در همان درس.';
  const base={
    professorScore:mean(knownScores),ratedCount:knownScores.length,
    selectedCount:courses.length,ratingVotes,teacherReason,
  };
  const fail=(reason:string):ScheduleQuality=>({
    ...base,dayScore:null,activeDays:null,minimumDays:null,maximumDays:null,
    searchedExactly:false,dayReason:reason,recommendedFewestDays:[],
    recommendedTeachers:[],suggestedDays:null,suggestedProfessorScore:null,
  });
  if(!courses.length)return fail('برای محاسبهٔ روزهای حضور، ابتدا چند درس را در برنامه قرار بده.');
  if(selected.length!==selectedIds.length)
    return fail('یک یا چند گروه انتخاب‌شده در دادهٔ فعلی وجود ندارد؛ برنامه را دوباره بارگذاری کن.');
  if(selected.length!==courses.length)
    return fail('برای محاسبهٔ دقیق، از هر درس تنها یک گروه اصلی باید انتخاب شود.');
  if(selected.some(o=>!clock(o)))
    return fail('روز یا ساعت بعضی گروه‌های منتخب نامشخص است؛ نمرهٔ روزهای حضور محاسبه نشد.');
  if(selected.some(o=>!valid(o)))
    return fail('برای بعضی گروه‌ها وضعیت مجازبودن قطعی نیست؛ امتیاز روزهای حضور متوقف است.');
  if(selected.some((o,i)=>selected.slice(i+1).some(other=>overlap(o,other)||examClash(o,other))))
    return fail('گروه‌های انتخاب‌شده تداخل دارند؛ اول تداخل را رفع کن.');

  const allOptions=courses.map(id=>all.filter(o=>o.courseId===id&&valid(o)&&!!clock(o))
    .sort((a,b)=>a.offeringId.localeCompare(b.offeringId)));
  const options=allOptions.map((items,index)=>{
    const chosen=selected.find(o=>o.courseId===courses[index]);
    const preview=items.slice(0,12);
    // When options are bounded, always retain the student's own known-valid
    // selection so a feasible current plan is never omitted from discovery.
    return chosen && !preview.some(o=>o.offeringId===chosen.offeringId)
      ? [...preview.slice(0,11),chosen] : preview;
  });
  const optionsLimited=allOptions.some(items=>items.length>12);
  if(options.some(group=>group.length===0))
    return fail('برای یک یا چند درس هیچ گروه دارای ساعت معتبر و وضعیت قابل‌اخذ وجود ندارد.');
  let visits=0,truncated=optionsLimited,min=Infinity,max=-Infinity;
  let bestFew:QualityOffering[]=[];let bestTeacher:QualityOffering[]=[];
  let bestKnown=-1,bestTeacherScore=-1;
  const dfs=(depth:number,chosen:QualityOffering[])=>{
    if(visits>=maxVisits){truncated=true;return;}
    visits++;
    if(depth===options.length){
      const days=countDays(chosen);
      min=Math.min(min,days);max=Math.max(max,days);
      const teacherValues=chosen.map(o=>teacherScore(o,ratings)).filter((v):v is number=>v!==null);
      const avg=mean(teacherValues)??-1;
      if(!bestFew.length||days<countDays(bestFew)||
        (days===countDays(bestFew)&&avg>(mean(bestFew.map(o=>teacherScore(o,ratings))
          .filter((v):v is number=>v!==null))??-1)))bestFew=[...chosen];
      if(teacherValues.length>bestKnown||
        (teacherValues.length===bestKnown&&(avg>bestTeacherScore||
          (avg===bestTeacherScore&&days<countDays(bestTeacher))))){
        bestKnown=teacherValues.length;bestTeacherScore=avg;bestTeacher=[...chosen];
      }
      return;
    }
    for(const option of options[depth]){
      if(!compatible(option,chosen))continue;
      chosen.push(option);dfs(depth+1,chosen);chosen.pop();
      if(visits>=maxVisits){truncated=true;return;}
    }
  };
  // Do not skip the search entirely just because option lists were truncated.
  const incompleteOptions=optionsLimited;
  truncated=false;
  dfs(0,[]);
  truncated ||= incompleteOptions;
  if(!bestFew.length)return fail('برای این ترکیب دروس، چیدمان بدون تداخل پیدا نشد.');
  const currentDays=countDays(selected);
  // Always include the current valid plan when a bounded search is incomplete.
  min=Math.min(min,currentDays);max=Math.max(max,currentDays);
  const suggestedFew=bestFew.map(o=>o.offeringId);
  const suggestedTeacher=bestTeacher.map(o=>o.offeringId);
  const suggestedRatings=bestTeacher.map(o=>teacherScore(o,ratings))
    .filter((v):v is number=>v!==null);
  return {
    ...base,dayScore:truncated?null:score(currentDays,min,max),activeDays:currentDays,
    minimumDays:min,maximumDays:max,searchedExactly:!truncated,
    dayReason:truncated?
      'جست‌وجوی گزینه‌ها به سقف محاسبات رسید؛ حداقل/حداکثر نمایش‌داده‌شده تقریبی‌اند و نمرهٔ قطعی نمی‌دهیم.':
      `بر اساس ترکیب‌های بدون تداخل همین ${courses.length} درس؛ ۱۰۰ یعنی کمترین روزِ ممکن و ۰ یعنی بیشترین روزِ ممکن.`,
    recommendedFewestDays:suggestedFew,
    recommendedTeachers:bestKnown===courses.length?suggestedTeacher:[],
    suggestedDays:countDays(bestFew),suggestedProfessorScore:mean(suggestedRatings),
  };
}
