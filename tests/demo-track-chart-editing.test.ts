import { beforeEach, describe, expect, it } from 'vitest';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';

beforeEach(()=>resetBrowserDemo());

describe('demo curriculum track isolation',()=>{
  it('refuses ambiguous delete, permits exact track delete and keeps common assignment',async()=>{
    const meta=(await browserDemoRequest<any>('/api/academic/all-meta')).data!;
    const pilot=(await browserDemoRequest<any[]>('/api/curriculum')).data!
      .find(row=>row.id==='demo-curriculum');
    expect(pilot).toBeDefined();
    const created=await browserDemoRequest<any>('/api/curriculum',{
      method:'POST',body:JSON.stringify({
        name:'چارت پیش‌نویس آزمایشی برای تست گرایش',version:'track-test-1',
        status:'draft',universityId:pilot.universityId,campusId:pilot.campusId,
        degreeLevelId:pilot.degreeLevelId,majorId:pilot.majorId,entryYearId:pilot.entryYearId,
      }),
    });
    expect(created.success).toBe(true);
    const endpoint=`/api/curriculum/${created.data.id}/courses`;
    const shared=await browserDemoRequest<any>(endpoint,{method:'POST',body:JSON.stringify({
      courseId:'math2',classification:'MAJOR_REQUIRED',suggestedSemester:2,
    })});
    const track=await browserDemoRequest<any>(endpoint,{method:'POST',body:JSON.stringify({
      courseId:'math2',trackId:'demo-power',classification:'TRACK_REQUIRED',suggestedSemester:3,
    })});
    expect(shared.success).toBe(true);
    expect(track.success).toBe(true);
    const ambiguous=await browserDemoRequest<any>(`${endpoint}/math2`,{method:'DELETE'});
    expect(ambiguous.success).toBe(false);
    const exact=await browserDemoRequest<any>(`${endpoint}/math2?trackId=demo-power`,{method:'DELETE'});
    expect(exact.success).toBe(true);
    const remaining=await browserDemoRequest<any[]>(endpoint);
    expect(remaining.data).toHaveLength(1);
    expect(remaining.data?.[0].trackId).toBeNull();
    expect(remaining.data?.[0].courseId).toBe('math2');
  });
});
