import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AdminCrudTable } from '../src/components/AdminCrudTable';

const source = () => readFileSync(resolve(process.cwd(), 'src/components/AdminCrudTable.tsx'), 'utf8');

describe('admin CRUD feedback and error handling', () => {
  it('renders readable touch-sized controls and preserves existing mobile/desktop experiences', () => {
    const html = renderToStaticMarkup(
      <AdminCrudTable
        title="بانک دروس"
        endpoint="/api/academic/courses"
        columns={[
          { key: 'name', label: 'عنوان درس' },
          { key: 'units', label: 'واحد', type: 'number' },
        ]}
      />,
    );
    expect(html).toContain('بانک دروس');
    expect(html).toContain('جستجو در سطرها');
    expect(html).toContain('افزودن مورد جدید');
    expect(html).toContain('رکوردهای بانک دروس');
    expect(html).toContain('md:hidden');
    expect(html).toContain('md:block');
    expect(html).toContain('aria-label="بروزرسانی داده‌ها"');
  });

  it('shows accessible in-page errors instead of blocking native dialogs', () => {
    const ui = source();
    expect(ui).not.toMatch(/\bwindow\.alert\s*\(|\balert\s*\(/);
    expect(ui).not.toMatch(/\bwindow\.confirm\s*\(|\bconfirm\s*\(/);
    expect(ui).toContain('role={feedback.kind === \'error\' ? \'alert\' : \'status\'}');
    expect(ui).toContain('aria-live=');
    expect(ui).toContain('تأیید حذف رکورد');
    expect(ui).toContain('انصراف');
    expect(ui).toContain('خطای ارتباط هنگام حذف رکورد');
    expect(ui).toContain('ذخیره‌سازی انجام نشد. اطلاعات فرم حفظ شده‌اند.');
  });

  it('avoids falsely claiming empty results on failed API calls or using stale endpoints', () => {
    const ui = source();
    expect(ui).toContain('if (response.success && Array.isArray(response.data))');
    expect(ui).toContain("setFeedback({ kind: 'error'");
    expect(ui).toContain('fetchVersion.current');
    expect(ui).toContain('return () => { fetchVersion.current += 1; }');
    expect(ui).toContain('setData([])');
  });

  it('retains forms on save failure and requires a distinct delete confirmation action', () => {
    const ui = source();
    expect(ui).toContain('setPendingDeleteId(item.id)');
    expect(ui).toContain('handleDelete(pendingDeleteId)');
    expect(ui).toContain("if (response.success) {\n        setEditingId(null);");
    expect(ui).toContain('setFeedback({ kind: \'success\'');
    expect(ui).toContain("const payload = { ...editForm }");
  });
});
