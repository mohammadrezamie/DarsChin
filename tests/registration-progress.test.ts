import { describe, expect, it } from 'vitest';
import { completedRegistrationCourseIds, parseStoredRegistrationTokens, pruneRegistrationTokens, registrationProgressToken } from '../src/domain/registration-progress';
import type { RegistrationStep } from '../src/domain/registration-queue';

function step(courseId: string, offeringId: string, groupCode = '01', copyCode = '400100'): RegistrationStep {
  return {
    courseId, offeringId, groupCode, copyCode, courseName: 'Synthetic course',
    codeFromOffering: true, requestedRank: 1, effectiveRank: 1,
    advancedForCorequisite: false, dependencyNames: [], dependencyCourseIds: [],
    warnings: [], ready: true,
  };
}

describe('exact-offering manual registration progress', () => {
  it('does not carry a done check onto a different group of the same course', () => {
    const groupA = step('math', 'off-math-01', '01');
    const groupB = step('math', 'off-math-02', '02');
    const marks = [registrationProgressToken(groupA)];
    expect([...completedRegistrationCourseIds([groupA], marks)]).toEqual(['math']);
    expect([...completedRegistrationCourseIds([groupB], marks)]).toEqual([]);
  });

  it('invalidates checked state when the code changes without a new offering ID', () => {
    const before = step('signals', 'off-signals', '08', '400201');
    const updatedCode = { ...before, copyCode: '400202' };
    const updatedGroup = { ...before, groupCode: '09' };
    const marks = [registrationProgressToken(before)];
    expect(completedRegistrationCourseIds([updatedCode], marks).size).toBe(0);
    expect(completedRegistrationCourseIds([updatedGroup], marks).size).toBe(0);
    expect(completedRegistrationCourseIds([before], marks).has('signals')).toBe(true);
  });

  it('does not use a previous class with the same offering ID for a different course', () => {
    const a = step('course-a', 'off-1');
    const b = step('course-b', 'off-1');
    expect(completedRegistrationCourseIds([b], [registrationProgressToken(a)]).size).toBe(0);
  });

  it('removes replaced group state so returning to that group cannot revive an old check', () => {
    const original = step('math', 'off-math-01', '01');
    const replacement = step('math', 'off-math-02', '02');
    const first = [registrationProgressToken(original)];
    const afterSwitch = pruneRegistrationTokens([replacement], first);
    expect(afterSwitch).toEqual([]);
    expect(completedRegistrationCourseIds([original], afterSwitch).size).toBe(0);
    // A removed course is pruned too after loading the authoritative chart.
    expect(pruneRegistrationTokens([], first)).toEqual([]);
  });

  it('preserves valid marks when only priority order changes, not group identity', () => {
    const a = step('signals', 'off-signals');
    const b = step('math', 'off-math');
    const marks = [registrationProgressToken(a), registrationProgressToken(b)];
    expect(completedRegistrationCourseIds([a,b], marks).size).toBe(2);
    expect(completedRegistrationCourseIds([b,a], marks).size).toBe(2);
  });

  it('never treats legacy course-only marks as proof of enrolling in a new group', () => {
    const a = step('math', 'off-math');
    const tokens = parseStoredRegistrationTokens(JSON.stringify(['math', 'signals']));
    expect(tokens).toEqual([]);
    expect(completedRegistrationCourseIds([a], tokens).size).toBe(0);
  });

  it('loads exact saved marks and drops malformed, duplicate or unexpected values', () => {
    const a = step('math', 'off-math');
    const token = registrationProgressToken(a);
    expect(parseStoredRegistrationTokens(JSON.stringify([token, token, 'math', '{}', 'null', 123]))).toEqual([token]);
    expect(parseStoredRegistrationTokens('not-json')).toEqual([]);
    expect(parseStoredRegistrationTokens(JSON.stringify({done:true}))).toEqual([]);
    expect(parseStoredRegistrationTokens('a'.repeat(65_000))).toEqual([]);
  });

  it('filters stale marks when the previously selected group is not in the current schedule', () => {
    const old = step('math', 'old-offering');
    const current = step('signals', 'current-offering');
    const tokens = [registrationProgressToken(old), registrationProgressToken(current)];
    expect([...completedRegistrationCourseIds([current], tokens)]).toEqual(['signals']);
  });
});
