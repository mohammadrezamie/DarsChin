import {describe,expect,it} from 'vitest';
import {
  emptyDemandChartScope,changeDemandChartScope,demandChartScopeOptions,
  demandChartsForScope,manageableDemandCharts,demandEligibleCourseIds,demandCourseThresholds,
} from '../src/domain/demand-chart-workflow';
import {exportDemandSummaryCsv} from '../src/domain/course-demand';
import type {Curriculum,DemandSurvey,DemandResponse,User} from '../src/types';
const mk=(id:string,majorId:string,year:string,campusId='campus-1',degreeLevelId='bachelor'):Curriculum=>({
  id,universityId:'uni',campusId,degreeLevelId,majorId,entryYearId:year,
  name:id,version:'v1',createdAt:'2026-11-01',status:'active',
});
const charts=[mk('ee-1403','ee','y03'),mk('ee-1404','ee','y04'),
  mk('cs-1403','cs','y03'),mk('master-1403','ee-master','y03','campus-1','master'),
  mk('other-campus','ee','y03','campus-2')];
const root:User={id:'root',name:'مدیر',mobile:'09000001001',roles:['super-admin'],
  permissions:[],createdAt:'2026-11-01'};
const manager:User={...root,id:'scoped-manager',roles:['admin'],permissions:['demand.manage'],
  demandScopes:[{campusId:'campus-1',degreeLevelId:'bachelor',majorId:'ee'}]};
describe('نیازسنجی مستقل برای رشته، مقطع و ورودی',()=>{
  it('هیچ چارت تصادفی را پیش‌فرض انتخاب نمی‌کند و تمام پنج دامنه را لازم می‌داند',()=>{
    const empty=emptyDemandChartScope();
    expect(Object.values(empty)).toEqual(['','','','','']);
    expect(demandChartsForScope(charts,empty)).toEqual([]);
    expect(demandChartScopeOptions(charts,empty).campusIds).toEqual([]);
  });
  it('مدیر محدود فقط چارت‌های رشتهٔ خود را می‌بیند',()=>{
    expect(manageableDemandCharts(charts,manager).map(c=>c.id)).toEqual(['ee-1403','ee-1404']);
    expect(manageableDemandCharts(charts,{...manager,demandScopes:[]})).toEqual([]);
    expect(manageableDemandCharts(charts,root)).toHaveLength(charts.length);
  });
  it('انتخاب متوالی حوزه، مقطع و ورودی را بدون اختلاط هم‌نام‌ها فیلتر می‌کند',()=>{
    let scope=emptyDemandChartScope();
    scope=changeDemandChartScope(scope,'universityId','uni');
    expect(demandChartScopeOptions(charts,scope).campusIds).toEqual(['campus-1','campus-2']);
    scope=changeDemandChartScope(scope,'campusId','campus-1');
    expect(demandChartScopeOptions(charts,scope).degreeLevelIds).toEqual(['bachelor','master']);
    scope=changeDemandChartScope(scope,'degreeLevelId','bachelor');
    scope=changeDemandChartScope(scope,'majorId','ee');
    expect(demandChartScopeOptions(charts,scope).entryYearIds).toEqual(['y03','y04']);
    scope=changeDemandChartScope(scope,'entryYearId','y04');
    expect(demandChartsForScope(charts,scope).map(c=>c.id)).toEqual(['ee-1404']);
    expect(changeDemandChartScope(scope,'degreeLevelId','master')).toEqual({
      ...scope,degreeLevelId:'master',majorId:'',entryYearId:'',
    });
  });
  it('دروس گرایش دیگر و دروس غیرفعال را کنار می‌گذارد و نام یک درس را دو بار نمی‌آورد',()=>{
    const assigned=[
      {courseId:'a',trackId:null,active:true},
      {courseId:'a',trackId:'power',active:true},
      {courseId:'b',trackId:'power',active:true},
      {courseId:'c',trackId:'ai',active:true},
      {courseId:'d',trackId:null,active:false},
    ];
    const catalogue=['a','b','c','d'].map(id=>({id,active:id!=='d'}));
    expect(demandEligibleCourseIds(assigned,'',catalogue)).toEqual(['a']);
    expect(demandEligibleCourseIds(assigned,'power',catalogue)).toEqual(['a','b']);
    expect(demandEligibleCourseIds(assigned,'ai',catalogue)).toEqual(['a','c']);
  });
  it('برای هر درس حدنصاب مستقل ثبت می‌کند و مقدار نامعتبر را رد می‌کند',()=>{
    expect(demandCourseThresholds(['a','b','a'],{a:25,b:0},15)).toEqual({a:25,b:0});
    expect(demandCourseThresholds(['a','b'],{},15)).toEqual({a:15,b:15});
    expect(()=>demandCourseThresholds(['a'],{a:501},15)).toThrow();
  });
});
describe('گزارش تجمیعی بدون اطلاعات شناسایی دانشجو',()=>{
  const survey:DemandSurvey={
    id:'survey-1404',title:'نیازسنجی آزمایشی',description:'',targetTermId:'t1',
    universityId:'uni',campusId:'campus-1',degreeLevelId:'bachelor',majorId:'ee',
    curriculumId:'ee-1404',entryYearIds:['y04'],trackIds:[],
    courseIds:['a','b'],recommendedMinimumByCourse:{a:3,b:1},
    createdBy:'manager',createdAt:'2026-11-01',updatedAt:'2026-11-01',status:'OPEN',
  };
  const response=(id:string,selected:string[]):DemandResponse=>({
    id,surveyId:survey.id,userId:id,studentNumber:'4010000000',
    anticipatedGraduation:'NO',courseIds:selected,
    snapshot:{studentName:'راز خصوصی',campusId:'campus-1',majorId:'ee',
      entryYearId:'y04',isTrackSelected:false},
    submittedAt:'2026-11-01',updatedAt:'2026-11-01',
  });
  it('فقط مجموع تقاضا و حدنصاب را با محافظت CSV نشان می‌دهد',()=>{
    const csv=exportDemandSummaryCsv(survey,[response('a',['a']),response('b',['a','b'])],
      new Map([['a','=HYPERLINK("http://bad.test")'],['b','فیزیک']]),new Map([['a','2101'],['b','2102']]));
    expect(csv).toContain('تعداد تقاضا');
    expect(csv).toContain('2101');
    expect(csv).toContain('2102');
    expect(csv).toContain('2');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain('راز خصوصی');
    expect(csv).not.toContain('4010000000');
    expect(csv).not.toContain('userId');
  });
});
