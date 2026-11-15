import { describe,expect,it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { demandCourseSurveyStarter } from '../src/domain/demand-form-presets';
import {
  parseDemandQuestions,validateDemandAnswers,visibleDemandQuestions,
} from '../src/domain/demand-form';
import { DemandFormBuilder } from '../src/components/DemandFormBuilder';

describe('الگوی آماده و پیش‌نمایش فرم‌های هوشمند نیازسنجی',()=>{
  it('الگوی آماده فقط ترجیحات آموزشی را می‌پرسد و قابل انتشار است',()=>{
    const items=demandCourseSurveyStarter();
    expect(items).toHaveLength(5);
    expect(parseDemandQuestions(items).ok).toBe(true);
    expect(items.find(q=>q.id==='pref_urgent_reason')?.visibleWhen)
      .toEqual({questionId:'pref_urgent',equals:'بله'});
    expect(visibleDemandQuestions(items,{pref_urgent:'خیر'}).map(q=>q.id))
      .not.toContain('pref_urgent_reason');
    expect(visibleDemandQuestions(items,{pref_urgent:'بله'}).map(q=>q.id))
      .toContain('pref_urgent_reason');
    expect(validateDemandAnswers(items,{pref_urgent:'خیر'}).ok).toBe(true);
  });
  it('پنل سازنده دارای کنترل شرط نمایش و پیش‌نمایش تعاملی است',()=>{
    const html=renderToStaticMarkup(React.createElement(DemandFormBuilder,{
      value:demandCourseSurveyStarter(),onChange:()=>{},
    }));
    expect(html).toContain('قانون نمایش هوشمند سؤال');
    expect(html).toContain('پیش‌نمایش سؤال‌ها');
    expect(html).toContain('پاسخ سؤال‌های پنهان ذخیره نمی‌شوند');
  });
  it('در حالت خالی، پیشنهاد الگوی یک‌کلیکی نمایش داده می‌شود',()=>{
    const html=renderToStaticMarkup(React.createElement(DemandFormBuilder,{
      value:[],onChange:()=>{},
    }));
    expect(html).toContain('الگوی آماده نیازسنجی دانشگاهی');
  });
});
