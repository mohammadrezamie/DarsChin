import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { academicPortal } from '../src/config/academic-portal';
import { ExtensionModal } from '../src/components/ExtensionModal';
import { ImportOfferingsModal } from '../src/components/ImportOfferingsModal';

describe('مهاجرت به معیار', () => {
  it('فقط نشانی عمومی و وضعیت اتصال تأییدنشده را معرفی می‌کند', () => {
    expect(academicPortal.studentUrl).toBe('https://student.meyar.iau.ir/');
    expect(academicPortal.integrationStatus).toBe('UNVERIFIED');
    const html = renderToStaticMarkup(<ExtensionModal isOpen onClose={()=>{}} onOpenMockPortal={()=>{}} />);
    expect(html).toContain(academicPortal.studentUrl);
    expect(html).toContain('noopener noreferrer');
    expect(html).toContain('اتصال مستقیم و استخراج خودکار از معیار هنوز تأیید نشده است');
    expect(html).not.toContain('دانلود افزونه');
    expect(html).not.toContain('chrome://extensions');
  });
  it('ورود فایل استاندارد را بدون تبلیغ افزونهٔ قبلی حفظ می‌کند', () => {
    const html = renderToStaticMarkup(<ImportOfferingsModal isOpen onClose={()=>{}} onImportSuccess={()=>{}} />);
    expect(html).toContain(academicPortal.studentUrl);
    expect(html).toContain('JSON، CSV یا TSV');
    expect(html).toContain('هنوز تأیید نشده است');
    expect(html).not.toContain('دانلود افزونه کروم');
    const source=readFileSync(resolve(process.cwd(),'src/components/ImportOfferingsModal.tsx'),'utf8');
    expect(source).toContain('/api/imports/process');
  });
  it('مجوزهای افزونهٔ تاریخی به معیار گسترش نیافته‌اند', () => {
    const manifest=readFileSync(resolve(process.cwd(),'extension/manifest.json'),'utf8');
    expect(manifest).not.toContain('meyar.iau.ir');
  });
});
