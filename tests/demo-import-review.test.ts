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

  it('lets the synthetic manager review a mapping without changing the visible course catalog', async () => {
    const upload = await browserDemoRequest<any>('/api/imports/process', {
      method: 'POST', body: JSON.stringify({ payload: data }),
    });
    const batchId = upload.data.batch.id;
    const recordId = upload.data.records[0].id;
    const before = (await browserDemoRequest<any[]>('/api/offerings')).data;
    const endpoint = `/api/imports/batches/${batchId}/records/${recordId}/review`;
    const confirm = await browserDemoRequest<any>(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ action: 'CONFIRM_MATCH', courseId: 'math2',
        reason: 'این شناسه فقط برای بازبینی داده نمونه تأیید می‌شود.' }),
    });
    expect(confirm.success).toBe(true);
    expect(confirm.data.reviewDecision).toBe('COURSE_MATCH_CONFIRMED');
    const reject = await browserDemoRequest<any>(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ action: 'REJECT_MATCH',
        reason: 'این رکورد برای تطبیق خودکار مورد تأیید قرار نگرفت.' }),
    });
    expect(reject.success).toBe(true);
    expect(reject.data.reviewDecision).toBe('REJECTED');
    expect((await browserDemoRequest<any[]>('/api/offerings')).data).toEqual(before);
    const invalid = await browserDemoRequest<any>(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ action: 'CONFIRM_MATCH', courseId: 'no-such-course',
        reason: 'درس انتخاب‌شده در کاتالوگ وجود ندارد.' }),
    });
    expect(invalid.success).toBe(false);
  });

  it('keeps the display contract explicitly pending approval', async () => {
    const result = await browserDemoRequest<any>('/api/imports/process', {
      method: 'POST', body: JSON.stringify({ payload: data }),
    });
    expect(result.data?.message).toContain('هیچ گروه');
  });
});
