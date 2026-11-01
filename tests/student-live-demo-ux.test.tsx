import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RegistrationLaunchpad } from '../src/components/RegistrationLaunchpad';
import { NewCurriculumForm } from '../src/components/NewCurriculumForm';
import type { CourseEligibilityResult } from '../src/types';

const source=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');

describe('live demo product feedback acceptance',()=>{
  it('renders a compact course with order controls, same-row copy and teacher time',()=>{
    const course={
      courseId:'math2',offeringId:'off-math2',courseName:'ریاضی عمومی دو',
      instructor:'استاد نمونه',groupCode:'01',dayOfWeek:'شنبه',
      startTime:'07:30',endTime:'09:00',rawCourseCode:'DEMO-123',
    } as CourseEligibilityResult;
    const html=renderToStaticMarkup(<RegistrationLaunchpad
      evaluations={[course]} selectedOfferingIds={['off-math2']} coursePriorities={['math2']}
      profile={null} curriculumId={null} onEditPriorities={()=>{}} onReorderCourses={()=>{}}
    />);
    expect(html).toContain('صف سریع ثبت دروس');
    expect(html).toContain('ریاضی عمومی دو');
    expect(html).toContain('استاد نمونه');
    expect(html).toContain('07:30');
    expect(html).toContain('انتقال ریاضی عمومی دو به بالا');
    expect(html).toContain('انتقال ریاضی عمومی دو به پایین');
    expect(html).toContain('کپی کد ریاضی عمومی دو');
    expect(html).toContain('flex-nowrap');
    expect(html).not.toContain('صف آمادهٔ ثبت درس در آموزشیار');
  });
  it('shows a real create-curriculum control in admin and keeps new charts drafts',()=>{
    const html=renderToStaticMarkup(<NewCurriculumForm onCreated={()=>{}}/>);
    expect(html).toContain('افزودن چارت تحصیلی');
    expect(html).toContain('چارت جدید');
    const form=source('src/components/NewCurriculumForm.tsx');
    expect(form).toContain("status:'draft'");
    expect(form).toContain('entryYearId');
    expect(source('src/components/AdminCurriculumBuilder.tsx')).toContain('<NewCurriculumForm');
  });
  it('keeps gated demand, support/bugs unified, and passed-course bulk marking removed',()=>{
    const student=source('src/components/StudentDashboard.tsx');
    expect(student).toContain("disabled={tab.id === 'demand' && !demandSurveyAvailable}");
    expect(student).toContain('<StudentHelpCenter');
    expect(student).not.toContain("activeTab === 'bugs'");
    const past=source('src/components/PassedCoursesManager.tsx');
    expect(past).not.toContain('handleQuickBatchSelect');
    const demo=source('src/demo/mock-api.ts');
    expect(demo).toContain("id:'demo-demand-fall'");
    expect(demo).toContain("status:'DRAFT'");
  });
  it('has no decorative hourly or column grid strokes in the continuous schedule',()=>{
    const file=source('src/components/FluidWeekTimetable.tsx');
    expect(file).not.toContain('border-t border-dashed');
    expect(file).not.toContain('border-l border-slate-200 last:border-l-0');
    expect(file).toContain('CLASS_START_MINUTE');
    expect(file).toContain('CLASS_END_MINUTE');
  });
});
