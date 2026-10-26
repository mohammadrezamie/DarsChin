import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDemandResponseForContext } from '../src/utils/demand-response-context';
import { createRequestEpoch } from '../src/utils/request-epoch';
import { demandDetailKey } from '../src/utils/demand-detail-context';

const response = {
  id: 'response-1', userId: 'student-A', surveyId: 'survey-A',
  studentNumber: '1403123456', anticipatedGraduation: 'NO',
  courseIds: ['circuits', 'math'], submittedAt: '2026-10-26', updatedAt: '2026-10-26',
  snapshot: { studentName: 'دانشجوی آزمایشی', campusId: 'campus', majorId: 'major', entryYearId: 'entry', isTrackSelected: false },
};

describe('demand response identity and payload trust boundary', () => {
  it('accepts a valid response only for its signed-in student and selected survey', () => {
    expect(isDemandResponseForContext(response, 'student-A', 'survey-A', ['math', 'circuits'])).toBe(true);
    expect(isDemandResponseForContext(response, 'student-B', 'survey-A', ['math', 'circuits'])).toBe(false);
    expect(isDemandResponseForContext(response, 'student-A', 'survey-B', ['math', 'circuits'])).toBe(false);
  });

  it('allows a genuinely unanswered survey only under an authenticated context', () => {
    expect(isDemandResponseForContext(null, 'student-A', 'survey-A', [])).toBe(true);
    expect(isDemandResponseForContext(null, null, 'survey-A', [])).toBe(false);
    expect(isDemandResponseForContext(null, 'student-A', '', [])).toBe(false);
    expect(isDemandResponseForContext(undefined, 'student-A', 'survey-A', [])).toBe(false);
  });

  it('accepts empty course selections and does not confuse them with missing data', () => {
    expect(isDemandResponseForContext({ ...response, courseIds: [] }, 'student-A', 'survey-A', ['math'])).toBe(true);
    expect(isDemandResponseForContext({ ...response, courseIds: undefined }, 'student-A', 'survey-A', ['math'])).toBe(false);
  });

  it('rejects duplicate, unlisted and malformed course IDs', () => {
    for (const courseIds of [['math', 'math'], ['math', 'foreign'], [42, 'math'], 'math', null]) {
      expect(isDemandResponseForContext({ ...response, courseIds }, 'student-A', 'survey-A', ['math', 'circuits'])).toBe(false);
    }
  });

  it('rejects invalid identity, missing student number and graduation values', () => {
    for (const value of [
      { ...response, userId: '' },
      { ...response, surveyId: null },
      { ...response, studentNumber: 1234 },
      { ...response, anticipatedGraduation: 'UNVERIFIED' },
      [],
      'not-a-response',
    ]) {
      expect(isDemandResponseForContext(value, 'student-A', 'survey-A', ['math', 'circuits'])).toBe(false);
    }
  });

  it('ignores a late save confirmation after selecting a different form or starting a newer save', async () => {
    const epoch = createRequestEpoch();
    const oldKey = demandDetailKey('student', 'survey-A', 0);
    let activeKey = oldKey;
    const first = epoch.begin();
    const isCurrent = (ticket: number, key: string | null) => epoch.isCurrent(ticket) && activeKey === key;
    expect(isCurrent(first, oldKey)).toBe(true);
    activeKey = demandDetailKey('student', 'survey-B', 0);
    await Promise.resolve();
    expect(isCurrent(first, oldKey)).toBe(false);
    activeKey = oldKey;
    epoch.invalidate();
    expect(isCurrent(first, oldKey)).toBe(false);
    const second = epoch.begin();
    expect(isCurrent(second, oldKey)).toBe(true);
  });

  it('enforces the identity checks on both GET and PUT result paths', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/DemandWorkspace.tsx'), 'utf8');
    expect(source).toContain('isDemandResponseForContext(result.data, user?.id, survey.id, survey.courseIds)');
    expect(source).toContain('isDemandResponseForContext(r.data, user?.id, survey.id, survey.courseIds)');
    expect(source).toContain('activeDetailKeyRef.current === submittedKey');
    expect(source).toContain('saveRequestRef.current.isCurrent(submissionEpoch)');
    expect(source).toContain("survey.status !== 'OPEN'");
    expect(source).toContain('saveRequestRef.current.invalidate()');
  });
});
