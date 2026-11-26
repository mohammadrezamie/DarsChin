import React from 'react';
import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {DemandParticipationReport} from '../src/components/DemandParticipationReport';

describe('نمای تحلیل مشارکت',()=>{
  it('تقاضا و خوداظهاری را از نرخ مشارکت و تأیید فارغ‌التحصیلی متمایز می‌کند',()=>{
    const html=renderToStaticMarkup(<DemandParticipationReport stats={{
      withCourseRequests:2,withoutCourseRequests:1,totalCourseRequests:6,
      graduationYes:1,graduationNo:1,graduationUnknown:1,
    }}/>);
    expect(html).toContain('میانگین تقاضای درسی به ازای هر پاسخ‌دهنده: ۲');
    expect(html).toContain('بدون درس درخواستی');
    expect(html).toContain('نرخ مشارکت کل دانشجویان نیست');
    expect(html).toContain('به معنی تأیید رسمی فارغ‌التحصیلی نیست');
  });
  it('در نبود پاسخ، میانگین ساختگی نمایش نمی‌دهد',()=>{
    const html=renderToStaticMarkup(<DemandParticipationReport stats={{
      withCourseRequests:0,withoutCourseRequests:0,totalCourseRequests:0,
      graduationYes:0,graduationNo:0,graduationUnknown:0,
    }}/>);
    expect(html).toContain('هنوز پاسخی برای محاسبهٔ میانگین ثبت نشده است');
    expect(html).not.toContain('NaN');
  });
});
