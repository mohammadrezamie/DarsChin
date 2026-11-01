import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ADMIN_TABS } from '../src/utils/admin-navigation';
import { HELP_FAQ, HELP_TOPICS, filterHelpTopics, helpTopicById } from '../src/help/topics';
import { HelpCenterPage } from '../src/pages/HelpCenterPage';
import { SectionHelp } from '../src/components/SectionHelp';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const studentTabs = ['offerings','schedule','registration','recommendations','passed','demand','support'];

describe('Help is accurate, discoverable and contextual in all current workspaces', () => {
  it('has unique section guidance for every student and admin tab, not empty placeholders', () => {
    const ids = HELP_TOPICS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tab of studentTabs) {
      const topic = helpTopicById(`student-${tab}`);
      expect(topic?.audience).toBe('student');
      expect(topic?.steps.length).toBeGreaterThanOrEqual(3);
      expect(topic?.summary.length).toBeGreaterThan(16);
    }
    for (const tab of ADMIN_TABS) {
      const topic = helpTopicById(`admin-${tab}`);
      expect(topic?.audience).toBe('admin');
      expect(topic?.steps.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('searches words in Persian and normalizes Arabic yeh/kaf spellings', () => {
    expect(filterHelpTopics('نیازسنجی').some(t => t.id === 'student-demand')).toBe(true);
    expect(filterHelpTopics('چارت', 'admin').every(t => t.audience === 'admin')).toBe(true);
    expect(filterHelpTopics('كد گروه').some(t => t.id === 'student-registration')).toBe(true);
    expect(filterHelpTopics('عبارت کاملاً ناموجود')).toHaveLength(0);
    expect(filterHelpTopics('', 'student')).toHaveLength(studentTabs.length);
  });

  it('shows concise, expandable in-place help with a deep link, without scrolling-heavy content by default', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><SectionHelp topicId="student-registration" demo /></MemoryRouter>,
    );
    expect(html).toContain('این بخش چطور کار می‌کند؟');
    expect(html).toContain('<details');
    expect(html).toContain('صف سریع ثبت دروس');
    expect(html).toContain('/help?topic=student-registration');
    expect(html).toContain('نسخهٔ آزمایشی');
    expect(html).toContain('aria-label=');
  });

  it('does not generate misleading help for unknown or unauthorized-only topics', () => {
    const html = renderToStaticMarkup(<MemoryRouter><SectionHelp topicId="admin-unknown" /></MemoryRouter>);
    expect(html).toBe('');
    expect(helpTopicById('__proto__')).toBeUndefined();
  });

  it('renders a public searchable center with category navigation and genuine FAQs', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/help']}>
      <HelpCenterPage />
    </MemoryRouter>);
    expect(html).toContain('راهنمای استفاده از محصول');
    expect(html).toContain('دنبال چه چیزی می‌گردی؟');
    expect(html).toContain('aria-label="دسته‌بندی راهنما"');
    expect(html).toContain('همهٔ راهنماها');
    expect(html).toContain('راهنمای بخش‌های درس‌چین');
    expect(html).toContain('سؤال‌های پرتکرار');
    expect(html).toContain('id="help-topic-student-registration"');
    expect(html).toContain('id="help-topic-admin-demand"');
    expect(HELP_FAQ.length).toBeGreaterThanOrEqual(10);
    expect((html.match(/<details/g) ?? []).length).toBeGreaterThan(HELP_FAQ.length);
  });

  it('links directly to the current topic and retains student/admin context', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/help?topic=admin-demand']}>
      <HelpCenterPage />
    </MemoryRouter>);
    expect(html).toContain('راهنمای بخش انتخاب‌شده');
    expect(html).toContain('id="help-topic-admin-demand"');
    expect(html).toContain('نیازسنجی و گزارش مدیر گروه');
    expect(html).toContain('aria-pressed="true"');
  });

  it('makes help reachable from public, demo, authenticated mobile and both workspaces', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('<Route path="/help"');
    const landing = read('src/pages/Landing.tsx');
    expect(landing).toContain('مرکز آموزش و سؤالات متداول');
    const demo = read('src/pages/DemoWorkspace.tsx');
    expect(demo).toContain('راهنمای استفاده');
    const nav = read('src/components/Navbar.tsx');
    expect(nav).toContain('مرکز راهنمای استفاده');
    const student = read('src/components/StudentDashboard.tsx');
    expect(student).toContain('topicId={`student-${activeTab}`}');
    const admin = read('src/components/AdminDashboard.tsx');
    expect(admin).toContain('topicId={`admin-${activeTab}`}');
  });
});
