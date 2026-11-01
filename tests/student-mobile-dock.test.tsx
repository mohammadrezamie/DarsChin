import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { StudentMobileDock } from '../src/components/StudentMobileDock';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('real student mobile workspace dock', () => {
  it('renders three thumb-friendly destinations and one clearly labelled secondary menu', () => {
    const html = renderToStaticMarkup(<StudentMobileDock
      active="offerings" demandAvailable={false} onSelect={() => {}} />);
    expect(html).toContain('aria-label="دسترسی سریع میز کار دانشجو"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('بخش‌های بیشتر میز کار');
    expect(html).toContain('دروس');
    expect(html).toContain('برنامه');
    expect(html).toContain('صف ثبت');
    expect(html).toContain('min-h-14');
    expect(html).toContain('grid-cols-4');
    expect(html).toContain('safe-area-inset-bottom');
    expect((html.match(/<button/g) ?? [])).toHaveLength(4);
  });

  it('highlights the overflow destination when another workspace is selected', () => {
    const html = renderToStaticMarkup(<StudentMobileDock active="support"
      demandAvailable onSelect={() => {}} />);
    expect(html).toContain('بیشتر');
    expect(html).toContain('bg-teal-50');
    expect(html).toContain('dc-student-dock');
    expect(html).not.toContain('aria-expanded="true"');
  });

  it('keeps the secondary sheet accessible with scroll lock, Escape and keyboard focus wrapping', () => {
    const s = source('src/components/StudentMobileDock.tsx');
    expect(s).toContain('role="dialog"');
    expect(s).toContain('aria-modal="true"');
    expect(s).toContain("document.body.style.overflow = 'hidden'");
    expect(s).toContain("event.key === 'Escape'");
    expect(s).toContain("event.key !== 'Tab'");
    expect(s).toContain('event.shiftKey');
    expect(s).toContain('event.preventDefault()');
    expect(s).toContain('disabled={disabled}');
    expect(s).toContain("item.id === 'demand' && !demandAvailable");
    expect(s).toContain('previousFocusRef.current.focus({ preventScroll: true })');
  });

  it('does not scroll the entire document when moving the selected tab', () => {
    const s = source('src/components/StudentDashboard.tsx');
    expect(s).toContain('const strip = tabStripRef.current');
    expect(s).toContain('strip.scrollBy({ left: delta');
    expect(s).not.toContain('button.scrollIntoView(');
    expect(s).toContain('<StudentMobileDock active={activeTab}');
    expect(s).toContain('workspaceRef.current?.scrollIntoView');
    expect(s).toContain('scroll-mt-6');
    expect(s).toContain('pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]');
  });

  it('prevents overlapping sticky headers between the demo banner and the desktop workspace tabs', () => {
    const demo = source('src/pages/DemoWorkspace.tsx');
    const student = source('src/components/StudentDashboard.tsx');
    expect(demo).not.toContain('md:sticky md:top-0');
    expect(student).toContain('const location = useLocation();');
    expect(student).toContain("location.pathname.startsWith('/demo/')");
    expect(student).toContain("isBrowserDemo ? 'md:top-0' : ''");
    expect(student).toContain('sticky top-[68px]');
  });

  it('compresses repetitive intro content while retaining full academic details on demand', () => {
    const student = source('src/components/StudentDashboard.tsx');
    const demo = source('src/pages/DemoWorkspace.tsx');
    expect(student).toContain('<summary className="flex min-h-11');
    expect(student).toContain('جزئیات پیشرفت تحصیلی');
    expect(demo).toContain('داده‌ها آزمایشی‌اند · توضیحات');
    expect(demo).toContain('md:pb-6');
    expect(demo).toContain('darschin-scroll-x flex flex-nowrap');
  });
});
