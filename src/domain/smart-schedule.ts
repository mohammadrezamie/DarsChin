import type { CourseEligibilityResult } from '../types';
import { clockMinutes, detectPlanConflicts } from './plan-conflicts';
import { canPrioritizeOffering, orderedChosenCourses } from './student-flow-stage';

export type PresenceDays = 2 | 3 | 4 | 5;
export type ScheduleCriterion = 'fewest-days' | 'my-teachers';
export interface SmartScheduleOption {
  offeringIds: string[];
  offerings: CourseEligibilityResult[];
  days: string[];
  gapsMinutes: number;
  preferencePenalty: number;
}
export interface SmartScheduleOutcome {
  options: SmartScheduleOption[];
  missingCourseIds: string[];
  unverifiedTimeCourseIds: string[];
  approximate: boolean;
}
const DAYS = ['شنبه','یکشنبه','دوشنبه','سهشنبه','چهارشنبه','پنجشنبه','جمعه'];
const normalizeDay = (day: string) => (day || '').replace(/\u200c/g,'').replace(/\s+/g,'').replace(/ي/g,'ی').trim();
function session(item: CourseEligibilityResult) {
  const day=normalizeDay(item.dayOfWeek);
  const start=clockMinutes(item.startTime||'');
  const end=clockMinutes(item.endTime||'');
  return DAYS.includes(day)&&start!==null&&end!==null&&end>start?{day,start,end}:null;
}
function gaps(offerings: readonly CourseEligibilityResult[]) {
  const byDay = new Map<string,{start:number;end:number}[]>();
  for(const o of offerings) {
    const t=session(o);if(!t)continue;
    const list=byDay.get(t.day)||[];list.push(t);byDay.set(t.day,list);
  }
  let total=0;
  for(const list of byDay.values()){
    list.sort((a,b)=>a.start-b.start);
    for(let i=1;i<list.length;i++)total+=Math.max(0,list[i].start-list[i-1].end);
  }
  return total;
}
const conflictInput=(o:CourseEligibilityResult)=>({
  id:o.offeringId,courseId:o.courseId,dayOfWeek:o.dayOfWeek,
  startTime:o.startTime,endTime:o.endTime,examDate:o.examDate,
});
const quality=(o:SmartScheduleOption,criterion:ScheduleCriterion)=>
  criterion==='fewest-days'
    ? o.days.length*500+o.gapsMinutes/3+o.preferencePenalty*12
    : o.preferencePenalty*300+o.days.length*130+o.gapsMinutes/4;

/** Bounded search; no auto enrollment and no fabricated teacher scores/times. */
export function suggestSmartSchedules(args:{
  chosenCourseIds:readonly string[];
  coursePriorities:readonly string[];
  evaluations:readonly CourseEligibilityResult[];
  offeringPriorities:Readonly<Record<string,string[]>>;
  maxDays:PresenceDays;
  criterion:ScheduleCriterion;
  beamWidth?:number;
}):SmartScheduleOutcome {
  const chosen=orderedChosenCourses(args.chosenCourseIds,args.coursePriorities);
  const result:SmartScheduleOutcome={options:[],missingCourseIds:[],unverifiedTimeCourseIds:[],approximate:false};
  if(!chosen.length)return result;
  const groups=chosen.map(courseId=>{
    const eligible=args.evaluations.filter(o=>o.courseId===courseId&&canPrioritizeOffering(o));
    const verified=eligible.filter(o=>session(o)!==null);
    if(!eligible.length)result.missingCourseIds.push(courseId);
    else if(!verified.length)result.unverifiedTimeCourseIds.push(courseId);
    const ranks=args.offeringPriorities[courseId]||[];
    const preference=(o:CourseEligibilityResult)=>{
      const i=ranks.indexOf(o.offeringId);return i>=0?i:ranks.length?ranks.length+1:0;
    };
    verified.sort((a,b)=>preference(a)-preference(b)||a.offeringId.localeCompare(b.offeringId));
    return {courseId,verified,preference};
  });
  if(result.missingCourseIds.length||result.unverifiedTimeCourseIds.length)return result;
  groups.sort((a,b)=>a.verified.length-b.verified.length);
  type State={offerings:CourseEligibilityResult[];days:string[];penalty:number;gaps:number};
  let states:State[]=[{offerings:[],days:[],penalty:0,gaps:0}];
  const width=Math.max(1,Math.min(args.beamWidth??180,400));
  for(const group of groups) {
    const next:State[]=[];
    for(const state of states)for(const offering of group.verified){
      const days=[...new Set([...state.days,normalizeDay(offering.dayOfWeek)])]
        .sort((a,b)=>DAYS.indexOf(a)-DAYS.indexOf(b));
      if(days.length>args.maxDays)continue;
      const offerings=[...state.offerings,offering];
      if(detectPlanConflicts(offerings.map(conflictInput)).length)continue;
      next.push({offerings,days,penalty:state.penalty+group.preference(offering),gaps:gaps(offerings)});
    }
    const toOpt=(state:State):SmartScheduleOption=>({
      offerings:state.offerings,days:state.days,gapsMinutes:state.gaps,
      preferencePenalty:state.penalty,offeringIds:state.offerings.map(o=>o.offeringId),
    });
    next.sort((a,b)=>quality(toOpt(a),args.criterion)-quality(toOpt(b),args.criterion)||
      a.offerings.map(o=>o.offeringId).join('|').localeCompare(b.offerings.map(o=>o.offeringId).join('|')));
    if(next.length>width)result.approximate=true;
    states=next.slice(0,width);
    if(!states.length)break;
  }
  const unique=new Set<string>();
  result.options=states.map(s=>{
    const offerings=chosen.map(id=>s.offerings.find(o=>o.courseId===id)!).filter(Boolean);
    return {offerings,offeringIds:offerings.map(o=>o.offeringId),days:s.days,
      gapsMinutes:s.gaps,preferencePenalty:s.penalty};
  }).filter(s=>{
    if(s.offerings.length!==chosen.length)return false;
    const key=s.offeringIds.join('|');
    if(unique.has(key))return false;
    unique.add(key);return true;
  }).slice(0,3);
  return result;
}
