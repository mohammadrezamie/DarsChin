import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  formatDemoBugReport,
  sanitizeDemoPathname,
  validateDemoBugReport,
} from '../src/demo/bug-report';
import { DemoWorkspace } from '../src/pages/DemoWorkspace';
import { PlannerDemo } from '../src/pages/PlannerDemo';

const sample = {
  title: 'دکمه تست کار نکرد',
  steps: '۱. ورود به دمو\n۲. کلیک روی دکمه',
  expected: 'یک پیام دیده شود',
  actual: 'هیچ اتفاقی نیفتاد',
  area: 'student' as const,
  severity: 'medium' as const,
  pathname: '/demo/student?session_token=never-include-this#test',
  recordedAt: '2026-10-25T12:00:00.000Z',
};

describe('offline demo bug-report workflow', () => {
  it('requires all four human-entered reproduction fields', () => {
    expect(validateDemoBugReport(sample)).toBeNull();
    expect(validateDemoBugReport({ ...sample, title: ' ' })).not.toBeNull();
    expect(validateDemoBugReport({ ...sample, steps: ' ' })).not.toBeNull();
    expect(validateDemoBugReport({ ...sample, expected: ' ' })).not.toBeNull();
    expect(validateDemoBugReport({ ...sample, actual: ' ' })).not.toBeNull();
  });

  it('builds a complete Persian markdown report with a reproducible path', () => {
    const result = formatDemoBugReport(sample);
    expect(result).toContain('# گزارش باگ درس‌چین (دمو)');
    expect(result).toContain('**بخش:** پنل دانشجو');
    expect(result).toContain('**مسیر:** `/demo/student`');
    expect(result).toContain('## مراحل بازتولید');
    expect(result).toContain(sample.expected);
    expect(result).toContain(sample.actual);
    expect(result).toContain('2026-10-25T12:00:00.000Z');
    expect(result).not.toContain('session_token');
    expect(result).not.toContain('never-include-this');
  });

  it('never includes origins, query strings or unrelated locations automatically', () => {
    expect(sanitizeDemoPathname('/demo/admin?jwt=secret')).toBe('/demo/admin');
    expect(sanitizeDemoPathname('/demo#security')).toBe('/demo');
    expect(sanitizeDemoPathname('https://site.example/demo/student')).toBe('/demo');
    expect(sanitizeDemoPathname('/api/admin/users')).toBe('/demo');
    expect(sanitizeDemoPathname('/demo/../../private')).toBe('/demo');
  });

  it('includes a clearly labeled offline issue tool in both dashboard demos and the planner', () => {
    const student = renderToStaticMarkup(<MemoryRouter><DemoWorkspace role="student" /></MemoryRouter>);
    const admin = renderToStaticMarkup(<MemoryRouter><DemoWorkspace role="admin" /></MemoryRouter>);
    const planner = renderToStaticMarkup(<MemoryRouter><PlannerDemo /></MemoryRouter>);
    for (const html of [student, admin, planner]) {
      expect(html).toContain('گزارش باگ دمو');
    }
  });

  it('does not treat a blank report as successful', () => {
    expect(() => formatDemoBugReport({ ...sample, steps: '' })).toThrow();
  });
});
