import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { reorderRegistrationCourses } from '../src/domain/reorder-registration-courses';
import { StudentJourneyStepper } from '../src/components/StudentJourneyStepper';
import { StudentWishlistBuilder } from '../src/components/StudentWishlistBuilder';

const source=(p:string)=>readFileSync(p,'utf8');
describe('unified registration queue touch reordering',()=>{
  it('moves one course across multiple ranks without losing an alternative or mutating input',()=>{
    const previous=['math','circuits','signals','control'];
    const next=reorderRegistrationCourses(previous,0,2);
    expect(next).toEqual(['circuits','signals','math','control']);
    expect(previous).toEqual(['math','circuits','signals','control']);
    expect(new Set(next)).toEqual(new Set(previous));
  });
  it('handles moving a last course to the first rank',()=>{
    expect(reorderRegistrationCourses(['a','b','c','d'],3,0)).toEqual(['d','a','b','c']);
  });
  it('rejects invalid, equal, out-of-bound, fractional and duplicated course orders',()=>{
    const list=['a','b','c'];
    for(const [from,to] of [[-1,0],[0,-1],[0,3],[3,0],[0,0],[0.5,1],[1,2.5]]) {
      expect(reorderRegistrationCourses(list,from,to)).toBeNull();
    }
    expect(reorderRegistrationCourses(['a','b','a'],0,2)).toBeNull();
    expect(reorderRegistrationCourses([],0,0)).toBeNull();
  });
  it('keeps working with a large student queue in both directions',()=>{
    const ids=Array.from({length:150},(_,i)=>'c-'+i);
    const forward=reorderRegistrationCourses(ids,0,149)!;
    expect(forward[149]).toBe('c-0');
    const back=reorderRegistrationCourses(forward,149,0);
    expect(back).toEqual(ids);
  });
  it('uses a dedicated touch-safe grip and pointer capture without hijacking row scrolling',()=>{
    const launchpad=source('src/components/RegistrationLaunchpad.tsx');
    expect(launchpad).toContain('onPointerDown={event=>startDrag(event,index)}');
    expect(launchpad).toContain('onPointerMove={trackDrag}');
    expect(launchpad).toContain('onPointerUp={event=>finishDrag(event)}');
    expect(launchpad).toContain('onPointerCancel={event=>finishDrag(event,true)}');
    expect(launchpad).toContain("style={{touchAction:'none'}}");
    expect(launchpad).toContain('setPointerCapture(event.pointerId)');
    expect(launchpad).toContain("closest<HTMLElement>('[data-queue-row]')");
    expect(launchpad).toContain('reorderRegistrationCourses(stepIds,from,to)');
    expect(launchpad).toContain('disabled={reordering||index===0}');
    expect(launchpad).toContain('disabled={reordering||index===queue.steps.length-1}');
  });
  it('shows a real next-copy action only when both chart and student progress are verified',()=>{
    const launchpad=source('src/components/RegistrationLaunchpad.tsx');
    expect(launchpad).toContain('rulesReady && progressReady && next && !sortMode');
    expect(launchpad).toContain('مرحلهٔ بعدی ثبت · آمادهٔ کپی');
    expect(launchpad).toContain('کپی کد درس بعدی');
    expect(launchpad).toContain('آمادهٔ کپی');
    expect(launchpad).toContain('تیک ثبت فقط علامت شخصیِ همان گروه است');
    expect(launchpad).toContain('گروه اصلی');
    expect(launchpad).toContain('جایگزین‌ها');
  });
});

describe('mobile app-like workspace',()=>{
  it('renders a real mobile two-tab basket selector and useful empty state without horizontal stacking',()=>{
    const markup=renderToStaticMarkup(React.createElement(StudentWishlistBuilder,{
      curriculumId:'synthetic-chart',wishlistCourseIds:[],
      evaluations:[],recommendations:[],onSave:async()=>true,
    }));
    expect(markup).toContain('نمای سبد درس در موبایل');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('افزودن درس');
    expect(markup).toContain('سبد من');
    expect(markup).toContain('سبدت هنوز خالیه');
    expect(markup).toContain('lg:hidden');
    expect(markup).toContain('hidden lg:block');
  });
  it('preserves an editable, actual guided-progress target for the mobile continue button',()=>{
    const markup=renderToStaticMarkup(React.createElement(StudentJourneyStepper,{
      step:3,busy:false,hasProfile:true,hasCurriculum:true,
      academicLimits:null,profile:null,wishlistCount:2,
      selectedGroupCount:1,onOpenProfile:()=>{},onStep:()=>{},
    }));
    expect(markup).toContain('id="student-journey-progress"');
    expect(markup).toContain('tabindex="-1"');
    const dash=source('src/components/StudentDashboard.tsx');
    expect(dash).toContain('STUDENT_JOURNEY_STEPS[journeyStep]?.title');
    expect(dash).toContain('aria-controls="student-journey-progress"');
    expect(dash).toContain("document.getElementById('student-journey-progress')");
    expect(dash).toContain('قدم بعدی تو');
  });
  it('does not lose course alternatives or server validation from the original registration workspace',()=>{
    const launchpad=source('src/components/RegistrationLaunchpad.tsx');
    expect(launchpad).toContain('onSelectPrimaryOffering');
    expect(launchpad).toContain('onMoveFallbackOffering');
    expect(launchpad).toContain('onRemoveFallbackOffering');
    expect(launchpad).toContain('onReorderCourses(order)');
    expect(launchpad).toContain("saved===false");
  });
});
