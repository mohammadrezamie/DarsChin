import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';

beforeEach(()=>{
  resetBrowserDemo();
  vi.stubGlobal('window',{location:{pathname:'/demo/student'}});
});
afterEach(()=>vi.unstubAllGlobals());

describe('course demand remains inactive until department manager enables it',()=>{
  it('starts with no visible student surveys and manager-owned drafts',async()=>{
    const student=await browserDemoRequest<any[]>('/api/demand/surveys');
    expect(student.success).toBe(true);
    expect(student.data).toEqual([]);
    vi.stubGlobal('window',{location:{pathname:'/demo/admin'}});
    const manager=await browserDemoRequest<any[]>('/api/demand/surveys');
    expect(manager.data?.length).toBeGreaterThanOrEqual(2);
    expect(manager.data?.every(s=>s.status==='DRAFT')).toBe(true);
  });
  it('opens only the selected cohort and keeps other curricula inactive',async()=>{
    vi.stubGlobal('window',{location:{pathname:'/demo/admin'}});
    const enabled=await browserDemoRequest<any>('/api/demand/surveys/demo-demand-fall/status',{
      method:'PUT',body:JSON.stringify({status:'OPEN'}),
    });
    expect(enabled.success).toBe(true);
    vi.stubGlobal('window',{location:{pathname:'/demo/student'}});
    const visible=await browserDemoRequest<any[]>('/api/demand/surveys');
    expect(visible.data?.map(s=>s.id)).toEqual(['demo-demand-fall']);
    const other=await browserDemoRequest<any>('/api/demand/surveys/demo-demand-1402/response',{
      method:'PUT',body:JSON.stringify({studentNumber:'1403123456',anticipatedGraduation:'UNKNOWN',courseIds:['math2']}),
    });
    expect(other.success).toBe(false);
  });
});
