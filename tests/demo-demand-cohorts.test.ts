import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';

beforeEach(() => { resetBrowserDemo(); vi.stubGlobal('window', { location: { pathname: '/demo/student' } }); });
afterEach(() => vi.unstubAllGlobals());

describe('different entrance cohorts never receive each other\'s academic demand form', () => {
  it('shows 1403 survey and hides 1402, then swaps safely after switching demo profile', async () => {
    const first = await browserDemoRequest<any[]>('/api/demand/surveys');
    expect(first.data?.map(item => item.id)).toEqual(['demo-demand-fall']);
    const changed = await browserDemoRequest<any>('/api/demo/academic-cohort', {
      method: 'PUT', body: JSON.stringify({ entryYearId: 'demo-entry-1402' }),
    });
    expect(changed.success).toBe(true);
    expect(changed.data?.profile?.entryYearId).toBe('demo-entry-1402');
    const second = await browserDemoRequest<any[]>('/api/demand/surveys');
    expect(second.data?.map(item => item.id)).toEqual(['demo-demand-1402']);
    expect(second.data?.[0]?.courseIds).toHaveLength(4);
    expect(first.data?.[0]?.courseIds).toHaveLength(6);
  });

  it('shows only common plus selected-track survey for 1403, not the opposite track', async () => {
    const power = await browserDemoRequest<any>('/api/demo/academic-cohort', {
      method: 'PUT', body: JSON.stringify({ entryYearId: 'demo-entry', selectedTrackId: 'demo-power' }),
    });
    expect(power.success).toBe(true);
    const powerList = await browserDemoRequest<any[]>('/api/demand/surveys');
    expect(powerList.data?.map(item=>item.id).sort()).toEqual(['demo-demand-1403-power','demo-demand-fall']);
    const denied = await browserDemoRequest<any>('/api/demand/surveys/demo-demand-1403-control/response', {
      method: 'PUT', body: JSON.stringify({
        studentNumber:'1403123456',anticipatedGraduation:'NO',courseIds:['signals'],
      }),
    });
    expect(denied.success).toBe(false);
    const control = await browserDemoRequest('/api/demo/academic-cohort', {
      method: 'PUT', body: JSON.stringify({ entryYearId: 'demo-entry', selectedTrackId: 'demo-control' }),
    });
    expect(control.success).toBe(true);
    const controlList = await browserDemoRequest<any[]>('/api/demand/surveys');
    expect(controlList.data?.map(item=>item.id).sort()).toEqual(['demo-demand-1403-control','demo-demand-fall']);
    const cannotMix = await browserDemoRequest('/api/demo/academic-cohort',{
      method:'PUT',body:JSON.stringify({entryYearId:'demo-entry-1402',selectedTrackId:'demo-power'}),
    });
    expect(cannotMix.success).toBe(false);
  });

  it('rejects cross-cohort requests and keeps responses separate from the other cohort', async () => {
    await browserDemoRequest('/api/demo/academic-cohort', {
      method: 'PUT', body: JSON.stringify({ entryYearId: 'demo-entry-1402' }),
    });
    const bad = await browserDemoRequest<any>('/api/demand/surveys/demo-demand-fall/response', {
      method:'PUT', body:JSON.stringify({
        studentNumber:'1402123456', anticipatedGraduation:'NO', courseIds:['em'],
      }),
    });
    expect(bad.success).toBe(false);
    const otherChart = await browserDemoRequest<any>('/api/curriculum/demo-curriculum-1402/full');
    expect(otherChart.success).toBe(true);
    expect(otherChart.data?.courses).toHaveLength(4);
    const good = await browserDemoRequest<any>('/api/demand/surveys/demo-demand-1402/response', {
      method:'PUT', body:JSON.stringify({
        studentNumber:'1402123456', anticipatedGraduation:'NO', courseIds:['math2'],
      }),
    });
    expect(good.success).toBe(true);
    const stats1402 = await browserDemoRequest<any>('/api/demand/surveys/demo-demand-1402/report');
    const stats1403 = await browserDemoRequest<any>('/api/demand/surveys/demo-demand-fall/report');
    expect(stats1402.data?.participantCount).toBe(1);
    expect(stats1403.data?.participantCount).toBe(0);
  });
});