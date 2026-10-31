import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findOfferingTimeConflicts, lectureTimesOverlap } from '../src/domain/registration-conflicts';
import type { CourseEligibilityResult } from '../src/types';

const row = (overrides: Partial<CourseEligibilityResult> = {}): CourseEligibilityResult => ({
  offeringId: 'off-A',courseId:'A',courseName:'مدار یک',courseCode:'410100',
  units:3,category:'اصلی',groupCode:'01',instructor:'استاد نمونه',
  dayOfWeek:'شنبه',startTime:'08:00',endTime:'10:00',
  capacity:20,enrolledCount:0,overallStatus:'AVAILABLE',canSelect:true,isEligible:true,
  primaryReason:'',allReasons:[],missingPrerequisites:[],missingCorequisites:[],
  ...overrides,
});

describe('shared conflict warnings for first choice AND reserve promotion',()=>{
  it('warns when promoting a reserve to a time-overlapping class on another course',()=>{
    const main=row({offeringId:'A-01',courseId:'A',startTime:'08:00',endTime:'10:00'});
    const reserved=row({offeringId:'A-02',courseId:'A',startTime:'09:00',endTime:'11:00'});
    const other=row({offeringId:'B-01',courseId:'B',courseName:'فیزیک',startTime:'10:00',endTime:'12:00'});
    expect(findOfferingTimeConflicts(main,[other])).toHaveLength(0);
    expect(findOfferingTimeConflicts(reserved,[main,other]).join(' ')).toContain('فیزیک');
  });
  it('never counts the old main group of the SAME course as an extra lesson',()=>{
    const replacement=row({offeringId:'A-02',startTime:'09:00',endTime:'11:00'});
    expect(findOfferingTimeConflicts(replacement,[row()])).toEqual([]);
  });
  it('handles non-padded 8:30 and exact lecture boundaries without false warnings',()=>{
    const a=row({startTime:'8:30',endTime:'10:00'});
    const b=row({courseId:'B',offeringId:'B',startTime:'09:45',endTime:'10:15'});
    const c=row({courseId:'C',offeringId:'C',startTime:'10:00',endTime:'11:00'});
    expect(findOfferingTimeConflicts(a,[b])).toHaveLength(1);
    expect(findOfferingTimeConflicts(a,[c])).toHaveLength(0);
  });
  it('reports an exam on the same day even when the exact time requires checking',()=>{
    const a=row({examDate:'1405/10/01 - 09:00'});
    const b=row({courseId:'B',offeringId:'B',examDate:'1405/10/01 - 11:00'});
    expect(findOfferingTimeConflicts(a,[b]).join(' ')).toContain('یک روز');
    expect(findOfferingTimeConflicts(a,[{...b,examDate:a.examDate}]).join(' ')).toContain('تداخل دقیق');
  });
  it('reuses the same helper for both adding a course and promoting a reserve',()=>{
    const dashboard=readFileSync(resolve(process.cwd(),'src/components/StudentDashboard.tsx'),'utf8');
    expect(dashboard).toContain('findOfferingTimeConflicts(replacement,');
    expect(dashboard).toContain('findOfferingTimeConflicts(newEval, currentSelected)');
    expect(dashboard).toContain('swapCourseId?: string');
    expect(dashboard).toContain('handleSelectPrimaryOffering(conflictWarning.swapCourseId, conflictWarning.offeringId, true)');
  });
});

describe('all student timetable surfaces use consistent clock-time overlap checks', () => {
  it('compares numeric minutes, including non-zero-padded input on either side', () => {
    const first = row({ startTime: '8:30', endTime: '10:00' });
    const sameDay = row({ startTime: '09:45', endTime: '11:00' });
    expect(lectureTimesOverlap(first, sameDay)).toBe(true);
    expect(lectureTimesOverlap(sameDay, first)).toBe(true);
    expect(lectureTimesOverlap(first, row({ startTime: '10:00', endTime: '12:00' }))).toBe(false);
  });

  it('does not invent confirmed clashes for malformed times, zero duration, or different days', () => {
    const first = row({ startTime: '09:00', endTime: '10:00' });
    expect(lectureTimesOverlap(first, row({ dayOfWeek: 'یکشنبه' }))).toBe(false);
    expect(lectureTimesOverlap(first, row({ startTime: '9:99' }))).toBe(false);
    expect(lectureTimesOverlap(first, row({ startTime: '09:00', endTime: '09:00' }))).toBe(false);
    expect(lectureTimesOverlap(first, row({ startTime: '', endTime: '' }))).toBe(false);
  });

  it('uses one overlap function for the dashboard banner, calendar and add/swap warning', () => {
    const dashboard = readFileSync(resolve(process.cwd(), 'src/components/StudentDashboard.tsx'), 'utf8');
    const planner = readFileSync(resolve(process.cwd(), 'src/components/SchedulePlanner.tsx'), 'utf8');
    expect(dashboard).toContain('if (lectureTimesOverlap(o1, o2))');
    expect(planner).toContain('if (lectureTimesOverlap(o1, o2))');
    expect(dashboard).toContain('findOfferingTimeConflicts(newEval, currentSelected)');
    expect(dashboard).not.toContain('o1.startTime < o2.endTime && o1.endTime > o2.startTime');
    expect(planner).not.toContain('o1.startTime < o2.endTime && o1.endTime > o2.startTime');
  });
});
