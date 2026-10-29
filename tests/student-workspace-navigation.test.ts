import { describe, expect, it } from 'vitest';
import { parseStudentWorkspace, studentWorkspaceParams } from '../src/domain/student-workspace-navigation';

describe('mobile workspace URL navigation', () => {
  it('accepts only supported student destinations', () => {
    expect(parseStudentWorkspace('schedule')).toBe('schedule');
    expect(parseStudentWorkspace('registration')).toBe('registration');
    expect(parseStudentWorkspace('recommendations')).toBe('recommendations');
    expect(parseStudentWorkspace('passed')).toBe('passed');
    expect(parseStudentWorkspace('demand')).toBe('demand');
    expect(parseStudentWorkspace('support')).toBe('support');
    expect(parseStudentWorkspace('admin')).toBe('offerings');
    expect(parseStudentWorkspace(null)).toBe('offerings');
    expect(parseStudentWorkspace('')).toBe('offerings');
  });

  it('uses browser-addressable tabs without encoding private course or student data', () => {
    const before = new URLSearchParams('ref=installed');
    const next = studentWorkspaceParams(before, 'schedule');
    expect(next.get('tab')).toBe('schedule');
    expect(next.get('ref')).toBe('installed');
    expect(before.get('tab')).toBeNull();
    const home = studentWorkspaceParams(next, 'offerings');
    expect(home.has('tab')).toBe(false);
    expect(home.get('ref')).toBe('installed');
  });

  it('keeps the private administrator route outside student navigation', () => {
    const source = studentWorkspaceParams(new URLSearchParams(), 'registration');
    expect(source.toString()).toBe('tab=registration');
    expect(parseStudentWorkspace('users')).toBe('offerings');
  });
});
