import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';
import { DemoWorkspace } from '../src/pages/DemoWorkspace';
import { apiRequest } from '../src/utils/api';

beforeEach(() => resetBrowserDemo());

afterEach(() => vi.unstubAllGlobals());

describe('isolated browser demo API', () => {
  it('intercepts the real API client on demo routes without a network request', async () => {
    const network = vi.fn(() => { throw new Error('Any network call would leak demo traffic'); });
    vi.stubGlobal('window', { location: { pathname: '/demo/student' } });
    vi.stubGlobal('fetch', network);
    const response = await apiRequest<any[]>('/api/academic/courses');
    expect(response.success).toBe(true);
    expect(response.data?.length).toBeGreaterThan(2);
    expect(network).not.toHaveBeenCalled();
  });

  it('provides synthetic offerings and a preview-only eligibility report', async () => {
    const offerings = await browserDemoRequest<any[]>('/api/offerings');
    expect(offerings.success).toBe(true);
    expect(offerings.data?.length).toBeGreaterThan(2);

    const evalRes = await browserDemoRequest<any>('/api/eligibility/evaluate', { method: 'POST', body: '{}' });
    expect(evalRes.success).toBe(true);
    expect(evalRes.data?.report?.results?.length).toBeGreaterThan(2);
    expect(evalRes.data?.report?.results?.[0]?.primaryReason).toContain('ساختگی');
  });

  it('supports adding an isolated academic catalog item and clearing the demo', async () => {
    const item = await browserDemoRequest<any>('/api/academic/courses', {
      method: 'POST', body: JSON.stringify({code:'DEMO-EXTRA',name:'درس تستی',units:2,category:'اصلی'}),
    });
    expect(item.success).toBe(true);
    expect((await browserDemoRequest<any[]>('/api/academic/courses')).data?.some(r=>r.code==='DEMO-EXTRA')).toBe(true);
    resetBrowserDemo();
    expect((await browserDemoRequest<any[]>('/api/academic/courses')).data?.some(r=>r.code==='DEMO-EXTRA')).toBe(false);
  });

  it('keeps sample plan modifications across requests', async () => {
    await browserDemoRequest('/api/student/plan', { method:'PUT',body:JSON.stringify({selectedOfferingIds:['off-logic'],coursePriorities:['logic']}) });
    expect((await browserDemoRequest<any>('/api/student/plan')).data?.selectedOfferingIds).toEqual(['off-logic']);
  });

  it('does not silently pretend unsupported admin or university workflows succeed', async () => {
    expect((await browserDemoRequest('/api/curriculum/rules', {method:'POST',body:'{}'})).success).toBe(false);
    expect((await browserDemoRequest('/api/admin/diagnostics')).success).toBe(false);
    expect((await browserDemoRequest('/api/auth/login', {method:'POST'})).success).toBe(false);
  });

  it('shows distinct roles and the prominent fake-data notice on actual dashboards', () => {
    const student = renderToStaticMarkup(<MemoryRouter><DemoWorkspace role="student" /></MemoryRouter>);
    const admin = renderToStaticMarkup(<MemoryRouter><DemoWorkspace role="admin" /></MemoryRouter>);
    expect(student).toContain('محیط آزمایشیِ بدون حساب واقعی');
    expect(admin).toContain('در حال آماده‌سازی محیط آزمایشی');
    expect(student).toContain('دانشجوی آزمایشی');
    expect(admin).toContain('مدیر آزمایشی');
    expect(student).toContain('بازنشانی دمو');
  });
});
