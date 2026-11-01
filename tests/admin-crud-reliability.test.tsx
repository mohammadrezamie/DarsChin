import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AdminCrudTable } from '../src/components/AdminCrudTable';

const source = () => readFileSync(resolve(process.cwd(), 'src/components/AdminCrudTable.tsx'), 'utf8');

describe('admin CRUD usability and cross-workspace data isolation', () => {
  it('provides an accessible, RTL and mobile-readable loading surface', () => {
    const html = renderToStaticMarkup(<AdminCrudTable
      title="بانک دروس" endpoint="/api/admin/courses"
      columns={[{ key: 'name', label: 'نام درس' }, { key: 'active', label: 'وضعیت', type: 'boolean' }]}
    />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="جدول مدیریت: بانک دروس"');
    expect(html).toContain('aria-label="جست‌وجو در بانک دروس"');
    // Loading renders no records yet; the label belongs to the row template.
    expect(source()).toContain('data-label={c.label}');
    expect(html).toContain('در حال دریافت اطلاعات');
  });

  it('rejects late responses from another section, including A → B → A navigation', () => {
    const code = source();
    expect(code).toContain('endpointGeneration.current.endpoint !== endpoint');
    expect(code).toContain('endpointGeneration.current.version + 1');
    expect(code).toContain('requestEpoch.current.isCurrent(epoch)');
    expect(code).toContain('loadedContext === currentContext ? data : []');
    expect(code).toContain('setLoadedContext(\'\')');
    expect(code).toContain('setData([])');
    expect(code).toContain('Array.isArray(res.data)');
  });

  it('avoids leaking stale mutation acknowledgments and releasing newer locks', () => {
    const code = source();
    expect((code.match(/mutationEpoch.current.begin\(\)/g) || []).length).toBe(2);
    expect(code).toContain('mutationEpoch.current.invalidate()');
    expect(code).toContain('if (!stillCurrent()) return;');
    expect(code).toContain('if (mutationEpoch.current.isCurrent(epoch))');
    expect(code).toContain('saveLock.current');
    expect(code).toContain('encodeURIComponent(id)');
  });

  it('makes destructive actions explicit without native blocking dialogs', () => {
    const code = source();
    expect(code).not.toContain('confirm(');
    expect(code).not.toContain('alert(');
    expect(code).toContain('confirmDeleteId === item.id');
    expect(code).toContain('حذف قطعی');
    expect(code).toContain('setConfirmDeleteId(null)');
    expect(code).toContain('role="alert"');
    expect(code).toContain('تلاش مجدد');
    expect(code).toContain('h-11 w-11');
  });
});
