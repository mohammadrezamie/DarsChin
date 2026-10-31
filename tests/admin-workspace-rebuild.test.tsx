import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AdminCrudTable } from '../src/components/AdminCrudTable';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('admin workspace redesign without changing its privileges or IA', () => {
  it('keeps all existing management destinations and scoped access in one navigation', () => {
    const dashboard = source('src/components/AdminDashboard.tsx');
    for (const tab of ['overview','provinces','campuses','degrees','majors','tracks',
      'entry-years','curricula','courses','academic-rules','terms','offerings','imports',
      'demand','academic-settings','users','support','diagnostics','logs','sms-center']) {
      expect(dashboard).toMatch(new RegExp(`id:\\s*'${tab}'\\s*as AdminTab`));
    }
    expect(dashboard).toContain('adminWorkspaceAccess(user)');
    expect(dashboard).toContain('demandOnly ?');
    expect(dashboard).toContain("activeTab === 'users' && isSuperAdmin");
    expect(dashboard).toContain("activeTab === 'logs' && isSuperAdmin");
    expect(dashboard).toContain('navGroups.reduce((total, group)');
  });

  it('provides an RTL mobile workspace drawer, a searchable desktop sidebar and clear section title', () => {
    const dashboard = source('src/components/AdminDashboard.tsx');
    expect(dashboard).toContain('dir="rtl"');
    expect(dashboard).toContain('lg:grid-cols-[minmax(240px,276px)_minmax(0,1fr)]');
    expect(dashboard).toContain('lg:sticky lg:top-5');
    expect(dashboard).toContain('right-0 flex w-[min(90vw,360px)]');
    expect(dashboard).toContain('role="dialog"');
    expect(dashboard).toContain('aria-modal="true"');
    expect(dashboard).toContain('در محدودهٔ دسترسی شما');
    expect(dashboard).toContain('sectionHeadingRef');
    expect(dashboard).toContain("event.key === 'Escape'");
    expect(dashboard).toContain("document.body.style.overflow = 'hidden'");
    expect(dashboard).toContain("event.key === '/' && !editable");
  });

  it('does not invent success or a zero metric when the stats endpoint is unavailable', () => {
    const dashboard = source('src/components/AdminDashboard.tsx');
    expect(dashboard).toContain("setStatsError(res.error || 'دریافت آمار مدیریت امکان‌پذیر نیست.')");
    expect(dashboard).toContain("value === undefined");
    expect(dashboard).toContain("'—'");
    expect(dashboard).toContain("value.toLocaleString('fa-IR')");
    expect(dashboard).toContain('شاخص‌های اصلی مدیریت');
  });
});

describe('admin data table safeguards and mobile editing', () => {
  it('renders a compact table with search and an explicit add action', () => {
    const html = renderToStaticMarkup(<AdminCrudTable title="بانک درس‌ها"
      endpoint="/api/academic/courses" columns={[{ key: 'name', label: 'عنوان درس' }]} />);
    expect(html).toContain('بانک درس‌ها');
    expect(html).toContain('جدول مدیریت: بانک درس‌ها');
    expect(html).toContain('جست‌وجوی رکوردهای جدول');
    expect(html).toContain('افزودن مورد جدید');
    expect(html).toContain('در حال بارگذاری');
  });

  it('replaces blocking native alerts and confirms irreversible deletes accessibly', () => {
    const component = source('src/components/AdminCrudTable.tsx');
    expect(component).not.toContain("confirm('");
    expect(component).not.toContain("alert(");
    expect(component).toContain('role="alertdialog"');
    expect(component).toContain('aria-modal="true"');
    expect(component).toContain('ref={cancelDeleteRef}');
    expect(component).toContain("document.body.style.overflow = 'hidden'");
    expect(component).toContain("event.key === 'Escape'");
    expect(component).toContain('mutationLockRef.current');
    expect(component).toContain('encodeURIComponent(deleteTarget.id)');
    expect(component).toContain('aria-label={`حذف ${item.name || item.code || item.id}`}');
  });

  it('preserves user input after failed saves and reports failed list loads', () => {
    const component = source('src/components/AdminCrudTable.tsx');
    expect(component).toContain('if (res.success) {\n        setEditingId(null);');
    expect(component).toContain('اطلاعات فرم حفظ شدند');
    expect(component).toContain('requestVersionRef.current');
    expect(component).toContain('!getOptions(column).some(');
    expect(component).toContain('role="alert"');
    expect(component).toContain('data-label={c.label}');
    expect(source('src/index.css')).toContain('.darschin-crud-table td[data-label]::before');
  });
});
