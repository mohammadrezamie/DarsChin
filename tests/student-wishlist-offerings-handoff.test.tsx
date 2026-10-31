import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { basketOfferingCoverage, orderedBasketOfferings } from '../src/domain/student-offering-basket';
import { verifiedOfferingGroupCopyCode } from '../src/domain/offering-code';
import { OfferingsList } from '../src/components/OfferingsList';
import { StudentJourneyStepper } from '../src/components/StudentJourneyStepper';
import type { CourseEligibilityResult } from '../src/types';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const sample = (courseId: string, status: CourseEligibilityResult['overallStatus'] = 'AVAILABLE') => ({
  courseId, offeringId: 'off-' + courseId, courseName: 'درس ' + courseId,
  courseCode: 'TEST-' + courseId, units: 3, category: 'اصلی',
  groupCode: '01', instructor: 'استاد نمونه', dayOfWeek: 'شنبه',
  startTime: '08:00', endTime: '10:00', capacity: 30, enrolledCount: 10,
  overallStatus: status, canSelect: status === 'AVAILABLE',
  isEligible: status === 'AVAILABLE', primaryReason: status === 'AVAILABLE' ? '' : 'پیش‌نیاز احراز نشده',
  allReasons: [], missingPrerequisites: [], missingCorequisites: [],
} as CourseEligibilityResult);

describe('wishlist-to-offerings student handoff', () => {
  it('shows basket subjects in the chosen order without changing eligibility', () => {
    const groups = [sample('physics'),sample('math','BLOCKED_PREREQUISITE'),sample('signals')];
    const result = orderedBasketOfferings(groups,['signals','math','not-offered'],true);
    expect(result.map(x=>x.courseId)).toEqual(['signals','math']);
    expect(result[1].canSelect).toBe(false);
    expect(result[1].overallStatus).toBe('BLOCKED_PREREQUISITE');
    expect(groups.map(x=>x.courseId)).toEqual(['physics','math','signals']);
  });

  it('counts missing course offerings once and allows switching back to the full catalog', () => {
    expect(basketOfferingCoverage(['math','signals','signals','missing'],['math','signals']))
      .toEqual({offered:2,missing:['missing']});
    expect(orderedBasketOfferings([sample('physics'),sample('math')],['math'],false)
      .map(x=>x.courseId)).toEqual(['physics','math']);
  });

  it('renders only chosen subjects and hides instructor details until the student opens a course', () => {
    const html = renderToStaticMarkup(<OfferingsList
      evaluations={[sample('physics'), sample('math'), sample('signals')]}
      selectedOfferingIds={[]}
      onToggleScheduleOffering={()=>{}}
      onOpenProfileModal={()=>{}}
      wishlistCourseIds={['signals','math','missing']}
      initiallyShowWishlist
      onOpenWishlist={()=>{}} />);
    expect(html).toContain('از سبد علاقه‌مندی تا انتخاب گروه واقعی');
    expect(html).toContain('گروه‌های درس‌های انتخابی');
    expect(html).not.toContain('نمایش همهٔ درس‌ها');
    expect(html).toContain('گروهی در داده‌های فعلی ندارد');
    expect(html).toContain('مشاهده گروه‌ها');
    expect(html).not.toContain('استاد نمونه');
    expect(html).not.toContain('درس physics');
  });

  it('does not advance from an empty wishlist or empty selected schedule to the queue', () => {
    const props = {
      busy:false,hasProfile:true,hasCurriculum:true,academicLimits:null,profile:null,
      onOpenProfile:()=>{},onStep:()=>{},wishlistCount:0,selectedGroupCount:0,
    };
    const basket=renderToStaticMarkup(<StudentJourneyStepper step={4} {...props} />);
    const group=renderToStaticMarkup(<StudentJourneyStepper step={5} {...props} wishlistCount={3}/>);
    expect(basket).toContain('حداقل یک درس');
    expect(basket).toContain('disabled');
    expect(group).toContain('حداقل یک گروه مجاز');
    expect(group).toContain('disabled');
    const allowed=renderToStaticMarkup(<StudentJourneyStepper step={5} {...props}
      wishlistCount={3} selectedGroupCount={1}/>);
    expect(allowed).toContain('اکنون ۱ گروه');
    expect(allowed).not.toContain('حداقل یک گروه مجاز');
    expect(source('src/components/StudentDashboard.tsx')).toContain("'offerings', 'offerings', 'registration'");
  });

  it('copies only verified eligible group codes, never catalog or synthetic codes', () => {
    const valid = { ...sample('math'), rawCourseCode: ' 410100 ', groupCode: '02' };
    expect(verifiedOfferingGroupCopyCode(valid)).toBe('410100_02');
    expect(verifiedOfferingGroupCopyCode({ ...valid, rawCourseCode: undefined })).toBeNull();
    expect(verifiedOfferingGroupCopyCode({ ...valid, rawCourseCode: 'DEMO-410100' })).toBeNull();
    expect(verifiedOfferingGroupCopyCode({ ...valid, rawCourseCode: '---' })).toBeNull();
    expect(verifiedOfferingGroupCopyCode({ ...valid, rawCourseCode: 'TEST-410100' })).toBeNull();
    expect(verifiedOfferingGroupCopyCode({ ...valid, rawCourseCode: 'نامشخص' })).toBeNull();
    expect(verifiedOfferingGroupCopyCode({ ...valid, rawCourseCode: 'N/A' })).toBeNull();
    expect(verifiedOfferingGroupCopyCode({ ...valid, groupCode: '؟' })).toBeNull();
    expect(verifiedOfferingGroupCopyCode({ ...valid, groupCode: '' })).toBeNull();
    expect(verifiedOfferingGroupCopyCode({ ...valid, canSelect: false })).toBeNull();
    expect(verifiedOfferingGroupCopyCode({ ...valid, overallStatus: 'NEEDS_REVIEW' })).toBeNull();
    const html = renderToStaticMarkup(<OfferingsList evaluations={[sample('blocked','BLOCKED_PREREQUISITE')]}
      selectedOfferingIds={['off-blocked']} onToggleScheduleOffering={() => {}} onOpenProfileModal={() => {}} />);
    expect(html).toContain('کپی فقط برای گروه مجاز');
    expect(html).toContain('disabled');
    const offeringSource = source('src/components/OfferingsList.tsx');
    expect(offeringSource).toContain('copyTextWithFallback');
    expect(offeringSource).not.toContain('navigator.clipboard.writeText(');
    expect(offeringSource).not.toContain('rawCourseCode +');
  });

  it('never bypasses eligibility checks from the new basket-only filter', () => {
    const file=source('src/components/OfferingsList.tsx');
    expect(file).toContain('basketOfferingCoverage');
    expect(file).toContain('orderedBasketOfferings');
    expect(file).toContain('onToggleScheduleOffering');
    expect(source('src/components/StudentDashboard.tsx')).toContain('handleToggleScheduleOffering');
  });
});
