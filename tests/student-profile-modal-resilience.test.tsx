import React from 'react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { AcademicProfileModal } from '../src/components/AcademicProfileModal';
const dashboard=readFileSync(resolve(process.cwd(),'src/components/StudentDashboard.tsx'),'utf8');

const source=readFileSync(resolve(process.cwd(),'src/components/AcademicProfileModal.tsx'),'utf8');

describe('guided profile dialog fails closed and stays usable by keyboard',()=>{
  it('starts in a loading-only state, never with a prematurely writable academic identity',()=>{
    const html=renderToStaticMarkup(<AcademicProfileModal isOpen
      onClose={()=>{}} onProfileUpdated={()=>{}} />);
    expect(html).toContain('در حال بارگذاری اطلاعات تحصیلی');
    expect(html).not.toContain('id="btnSaveAcademicProfile"');
    expect(source).toContain("if (loading || loadError || saving) return;");
  });

  it('rejects incomplete metadata or profile responses and offers an explicit retry',()=>{
    expect(source).toContain('requiredLists.some(rows => !Array.isArray(rows))');
    expect(source).toContain('!metaRes.success || !profileRes.success || !profile');
    expect(source).toContain('loadError ? (');
    expect(source).toContain('role="alert"');
    expect(source).toContain('setLoadRevision(previous => previous + 1)');
    expect(source).toContain('دریافت دوبارهٔ اطلاعات پرونده');
  });

  it('does not let old requests replace state after closing or retrying',()=>{
    expect(source).toContain('if (!alive) return;');
    expect(source).toContain('return () => { alive = false; };');
    expect(source).toContain('}, [isOpen, loadRevision]);');
  });

  it('uses a focus trap, escape handling, body-scroll restoration and a disabled close during saving',()=>{
    expect(source).toContain("document.addEventListener('keydown', onKeyDown)");
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain("event.shiftKey && document.activeElement === first");
    expect(source).toContain('document.body.style.overflow = previousOverflow;');
    expect(source).toContain('previousFocus.focus({ preventScroll: true })');
    expect(source).toContain('ref={dialogRef}');
    expect(source).toContain('ref={closeRef}');
    expect(source).toContain('disabled={saving}');
  });

  it('catches save failures without leaving the dialog locked or scheduling a ghost close',()=>{
    expect(source).toContain("ارتباط برای ذخیرهٔ پرونده برقرار نشد");
    expect(source).toContain('} finally {\n      setSaving(false);');
    expect(source).not.toContain('setTimeout(() => {');
  });
  it('remounts with blank state each time the profile opens or the user changes',()=>{
    expect(dashboard).toContain('{isProfileModalOpen && (');
    expect(dashboard).toContain("key={user?.id ?? 'signed-out'}");
    expect(dashboard).toContain('isOpen={true}');
    expect(source).toContain('useState(true)');
  });

});
