import React from 'react';
import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {DemandCourseReport} from '../src/components/DemandCourseReport';
import {demandCourseGap,demandCourseReportTotals,demandCourseStatus,filterDemandCourseReport,
  type DemandCourseReportRow} from '../src/domain/demand-course-report';

const rows:DemandCourseReportRow[]=[
  {courseId:'a',name:'ریاضی عمومی',code:'123',count:9,threshold:10,selfReportedFinalSemester:1},
  {courseId:'b',name:'فیزیک',code:'456',count:12,threshold:10,selfReportedFinalSemester:2},
  {courseId:'c',name:'کارگاه',code:'789',count:30,threshold:0,selfReportedFinalSemester:0},
  {courseId:'d',name:'مدار',code:'999',count:0,threshold:8,selfReportedFinalSemester:0},
];
const ids=(values:DemandCourseReportRow[])=>values.map(row=>row.courseId);
describe('تصمیم‌یار آماری عرضهٔ درس',()=>{
  it('حدنصاب صفر را تعریف‌نشده می‌داند و تقاضای صفر را حفظ می‌کند',()=>{
    expect(demandCourseReportTotals(rows)).toEqual({met:1,below:2,unset:1,requested:3});
    expect(demandCourseStatus(rows[2])).toBe('unset');
    expect(demandCourseGap(rows[2])).toBeNull();
    expect(demandCourseGap(rows[1])).toBe(0);
    expect(demandCourseGap(rows[3])).toBe(8);
  });
  it('فیلتر و مرتب‌سازی را بدون تغییر آرایهٔ اصلی اجرا می‌کند',()=>{
    expect(ids(filterDemandCourseReport(rows,'','all','demand'))).toEqual(['c','b','a','d']);
    expect(ids(filterDemandCourseReport(rows,'','all','gap'))).toEqual(['a','d','b','c']);
    expect(ids(filterDemandCourseReport(rows,'','below','final'))).toEqual(['a','d']);
    expect(ids(filterDemandCourseReport(rows,'','met','name'))).toEqual(['b']);
    expect(ids(rows)).toEqual(['a','b','c','d']);
  });
  it('ارقام فارسی و عربی و شکل حروف عربی را در جست‌وجو می‌پذیرد',()=>{
    expect(ids(filterDemandCourseReport(rows,'۱۲۳','all','name'))).toEqual(['a']);
    expect(ids(filterDemandCourseReport(rows,'٤٥٦','all','name'))).toEqual(['b']);
    expect(ids(filterDemandCourseReport(rows,'فيزيك','all','name'))).toEqual(['b']);
    expect(filterDemandCourseReport(rows,'۱۲۳','met','demand')).toEqual([]);
  });
  it('وضعیت نامشخص و محدودیت تصمیم‌یار را بدون ادعای تشکیل کلاس رندر می‌کند',()=>{
    const html=renderToStaticMarkup(<DemandCourseReport rows={rows}/>);
    expect(html).toContain('تصمیم‌یار عرضهٔ درس');
    expect(html).toContain('به معنی تصویب یا تشکیل کلاس نیست');
    expect(html).toContain('بدون حدنصاب');
    expect(html).toContain('فاصله تا حدنصاب');
    expect(html).toContain('جست‌وجوی نام یا کد درس');
    expect(html.match(/role="progressbar"/g)).toHaveLength(3);
  });
  it('حالت نتیجهٔ خالی را با امکان بازنشانی فیلتر نشان می‌دهد',()=>{
    const html=renderToStaticMarkup(<DemandCourseReport rows={[]}/>);
    expect(html).toContain('در این فیلتر درسی وجود ندارد');
    expect(html).toContain('پاک کردن فیلترها');
  });
});
