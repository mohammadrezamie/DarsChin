import { beforeEach, describe, expect, it } from 'vitest';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';

beforeEach(() => resetBrowserDemo());

const data = {
  schemaVersion: '1.0',
  records: [
    {
      courseCode: 'DEMO-101', courseName: 'ریاضی عمومی ۲', group: '01',
      instructor: 'مدرس نمونه', day: 'شنبه', startTime: '08:00',
      endTime: '10:00', capacity: 40, availableCapacity: 10,
    },
    {
      courseCode: 'DEMO-404', courseName: 'درس ناشناخته', group: '99',
      instructor: 'مدرس مجهول', day: '', startTime: '', endTime: '',
    },
  ],
};

describe('isolated browser-only Educationalyar import preview', () => {
  it('accepts an object payload, previews exact matches and preserves the original offerings', async () => {
    const original = (await browserDemoRequest<any[]>('/api/offerings')).data!;
    const result = await browserDemoRequest<any>('/api/imports/process', {
      method: 'POST', body: JSON.stringify({ payload: data }),
    });
    expect(result.success).toBe(true);
    expect(result.data?.summary).toEqual({
      total: 2, matched: 1, review: 1, invalid: 0,
    });
    expect(result.data?.requiresReview).toBe(true);
    expect(result.data?.createdOfferingsCount).toBe(0);
    expect((await browserDemoRequest<any[]>('/api/offerings')).data).toEqual(original);
    const history = await browserDemoRequest<any[]>('/api/imports/batches');
    expect(history.data).toHaveLength(1);
    const detail = await browserDemoRequest<any>(`/api/imports/batches/${history.data![0].id}`);
    expect(detail.data.records).toHaveLength(2);
    expect(detail.data.batch.rawJson).toBeUndefined();
  });

  it('stores all-review unmatched imports as a review queue instead of a hard failure', async () => {
    const result = await browserDemoRequest<any>('/api/imports/process', {
      method: 'POST', body: JSON.stringify({ payload: { records: [data.records[1]] } }),
    });
    expect(result.success).toBe(true);
    expect(result.data?.summary.matched).toBe(0);
    expect(result.data?.summary.review).toBe(1);
    expect(result.data?.createdOfferingsCount).toBe(0);
    resetBrowserDemo();
    expect((await browserDemoRequest<any[]>('/api/imports/batches')).data).toHaveLength(0);
  });

  it('keeps the display contract explicitly pending approval', async () => {
    const result = await browserDemoRequest<any>('/api/imports/process', {
      method: 'POST', body: JSON.stringify({ payload: data }),
    });
    expect(result.data?.message).toContain('هیچ گروه');
  });
});
