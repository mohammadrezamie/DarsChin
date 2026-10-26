import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');

describe('student-facing responsive dashboard and conflict UX',()=>{
  it('offers two purposeful actions instead of duplicated importer buttons',()=>{
    const dashboard=source('src/components/StudentDashboard.tsx');
    expect(dashboard).toContain('پروندهٔ تحصیلی');
    expect(dashboard).toContain('دریافت دروس');
    expect(dashboard).toContain('grid-cols-2 gap-2');
    expect(dashboard).toContain('min-h-11 min-w-0');
    expect(dashboard).not.toContain('دانلود افزونه کروم</span>');
    expect(dashboard).not.toContain('بارگذاری دروس ارائه‌شده\n            </button>');
  });

  it('keeps the mobile tab visible, 44px touchable, and reports only real save states',()=>{
    const dashboard=source('src/components/StudentDashboard.tsx');
    expect(dashboard).toContain('tabButtonsRef.current[activeTab]');
    expect(dashboard).toContain("button.scrollIntoView({ block: 'nearest', inline: 'nearest'");
    expect(dashboard).toContain('ref={element => { tabButtonsRef.current[tab.id] = element; }}');
    expect(dashboard).toContain('min-h-11 shrink-0 items-center justify-start');
    expect(dashboard).toContain("planStatus !== 'idle'");
    expect(dashboard).toContain('setCoursePriorities(newCourseOrder)');
    expect(dashboard).toContain('return saved;');
  });

  it('contains keyboard focus within the warning dialog and restores background scroll',()=>{
    const dashboard=source('src/components/StudentDashboard.tsx');
    expect(dashboard).toContain('role="alertdialog" aria-modal="true"');
    expect(dashboard).toContain('aria-labelledby="student-conflict-dialog-title"');
    expect(dashboard).toContain('aria-describedby="student-conflict-dialog-desc"');
    expect(dashboard).toContain("document.body.style.overflow = 'hidden'");
    expect(dashboard).toContain('document.body.style.overflow = oldOverflow;');
    expect(dashboard).toContain('previousFocus?.focus()');
    expect(dashboard).toContain("event.key === 'Escape'");
    expect(dashboard).toContain("event.key !== 'Tab'");
    expect(dashboard).toContain('conflictCancelRef.current?.focus()');
    expect(dashboard).toContain('max-h-[92dvh]');
    expect(dashboard).toContain("disabled={planStatus === 'saving'}");
  });
});
