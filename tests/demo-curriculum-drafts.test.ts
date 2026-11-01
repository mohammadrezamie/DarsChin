import { beforeEach, describe, expect, it } from 'vitest';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';

beforeEach(() => resetBrowserDemo());

const create = (path: string, payload: unknown) => browserDemoRequest<any>(path, {
  method: 'POST', body: JSON.stringify(payload),
});
const draft = () => ({
  universityId: 'demo-university', campusId: 'demo-campus',
  degreeLevelId: 'demo-degree', majorId: 'demo-major',
  entryYearId: 'demo-entry', version: '1403-demo-2',
  name: 'چارت جدید آزمایشی', status: 'draft',
});

describe('isolated admin curriculum draft editor', () => {
  it('allows a synthetically scoped draft and rejects active or invalid campus/major combinations', async () => {
    expect((await create('/api/curriculum', { ...draft(), status: 'active' })).success).toBe(false);
    expect((await create('/api/curriculum', { ...draft(), campusId: 'wrong-campus' })).success).toBe(false);
    const result = await create('/api/curriculum', draft());
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('draft');
    expect((await create('/api/curriculum', draft())).success).toBe(false);
    const stored = await browserDemoRequest<any[]>('/api/curriculum');
    expect(stored.data?.some(c => c.id === result.data.id && c.status === 'draft')).toBe(true);
  });

  it('can add a course and valid rule AST to a draft but never reinterpret official eligibility', async () => {
    const chart = (await create('/api/curriculum', draft())).data;
    const link = await create(`/api/curriculum/${chart.id}/courses`, {
      courseId: 'math2', classification: 'MAJOR_REQUIRED', suggestedSemester: 2,
    });
    expect(link.success).toBe(true);
    const prerequisite = await create(`/api/curriculum/${chart.id}/courses`, {
      courseId: 'physics', classification: 'MAJOR_REQUIRED', suggestedSemester: 1,
    });
    expect(prerequisite.success).toBe(true);
    const source = await create('/api/curriculum/rules', {
      curriculumId: chart.id, targetCourseId: 'math2',
      relationshipType: 'PREREQUISITE', expression: { type: 'COURSE', courseId: 'physics' },
    });
    expect(source.success).toBe(true);
    expect((await create('/api/curriculum/rules', {
      curriculumId: chart.id, targetCourseId: 'physics',
      relationshipType: 'PREREQUISITE', expression: { type: 'COURSE', courseId: 'math2' },
    })).success).toBe(false);
    const full = await browserDemoRequest<any>(`/api/curriculum/${chart.id}/full`);
    expect(full.data?.courses).toHaveLength(2);
    expect(full.data?.prerequisites).toHaveLength(1);
    expect(full.data?.corequisites).toHaveLength(0);
    const simulation = await browserDemoRequest<any>('/api/eligibility/evaluate', {
      method: 'POST', body: JSON.stringify({}),
    });
    expect(simulation.success).toBe(true);
    expect(simulation.data?.report?.results?.[0]?.primaryReason).toContain('ساختگی');
    resetBrowserDemo();
    expect((await browserDemoRequest<any[]>('/api/curriculum')).data?.some(c => c.id === chart.id)).toBe(false);
  });

  it('does not permit editing the preexisting active mock curriculum', async () => {
    expect((await create('/api/curriculum/demo-curriculum/courses', {
      courseId: 'math2', classification: 'MAJOR_REQUIRED',
    })).success).toBe(false);
  });
});
