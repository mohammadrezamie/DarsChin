import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CourseRegistrationFlow, moveAlternative } from '../src/components/CourseRegistrationFlow';
import { orderedChosenCourses } from '../src/domain/student-flow-stage';
import type { CourseEligibilityResult } from '../src/types';

const section = {
  offeringId: 'offer-m1', courseId: 'math', courseName: 'ریاضی دو', courseCode: 'M2',
  instructor: 'استاد الف', groupCode: '۰۱', canSelect: true, isEligible: true, overallStatus: 'AVAILABLE', dayOfWeek: 'شنبه',
  startTime: '۱۰:۰۰', endTime: '۱۲:۰۰', units: 3,
} as CourseEligibilityResult;

const props = {
  curriculumId: null, profile: null, evaluations: [section], recommendations: [],
  wishlistCourseIds: ['math'], selectedOfferingIds: [], coursePriorities: [],
  offeringPriorities: {}, onSaveWishlist: async () => true,
  onStage: () => {}, onPrimary: () => {}, onAddFallback: () => {},
  onRemoveFallback: () => {}, onReorderAlternatives: () => {},
  onReorderCourses: () => {},
};

describe('انتخاب درس قبل از استاد و صف ثبت مشترک', () => {
  it('در مرحله اول نام استاد و کنترل گروه را نمایش نمی‌دهد', () => {
    const html = renderToStaticMarkup(<CourseRegistrationFlow {...props} stage="courses"/>);
    expect(html).toContain('۱. انتخاب درس‌ها');
    expect(html).toContain('مرحله بعد: اولویت استاد');
    expect(html).not.toContain('استاد الف');
    expect(html).not.toContain('اولویت ۱');
  });
  it('فقط بعد از ورود به مرحله دوم، اولویت استاد را نمایش می‌دهد', () => {
    const html = renderToStaticMarkup(<CourseRegistrationFlow {...props} stage="preferences"/>);
    expect(html).toContain('استاد الف');
    expect(html).toContain('استاد اول');
    expect(html).toContain('همان اولویت‌ها در صف آمادهٔ ثبت');
  });
  it('اولویت استادها دقیقاً از صف ثبت گرفته می‌شود و کارت‌ها جمع می‌شوند', () => {
    expect(orderedChosenCourses(['math','physics','lab'],['physics','math']))
      .toEqual(['physics','math','lab']);
    const html=renderToStaticMarkup(<CourseRegistrationFlow {...props} stage="preferences"
      coursePriorities={['physics','math']} wishlistCourseIds={['math','physics']}
      selectedOfferingIds={['offer-m1']}/>);
    expect(html.indexOf('course-teachers-physics')).toBeLessThan(html.indexOf('course-teachers-math'));
    expect(html).toContain('۱ از ۲ درس دارای استاد اولِ مجاز');
    expect(html).toContain('aria-expanded="true"');
    expect(readFileSync('src/components/StudentWishlistBuilder.tsx','utf8')).toContain('{!courseFirst && <>');
  });
  it('انتخاب قبلیِ نامجاز را به عنوان استاد اولِ آماده اعلام نمی‌کند', () => {
    const invalid = { ...section, isEligible: false, primaryReason: 'پیش‌نیاز تأیید نشده است' };
    const html = renderToStaticMarkup(<CourseRegistrationFlow {...props}
      evaluations={[invalid]} stage="preferences" selectedOfferingIds={['offer-m1']}/>);
    expect(html).toContain('۰ از ۱ درس دارای استاد اولِ مجاز');
    expect(html).toContain('استاد اول قبلی فعلاً مجاز نیست');
    expect(html).not.toContain('استاد اول مشخص است');
  });

  it('جابجایی جایگزین‌ها مرتب‌سازی پایدار و بدون تکرار است', () => {
    expect(moveAlternative(['p2', 'p3', 'p4'], 'p3', -1)).toEqual(['p3', 'p2', 'p4']);
    expect(moveAlternative(['p2', 'p3', 'p3'], 'p3', 1)).toEqual(['p2', 'p3']);
    expect(moveAlternative(['p2'], 'missing', 1)).toEqual(['p2']);
  });
});
