export type DemandCourseReportRow = {
  courseId:string;
  name:string;
  code:string;
  count:number;
  threshold:number;
  selfReportedFinalSemester:number;
};
export type DemandCourseStatus='met'|'below'|'unset';
export type DemandCourseSort='demand'|'gap'|'final'|'name';

export function demandCourseStatus(row:DemandCourseReportRow):DemandCourseStatus{
  return row.threshold<=0?'unset':row.count>=row.threshold?'met':'below';
}
export function demandCourseGap(row:DemandCourseReportRow):number|null{
  return row.threshold>0?Math.max(0,row.threshold-row.count):null;
}
export function demandCourseReportTotals(rows:readonly DemandCourseReportRow[]){
  const totals={met:0,below:0,unset:0,requested:0};
  for(const row of rows){
    totals[demandCourseStatus(row)]++;
    if(row.count>0)totals.requested++;
  }
  return totals;
}
function normalizeSearch(value:string){
  return value.normalize('NFKC')
    .replace(/[۰-۹]/g,char=>String(char.charCodeAt(0)-1776))
    .replace(/[٠-٩]/g,char=>String(char.charCodeAt(0)-1632))
    .replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/\u200c/g,' ')
    .replace(/\s+/g,' ').trim().toLocaleLowerCase('fa');
}
export function filterDemandCourseReport(
  rows:readonly DemandCourseReportRow[],
  query:string,
  status:DemandCourseStatus|'all',
  sort:DemandCourseSort,
):DemandCourseReportRow[]{
  const term=normalizeSearch(query);
  return rows.filter(row=>(status==='all'||demandCourseStatus(row)===status)&&
    (!term||[row.name,row.code].some(value=>normalizeSearch(value).includes(term))))
    .sort((a,b)=>{
      const nameOrder=()=>a.name.localeCompare(b.name,'fa')||a.courseId.localeCompare(b.courseId);
      if(sort==='name')return nameOrder();
      if(sort==='gap'){
        // فقط کمبود واقعی اولویت دارد؛ درس رسیده و بدون حدنصاب بعد از آن قرار می‌گیرند.
        const rank=(row:DemandCourseReportRow)=>demandCourseStatus(row)==='below'?0:
          demandCourseStatus(row)==='met'?1:2;
        return rank(a)-rank(b)||
          (rank(a)===0?(demandCourseGap(a)??0)-(demandCourseGap(b)??0):0)||
          b.count-a.count||nameOrder();
      }
      if(sort==='final')return b.selfReportedFinalSemester-a.selfReportedFinalSemester||
        b.count-a.count||nameOrder();
      return b.count-a.count||nameOrder();
    });
}
