import { beforeEach, describe, expect, it } from 'vitest';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';

beforeEach(()=>resetBrowserDemo());

describe('browser-only department manager assignment lab',()=>{
  it('allows a synthetic root to grant and revoke the EE pilot scope',async()=>{
    const admins=await browserDemoRequest<any[]>('/api/admin-management');
    const manager=admins.data?.find(u=>u.id==='demo-department-manager');
    expect(manager?.roles).toEqual(['admin']);
    expect(manager?.demandScopes).toEqual([]);
    const meta=(await browserDemoRequest<any>('/api/academic/all-meta')).data!;
    const scope={campusId:meta.campuses[0].id,degreeLevelId:meta.degreeLevels[0].id,majorId:meta.majors[0].id};
    const endpoint='/api/admin-management/demo-department-manager/demand-scopes';
    const updated=await browserDemoRequest<any>(endpoint,{method:'PUT',body:JSON.stringify({scopes:[scope]})});
    expect(updated.success).toBe(true);
    expect(updated.data?.demandScopes).toEqual([scope]);
    const duplicate=await browserDemoRequest<any>(endpoint,{method:'PUT',body:JSON.stringify({scopes:[scope,scope]})});
    expect(duplicate.success).toBe(false);
    const foreignMajor=await browserDemoRequest<any>(endpoint,{method:'PUT',body:JSON.stringify({scopes:[{...scope,majorId:'foreign'}]})});
    expect(foreignMajor.success).toBe(false);
    const removed=await browserDemoRequest<any>(endpoint,{method:'PUT',body:JSON.stringify({scopes:[]})});
    expect(removed.success).toBe(true);
    expect(removed.data?.demandScopes).toEqual([]);
  });
});
