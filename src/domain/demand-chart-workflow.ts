import type { Course, Curriculum, CurriculumCourse, User } from '../types';

export interface DemandChartScope {
  universityId: string;
  campusId: string;
  degreeLevelId: string;
  majorId: string;
  entryYearId: string;
}
export const emptyDemandChartScope=():DemandChartScope=>({
  universityId:'',campusId:'',degreeLevelId:'',majorId:'',entryYearId:'',
});
export type DemandScopeField=keyof DemandChartScope;
const fields:DemandScopeField[]=['universityId','campusId','degreeLevelId','majorId','entryYearId'];

/** Hide manager-inaccessible charts in the selector. The server remains authoritative. */
export function manageableDemandCharts(charts:readonly Curriculum[],user:Pick<User,'roles'|'permissions'|'demandScopes'>|null|undefined):Curriculum[] {
  if (!user) return [];
  if(user.roles.includes('super-admin')||user.permissions?.includes('curriculum.manage'))
    return charts.filter(chart=>chart.status!=='archived');
  if(!user.roles.includes('admin')||!user.permissions?.includes('demand.manage'))return [];
  return charts.filter(chart=>chart.status!=='archived'&&user.demandScopes?.some(scope=>
    scope.campusId===chart.campusId&&scope.degreeLevelId===chart.degreeLevelId&&
    scope.majorId===chart.majorId));
}

/** Five explicit choices; no implicit first chart or cross-cohort survey. */
export function demandChartScopeOptions(charts:readonly Curriculum[],scope:DemandChartScope) {
  const choices=(field:DemandScopeField,filter:Partial<DemandChartScope>):string[]=>
    [...new Set(charts.filter(c=>Object.entries(filter).every(([key,val])=>
      !val||c[key as DemandScopeField]===val)).map(c=>c[field]))].sort();
  return {
    universityIds:choices('universityId',{}),
    campusIds:scope.universityId?choices('campusId',{universityId:scope.universityId}):[],
    degreeLevelIds:scope.campusId?choices('degreeLevelId',{universityId:scope.universityId,campusId:scope.campusId}):[],
    majorIds:scope.degreeLevelId?choices('majorId',{universityId:scope.universityId,campusId:scope.campusId,degreeLevelId:scope.degreeLevelId}):[],
    entryYearIds:scope.majorId?choices('entryYearId',{universityId:scope.universityId,campusId:scope.campusId,degreeLevelId:scope.degreeLevelId,majorId:scope.majorId}):[],
  };
}
export function changeDemandChartScope(scope:DemandChartScope,field:DemandScopeField,value:string):DemandChartScope {
  const changed={...scope,[field]:value};
  const index=fields.indexOf(field);
  for(const next of fields.slice(index+1))changed[next]='';
  return changed;
}
export function demandChartsForScope(charts:readonly Curriculum[],scope:DemandChartScope):Curriculum[] {
  if(fields.some(field=>!scope[field]))return [];
  return charts.filter(c=>fields.every(field=>c[field]===scope[field]));
}
export type DemandCourseRow=Pick<CurriculumCourse,'courseId'|'trackId'|'active'> & {course?:Course};
/** Track filtering and deduplication must mirror server validations. */
export function demandEligibleCourseIds(
  assignments:readonly DemandCourseRow[],trackId:string,
  courses:readonly Pick<Course,'id'|'active'>[],
):string[] {
  const active=new Set(courses.filter(c=>c.active).map(c=>c.id));
  return [...new Set(assignments.filter(r=>r.active!==false&&
    (!r.trackId||r.trackId===trackId)&&active.has(r.courseId)).map(r=>r.courseId))];
}
export function demandCourseThresholds(
  selected:readonly string[],perCourse:Readonly<Record<string,number>>,fallback:number,
):Record<string,number> {
  const output:Record<string,number>={};
  for(const id of new Set(selected)) {
    const n=perCourse[id]??fallback;
    if(!Number.isInteger(n)||n<0||n>500)throw new Error('حدنصاب هر درس باید عددی بین صفر تا ۵۰۰ باشد.');
    output[id]=n;
  }
  return output;
}
