import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,beforeEach} from 'vitest';
import {StudyPlanEditor} from '../src/components/StudyPlanEditor';
import {browserDemoRequest,resetBrowserDemo} from '../src/demo/mock-api';
import {studyPlanPayload} from '../src/domain/study-plan-payload';
import type {Curriculum} from '../src/types';
beforeEach(()=>resetBrowserDemo());
describe('ویرایش برنامهٔ مستقل در رابط و دمو',()=>{
 it('renders loading instead of enabling writes before loading the saved plan',()=>{
   const html=renderToStaticMarkup(<StudyPlanEditor chart={{id:'a',majorId:'m',status:'draft'} as Curriculum} assignments={[]} courses={[]} tracks={[]}/>);
   expect(html).toContain('برنامهٔ پیشنهادی مستقل');expect(html).toContain('در حال دریافت برنامه');expect(html).not.toContain('ایجاد برنامهٔ پیشنهادی');
 });
 it('stores and reads an isolated demo plan without changing the chart or rules',async()=>{
   const chart='demo-curriculum',url='/api/curriculum/'+chart+'/study-plan-draft';
   const before=(await browserDemoRequest<any>('/api/curriculum/'+chart+'/full')).data;
   const courseId=before.courses.find((r:any)=>!r.trackId&&r.active!==false).courseId;
   const plan={curriculumId:chart,periods:[{id:'p',kind:'summer',label:'تابستان آزمایشی'}],items:[{id:'i',kind:'course',courseId,periodId:'p'}]};
   expect((await browserDemoRequest<any>(url)).data.validation.status).toBe('absent');
   expect((await browserDemoRequest(url,{method:'PUT',body:JSON.stringify({trackId:null,plan,expectedRevision:null})})).success).toBe(true);
   const loaded=(await browserDemoRequest<any>(url)).data;
   expect(loaded.plan).toEqual(plan);
   expect((await browserDemoRequest(url,{method:'PUT',body:JSON.stringify({trackId:null,plan:null,expectedRevision:null})})).success).toBe(false);
   expect((await browserDemoRequest<any>('/api/curriculum/'+chart+'/full')).data).toEqual(before);
   expect((await browserDemoRequest<any>('/api/curriculum/demo-curriculum-1402/study-plan-draft')).data.plan).toBeNull();
   expect((await browserDemoRequest(url,{method:'PUT',body:JSON.stringify({trackId:null,plan:null,expectedRevision:loaded.revision})})).success).toBe(true);
   expect((await browserDemoRequest<any>(url)).data.plan).toBeNull();
 });
 it('rejects malformed or invented choice pools using shared payload schema',()=>{
   expect(studyPlanPayload.safeParse({trackId:null,plan:{curriculumId:'a',periods:[],items:[{id:'x',kind:'choice',poolId:'fake',periodId:'p',label:'fake'}]}}).success).toBe(false);
 });
});
