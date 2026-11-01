import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SchedulePlanner } from '../src/components/SchedulePlanner';
import { detectPlanConflicts, normalizedExamDay } from '../src/domain/plan-conflicts';
import type { CourseEligibilityResult } from '../src/types';

const offering=(id:string,courseId:string,overrides:Partial<CourseEligibilityResult>={}):CourseEligibilityResult=>({
  offeringId:id,courseId,courseName:'درس '+courseId,courseCode:'SYN-'+courseId,
  groupCode:id,instructor:'Synthetic professor',units:2,category:'تخصصی',
  dayOfWeek:'شنبه',startTime:'09:00',endTime:'10:30',
  capacity:30,enrolledCount:0,overallStatus:'AVAILABLE',
  canSelect:true,isEligible:true,primaryReason:'',allReasons:[],
  missingPrerequisites:[],missingCorequisites:[],
  ...overrides,
});
const html=(rows:CourseEligibilityResult[])=>renderToStaticMarkup(
  <SchedulePlanner evaluations={rows} selectedOfferingIds={rows.map(item=>item.offeringId)}
    onToggleScheduleOffering={()=>{}} onClearSchedule={()=>{}} />
);
describe('planner UI and API must agree about real scheduling conflicts',()=>{
  it('displays the same confirmed overlap when Farsi day spellings and digit sets differ',()=>{
    const rows=[
      offering('a','course-a',{dayOfWeek:'سه‌شنبه',startTime:'۰۹:۰۰',endTime:'۱۰:۳۰'}),
      offering('b','course-b',{dayOfWeek:'سهشنبه',startTime:'09:10',endTime:'11:00'}),
    ];
    expect(detectPlanConflicts(rows.map(row=>({
      id:row.offeringId,courseId:row.courseId,dayOfWeek:row.dayOfWeek,
      startTime:row.startTime,endTime:row.endTime,examDate:row.examDate,
    })))).toHaveLength(1);
    expect(html(rows)).toContain('تداخل ساعت کلاسی');
  });
  it('distinguishes same-day exam warnings from verified same-start-time collisions',()=>{
    const first=offering('a','a',{dayOfWeek:'',startTime:'',endTime:'',examDate:'۱۴۰۵/۱/۲۱ - ۰۹:۰۰'});
    const other=offering('b','b',{dayOfWeek:'',startTime:'',endTime:'',examDate:'1405/01/21 - 11:00'});
    expect(normalizedExamDay(first.examDate)).toBe('1405/01/21');
    expect(normalizedExamDay(other.examDate)).toBe('1405/01/21');
    expect(detectPlanConflicts([{
      id:first.offeringId,courseId:first.courseId,dayOfWeek:first.dayOfWeek,
      startTime:first.startTime,endTime:first.endTime,examDate:first.examDate,
    },{
      id:other.offeringId,courseId:other.courseId,dayOfWeek:other.dayOfWeek,
      startTime:other.startTime,endTime:other.endTime,examDate:other.examDate,
    }])).toHaveLength(0);
    expect(html([first,other])).toContain('همزمانی روز امتحان');
    expect(html([first,other])).not.toContain('تداخل دقیق زمان امتحان');
    const exact={...other,examDate:'1405/01/21 - 09:00'};
    expect(html([first,exact])).toContain('تداخل دقیق زمان امتحان');
  });
  it('does not invent conflicts for unannounced classes or back-to-back lessons',()=>{
    const rows=[
      offering('a','a',{dayOfWeek:'شنبه',startTime:'09:00',endTime:'10:00',examDate:undefined}),
      offering('b','b',{dayOfWeek:'شنبه',startTime:'10:00',endTime:'11:00',examDate:undefined}),
      offering('c','c',{dayOfWeek:'',startTime:'',endTime:'',examDate:undefined}),
    ];
    expect(html(rows)).not.toContain('تداخل ساعت کلاسی');
    expect(html(rows)).not.toContain('تداخل دقیق زمان امتحان');
  });
});
