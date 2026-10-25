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
    expect(first.data?.[0]?.courseIds).toHaveLength(8);
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