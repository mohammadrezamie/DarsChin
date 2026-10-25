import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { evaluateScheduleQuality, type QualityOffering } from '../src/domain/schedule-quality';
import { ScheduleQualityPanel } from '../src/components/ScheduleQualityPanel';
import type { TeacherRatingSummary } from '../src/domain/teacher-ratings';
import type { CourseEligibilityResult } from '../src/types';

const offer=(course:string,section:string,dayOfWeek:string,instructor='استاد نمونه'):QualityOffering=>({
  courseId:course,courseName:'درس '+course,offeringId:course+'-'+section,
  dayOfWeek,startTime:'09:00',endTime:'11:00',instructor,
  isEligible:true,canSelect:true,overallStatus:'AVAILABLE',
});
const a=offer('A','1','شنبه','استاد الف');
const b=offer('B','1','یکشنبه','استاد ب');
const bAlt={...offer('B','2','شنبه','استاد ب'),startTime:'11:00',endTime:'13:00'};
const c=offer('C','1','دوشنبه','استاد ج');
const cAlt={...offer('C','2','شنبه','استاد د'),startTime:'13:00',endTime:'15:00'};
const offered=[a,b,bAlt,c,cAlt];
const summaries:TeacherRatingSummary[]=[
  {courseId:'B',instructor:'استاد ب',sampleSize:4,average:4.2,scores:null,rank:1},
  {courseId:'C',instructor:'استاد ج',sampleSize:5,average:1.2,scores:null,rank:2},
  {courseId:'C',instructor:'استاد د',sampleSize:5,average:4.8,scores:null,rank:1},
  {courseId:'A',instructor:'استاد الف',sampleSize:2,average:5,scores:null,rank:null},
];
describe('timetable day-quality scoring',()=>{
  it('scores an exact feasible 2-to-3-day range, never a fixed 6-day denominator',()=>{
    const worst=evaluateScheduleQuality(offered,[a.offeringId,b.offeringId,c.offeringId]);
    expect(worst.minimumDays).toBe(1); // all can attend on Saturday at disjoint hours
    expect(worst.maximumDays).toBe(3);
    expect(worst.activeDays).toBe(3);
    expect(worst.dayScore).toBe(0);
    expect(worst.recommendedFewestDays).toHaveLength(3);
    expect(worst.suggestedDays).toBe(1);
    const best=evaluateScheduleQuality(offered,[a.offeringId,bAlt.offeringId,cAlt.offeringId]);
    expect(best.dayScore).toBe(100);
    const middle=evaluateScheduleQuality(offered,[a.offeringId,bAlt.offeringId,c.offeringId]);
    expect(middle.dayScore).toBe(50);
  });
  it('ignores blocked, timed-unknown and overlapping alternatives',()=>{
    const blocked={...bAlt,canSelect:false};
    const unknown={...cAlt,startTime:''};
    const report=evaluateScheduleQuality([a,b,c,blocked,unknown],[a.offeringId,b.offeringId,c.offeringId]);
    expect(report.minimumDays).toBe(3);
    expect(report.maximumDays).toBe(3);
    expect(report.dayScore).toBe(100);
    const uncertain=evaluateScheduleQuality([a,{...b,startTime:''}],[a.offeringId,b.offeringId]);
    expect(uncertain.dayScore).toBeNull();
    expect(uncertain.dayReason).toMatch(/نامشخص/);
    const overlapping=evaluateScheduleQuality([a,{...b,dayOfWeek:'شنبه'}],[a.offeringId,b.offeringId]);
    expect(overlapping.dayScore).toBeNull();
    expect(overlapping.dayReason).toMatch(/تداخل/);
  });
  it('never calls a bounded approximate search an exact optimum',()=>{
    const result=evaluateScheduleQuality(offered,[a.offeringId,b.offeringId,c.offeringId],[],4);
    expect(result.searchedExactly).toBe(false);
    expect(result.dayScore).toBeNull();
  });
});
describe('teacher-score integrity',()=>{
  it('uses published averages only, excludes insufficient votes and compares same course',()=>{
    const worst=evaluateScheduleQuality(offered,[a.offeringId,b.offeringId,c.offeringId],summaries);
    expect(worst.professorScore).toBe(40); // B absolute 4.2 = 80, C least rated = 0
    expect(worst.ratedCount).toBe(2);
    expect(worst.selectedCount).toBe(3);
    expect(worst.recommendedTeachers).toHaveLength(0); // A lacks enough votes
    const best=evaluateScheduleQuality(offered,[a.offeringId,b.offeringId,cAlt.offeringId],summaries);
    expect(best.professorScore).toBe(90); // B=80, C best=100
    expect(best.ratingVotes).toBe(9);
  });
  it('does not give artificial zero for courses with no ratings',()=>{
    const score=evaluateScheduleQuality(offered,[a.offeringId,b.offeringId,c.offeringId],[]);
    expect(score.professorScore).toBeNull();
    expect(score.ratedCount).toBe(0);
  });
});
describe('quality UI disclosures',()=>{
  it('renders visible unknown scores and demo-only rating disclosure in RTL',()=>{
    const html=renderToStaticMarkup(<ScheduleQualityPanel
      evaluations={offered.map(o=>({
        ...o,courseCode:o.courseId,units:3,category:'اصلی',groupCode:'01',
        capacity:40,enrolledCount:0,primaryReason:'',allReasons:[],
        missingPrerequisites:[],missingCorequisites:[],
      } as CourseEligibilityResult))}
      selectedOfferingIds={[a.offeringId,b.offeringId,c.offeringId]} demo />);
    expect(html).toContain('فشردگی روزهای دانشگاه');
    expect(html).toContain('امتیاز استادهای منتخب');
    expect(html).toContain('دادهٔ ساختگی');
    expect(html).toContain('کمترین روز حضور');
    expect(html).toContain('۱۰۰');
  });
});
