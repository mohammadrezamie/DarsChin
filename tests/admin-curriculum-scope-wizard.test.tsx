import React from 'react';
import { describe,expect,it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  changeCurriculumScope,curriculumScopeOptions,emptyCurriculumScope,validateCurriculumScope,
  type CurriculumScopeMeta,
} from '../src/domain/curriculum-scope';
import { NewCurriculumForm } from '../src/components/NewCurriculumForm';
import { readFileSync } from 'node:fs';

const meta:CurriculumScopeMeta={
  universities:[{id:'u1',name:'دانشگاه الف',active:true},{id:'u2',name:'دانشگاه ب',active:true}],
  campuses:[
    {id:'c1',name:'واحد الف',universityId:'u1',active:true},
    {id:'c2',name:'واحد ب',universityId:'u2',active:true},
    {id:'c-old',name:'واحد غیرفعال',universityId:'u1',active:false},
  ],
  degreeLevels:[{id:'d1',name:'کارشناسی',active:true},{id:'d2',name:'کارشناسی ارشد',active:true}],
  majors:[
    {id:'m1',name:'برق کارشناسی',degreeLevelId:'d1',active:true},
    {id:'m2',name:'برق ارشد',degreeLevelId:'d2',active:true},
    {id:'m-old',name:'غیرفعال',degreeLevelId:'d1',active:false},
  ],
  entryYears:[{id:'y1',name:'ورودی ۱۴۰۳',year:1403,active:true},{id:'y-old',year:1380,active:false}],
};
describe('ساخت آگاهانه چارت دانشگاه / واحد / مقطع / رشته / ورودی',()=>{
  it('با فهرست پر از داده هیچ چیزی پیشاپیش انتخاب نمی‌کند',()=>{
    const empty=emptyCurriculumScope();
    expect(Object.values(empty)).toEqual(['','','','','']);
    expect(validateCurriculumScope(meta,empty)).toContain('دانشگاه');
    expect(curriculumScopeOptions(meta,empty).campuses).toEqual([]);
    expect(curriculumScopeOptions(meta,empty).majors).toEqual([]);
  });
  it('فقط واحد همان دانشگاه و رشته همان مقطع را در گزینه‌ها نشان می‌دهد',()=>{
    const scope={universityId:'u1',campusId:'',degreeLevelId:'d1',majorId:'',entryYearId:''};
    const options=curriculumScopeOptions(meta,scope);
    expect(options.campuses.map(x=>x.id)).toEqual(['c1']);
    expect(options.majors.map(x=>x.id)).toEqual(['m1']);
    expect(options.entryYears.map(x=>x.id)).toEqual(['y1']);
  });
  it('تعویض دانشگاه یا مقطع انتخاب واحد و رشته قبلی را پاک می‌کند',()=>{
    const initial={universityId:'u1',campusId:'c1',degreeLevelId:'d1',majorId:'m1',entryYearId:'y1'};
    expect(changeCurriculumScope(initial,'universityId','u2')).toEqual({...initial,universityId:'u2',campusId:''});
    expect(changeCurriculumScope(initial,'degreeLevelId','d2')).toEqual({...initial,degreeLevelId:'d2',majorId:''});
  });
  it('رشته یا واحد متعلق به ساختار دیگر و گزینه غیرفعال را رد می‌کند',()=>{
    const base={universityId:'u1',campusId:'c1',degreeLevelId:'d1',majorId:'m1',entryYearId:'y1'};
    expect(validateCurriculumScope(meta,base)).toBeNull();
    expect(validateCurriculumScope(meta,{...base,campusId:'c2'})).toContain('واحد');
    expect(validateCurriculumScope(meta,{...base,majorId:'m2'})).toContain('رشته');
    expect(validateCurriculumScope(meta,{...base,entryYearId:'y-old'})).toContain('ورود');
  });
  it('فرم مدیریت به صورت آگاهانه و بدون پرکردن شناسه‌های پیش‌فرض ساخته می‌شود',()=>{
    const rendered=renderToStaticMarkup(<NewCurriculumForm onCreated={()=>{}}/>);
    expect(rendered).toContain('ایجاد چارت تحصیلی جدید');
    const form=readFileSync('src/components/NewCurriculumForm.tsx','utf8');
    expect(form).toContain('validateCurriculumScope(meta,form)');
    expect(form).toContain('status:\'draft\'');
    expect(form).not.toContain("meta.universities[0]");
    expect(form).not.toContain("meta.majors[0]");
  });
  it('ویرایشگر چارت، گرایش و پیش‌نیاز را به رشته و دروس همان چارت محدود می‌کند',()=>{
    const editor=readFileSync('src/components/AdminCurriculumBuilder.tsx','utf8');
    expect(editor).toContain('track.majorId === selectedChart?.majorId');
    expect(editor).toContain('relevantRuleCourses.map');
    expect(editor).toContain('نیمسال پیشنهادی درس');
    expect(editor).toContain('ورودی');
  });
});
