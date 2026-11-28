import React from 'react';
import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {buildCurriculumSemesterPreview} from '../src/domain/curriculum-semester-preview';
import {CurriculumSemesterPreview} from '../src/components/CurriculumSemesterPreview';
import type {Curriculum, CurriculumCourse, Course, Track} from '../src/types';
const chart={id:'chart-a',majorId:'major-a',name:'چارت آزمایشی'} as Curriculum;
const courses:Course[]=['common','a','b','old','late'].map(id=>({id,code:id,name:'درس '+id,units:2,category:'پایه',active:id!=='old'}));
const tracks:Track[]=['a','b','foreign'].map(id=>({id,code:id,name:'گرایش '+id,majorId:id==='foreign'?'major-b':'major-a',active:true}));
const link=(courseId:string,semester:number,trackId:string|null=null,extra:Partial<CurriculumCourse>={}):CurriculumCourse=>({id:courseId+'-'+trackId,curriculumId:chart.id,courseId,suggestedSemester:semester,trackId,classification:'MAJOR_REQUIRED',active:true,...extra});
const base=[link('common',1),link('a',3,'a'),link('b',4,'b'),link('late',10),link('old',2,'a'),link('other',5,null,{curriculumId:'chart-b'}),link('hidden',8,'a',{active:false})];
const preview=(trackId:string|null,rows=base)=>buildCurriculumSemesterPreview(chart.id,chart.majorId,rows,courses,tracks,trackId);
describe('نمای پیشنهادی چارت به تفکیک گرایش',()=>{
 it('shows only shared courses until an explicit track is chosen',()=>{
  expect(preview(null).groups.map(g=>g.semester)).toEqual([1,10]);
  expect(preview('a').groups.flatMap(g=>g.courses.map(c=>c.courseId))).toEqual(['common','a','late']);
  expect(preview('b').groups.flatMap(g=>g.courses.map(c=>c.courseId))).toEqual(['common','b','late']);
  expect(preview('foreign').scopeValid).toBe(false);
  expect(preview('foreign').totalCourses).toBe(0);
 });
 it('does not fabricate eight semesters, fill gaps or expose another chart',()=>{
  expect(preview('a').groups.map(g=>g.semester)).toEqual([1,3,10]);
  expect(preview('a').inactiveCount).toBe(1);
  expect(preview('a').unplanned.map(c=>c.courseId)).toEqual(['old']);
 });
 it('keeps missing suggestions and unknown catalogue rows visible for review',()=>{
  const rows=[link('common',null as unknown as number),link('a',0,'a'),link('missing',2)];
  const result=preview('a',rows);
  expect(result.groups).toEqual([]);
  expect(result.unplanned.map(c=>c.courseId).sort()).toEqual(['a','common','missing']);
  expect(result.reviewCount).toBe(2);
 });
 it('never counts duplicate track/shared assignments twice or invents a placement',()=>{
  const result=preview('a',[link('common',1),link('common',4,'a')]);
  expect(result.totalCourses).toBe(1);
  expect(result.groups).toEqual([]);
  expect(result.unplanned[0].assignments).toHaveLength(2);
  expect(result.reviewCount).toBe(1);
 });
 it('renders explicit scope and a disclaimer without displaying foreign course rows',()=>{
  const html=renderToStaticMarkup(<CurriculumSemesterPreview chart={chart} assignments={base} courses={courses} tracks={tracks}/>);
  expect(html).toContain('نمای نیمسال‌به‌نیمسال');
  expect(html).toContain('فقط دروس مشترک');
  expect(html).toContain('نه مصوبه');
  expect(html).toContain('درس common');
  expect(html).not.toContain('درس a');
  expect(html).not.toContain('گرایش foreign');
 });
});
