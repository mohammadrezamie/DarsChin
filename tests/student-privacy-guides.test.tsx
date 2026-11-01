import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardShowcaseSection } from '../src/pages/landing-sections/DashboardShowcaseSection';
import { StudentWorkspaceGuide, studentHelp } from '../src/components/StudentWorkspaceGuide';
import { DemoWorkspace } from '../src/pages/DemoWorkspace';

const source = (path:string) => readFileSync(resolve(process.cwd(), path),'utf8');

describe('student-first public product and contextual onboarding', () => {
  it('public landing and simple demo never advertise internal management workspaces', () => {
    for(const path of ['src/pages/Landing.tsx','src/pages/PlannerDemo.tsx',
      'src/pages/landing-sections/DashboardShowcaseSection.tsx']){
      const code=source(path);
      expect(code,path).not.toContain('/demo/admin');
      expect(code,path).not.toContain('پنل مدیریت آموزشی');
      expect(code,path).not.toContain('آزمایش پنل مدیریت');
    }
    const html=renderToStaticMarkup(<MemoryRouter><DashboardShowcaseSection /></MemoryRouter>);
    expect(html).toContain('از انتخاب درس تا آماده‌باش');
    expect(html).toContain('href="/demo/student"');
    expect(html).not.toContain('پنل مدیریت');
    expect(html).not.toContain('/demo/admin');
  });

  it('synthetic student demo offers student destinations only', () => {
    const student=renderToStaticMarkup(<MemoryRouter><DemoWorkspace role="student" /></MemoryRouter>);
    expect(student).toContain('دانشجوی آزمایشی');
    expect(student).not.toContain('href="/demo/admin"');
    expect(student).not.toContain('پنل مدیریت');
  });

  it('the hidden manager demo route first enforces actual authenticated manager permission', () => {
    const code=source('src/App.tsx');
    expect(code).toContain('const ProtectedManagerDemo: React.FC');
    expect(code).toContain("adminWorkspaceAccess(user).isAdmin");
    expect(code).toContain('<Navigate to="/demo/student" replace />');
    expect(code).toContain('<Route path="/demo/admin" element={<ProtectedManagerDemo />} />');
    expect(code).not.toContain('<Route path="/demo/admin" element={<DemoWorkspace role="admin" />} />');
  });

  it('each of seven student workspaces has accurate steps and a safety note', () => {
    const tabs=['offerings','schedule','registration','recommendations','passed','demand','support'] as const;
    expect(Object.keys(studentHelp).sort()).toEqual([...tabs].sort());
    for (const tab of tabs) {
      const item=studentHelp[tab];
      expect(item.title.length).toBeGreaterThan(6);
      expect(item.summary.length).toBeGreaterThan(18);
      expect(item.steps).toHaveLength(3);
      expect(item.tip.length).toBeGreaterThan(15);
      const html=renderToStaticMarkup(<StudentWorkspaceGuide active={tab} demandAvailable
        onSelect={()=>{}} />);
      expect(html).toContain(item.title);
      expect(html).toContain(item.summary);
      expect(html).toContain('این بخش چه کاری می‌کند؟');
      expect(html).toContain('راهنمای کامل بخش‌ها');
      expect(html).toContain('<details');
      expect(html).toContain('min-h-11');
    }
  });

  it('does not show irrelevant management instructions in student help', () => {
    const code=source('src/components/StudentWorkspaceGuide.tsx');
    expect(code).not.toContain('مدیریت مدیران');
    expect(code).not.toContain('/admin');
    expect(code).toContain('سؤال‌های متداول');
    expect(code).toContain('disabled={key === \'demand\' && !demandAvailable}');
    expect(source('src/components/StudentDashboard.tsx')).toContain('<StudentWorkspaceGuide');
  });
});
