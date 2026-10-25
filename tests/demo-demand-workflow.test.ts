import { beforeEach, describe, expect, it } from 'vitest';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';

beforeEach(async()=>{
  resetBrowserDemo();
  const list=await browserDemoRequest<any[]>('/api/demand/surveys');
  for(const survey of list.data||[]){
    const result=await browserDemoRequest(`/api/demand/surveys/${survey.id}/status`,{method:'PUT',body:JSON.stringify({status:'OPEN'})});
    if(!result.success)throw new Error('Cannot activate synthetic survey fixture');
  }
});

describe('no-account demand testing in isolated browser demo',()=>{
  it('starts with a manager-activated OPEN survey and actual demo curriculum courses',async()=>{
    const list=await browserDemoRequest<any[]>('/api/demand/surveys');
    expect(list.success).toBe(true);
    expect(list.data?.length).toBeGreaterThan(0);
    expect(list.data?.[0].status).toBe('OPEN');
    const chart=await browserDemoRequest<any>('/api/curriculum/demo-curriculum/full');
    expect(chart.data?.courses?.length).toBeGreaterThan(1);
  });
  it('lets a student change choices without creating two votes',async()=>{
    const list=(await browserDemoRequest<any[]>('/api/demand/surveys')).data!;
    const surveyId=list[0].id as string;
    const path=`/api/demand/surveys/${surveyId}/response`;
    const first=await browserDemoRequest<any>(path,{
      method:'PUT',body:JSON.stringify({
        studentNumber:'1403123456',anticipatedGraduation:'YES',courseIds:['math2','circuits'],
      }),
    });
    expect(first.success).toBe(true);
    const edited=await browserDemoRequest<any>(path,{
      method:'PUT',body:JSON.stringify({
        studentNumber:'1403123456',anticipatedGraduation:'NO',courseIds:['math2'],
      }),
    });
    expect(edited.success).toBe(true);
    expect(edited.data?.id).toBe(first.data?.id);
    const report=await browserDemoRequest<any>(`/api/demand/surveys/${surveyId}/report`);
    expect(report.data?.participantCount).toBe(1);
    expect(report.data?.byCourse.find((c:any)=>c.courseId==='circuits').count).toBe(0);
    const csv=await browserDemoRequest<any>(`/api/demand/surveys/${surveyId}/export.csv?format=json`);
    expect(csv.data?.csv).toContain('1403123456');
    expect(csv.data?.csv).toContain('ریاضی عمومی ۲');
  });
  it('retains submitted demand in the student demo when the manager closes it',async()=>{
    const surveyId=(await browserDemoRequest<any[]>('/api/demand/surveys')).data![0].id;
    const endpoint=`/api/demand/surveys/${surveyId}/response`;
    await browserDemoRequest(endpoint,{method:'PUT',body:JSON.stringify({
      studentNumber:'1403123456',anticipatedGraduation:'UNKNOWN',courseIds:['math2'],
    })});
    await browserDemoRequest(`/api/demand/surveys/${surveyId}/status`,{
      method:'PUT',body:JSON.stringify({status:'CLOSED'}),
    });
    const oldWindow=(globalThis as {window?:unknown}).window;
    try {
      Object.assign(globalThis,{window:{location:{pathname:'/demo/student'}}});
      const history=await browserDemoRequest<any[]>('/api/demand/surveys');
      expect(history.data?.some(item=>item.id===surveyId&&item.status==='CLOSED')).toBe(true);
      const own=await browserDemoRequest<any>(endpoint);
      expect(own.data?.courseIds).toEqual(['math2']);
    } finally {
      if(oldWindow===undefined) delete (globalThis as {window?:unknown}).window;
      else Object.assign(globalThis,{window:oldWindow});
    }
  });

  it('rejects unknown courses and closes the survey without removing history',async()=>{
    const surveyId=(await browserDemoRequest<any[]>('/api/demand/surveys')).data![0].id;
    const path=`/api/demand/surveys/${surveyId}/response`;
    const bad=await browserDemoRequest<any>(path,{
      method:'PUT',body:JSON.stringify({studentNumber:'1403123456',
        anticipatedGraduation:'NO',courseIds:['not-in-survey']}),
    });
    expect(bad.success).toBe(false);
    const close=await browserDemoRequest<any>(`/api/demand/surveys/${surveyId}/status`,{
      method:'PUT',body:JSON.stringify({status:'CLOSED'}),
    });
    expect(close.success).toBe(true);
    const after=await browserDemoRequest<any>(path,{method:'PUT',body:JSON.stringify({
      studentNumber:'1403123456',anticipatedGraduation:'YES',courseIds:['math2'],
    })});
    expect(after.success).toBe(false);
  });
});
