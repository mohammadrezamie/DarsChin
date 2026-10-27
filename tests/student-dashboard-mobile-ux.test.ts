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
    const visibleJourney=['id: \'offerings\'','id: \'schedule\'','id: \'registration\''];
    const offsets=visibleJourney.map(token => dashboard.indexOf(token));
    expect(offsets.every(offset => offset >= 0)).toBe(true);
    expect(offsets[0]).toBeLessThan(offsets[1]);
    expect(offsets[1]).toBeLessThan(offsets[2]);
    expect(dashboard).toContain('tabButtonsRef.current[activeTab]');
    expect(dashboard).toContain('strip.scrollBy({ left: delta');
    expect(dashboard).not.toContain('button.scrollIntoView(');
    expect(dashboard).toContain('<StudentMobileDock active={activeTab}');
    expect(source('src/components/StudentMobileDock.tsx')).toContain('min-h-14');
    expect(dashboard).toContain('ref={element => { tabButtonsRef.current[tab.id] = element; }}');
    expect(dashboard).toContain('min-h-11 shrink-0 items-center justify-start');
    expect(dashboard).toContain("planStatus !== 'idle'");
    expect(dashboard).toContain('setCoursePriorities(newCourseOrder)');
    expect(dashboard).toContain('Promise<boolean>');
    expect(dashboard).toContain('return saved;');
  });

  it('clears the whole saved plan only after an accessible confirmation and server acceptance',()=>{
    const dashboard=source('src/components/StudentDashboard.tsx');
    expect(dashboard).not.toContain("confirm('آیا از پاکسازی کل برنامه");
    expect(dashboard).toContain('const handleClearSchedule = () => setClearConfirmOpen(true);');
    expect(dashboard).toContain('if (await syncPlanToServer([], [], {}))');
    expect(dashboard).toContain('setSelectedOfferingIds([]);');
    expect(dashboard).toContain('setCoursePriorities([]);');
    expect(dashboard).toContain('setOfferingPriorities({});');
    expect(dashboard).toContain('aria-labelledby="student-clear-title"');
    expect(dashboard).toContain('aria-describedby="student-clear-desc"');
    expect(dashboard).toContain('ref={clearCancelRef}');
    expect(dashboard).toContain('clearCancelRef.current?.focus()');
    expect(dashboard).toContain("if (!planMutationRef.current)");
    expect(dashboard).toContain('role="alert"');
  });

  it('uses server-provided academic unit limits instead of invented numerical thresholds',()=>{
    const dashboard=source('src/components/StudentDashboard.tsx');
    expect(dashboard).toContain('const maxUnits = academicLimits?.effectiveMaxUnits;');
    expect(dashboard).toContain("typeof maxUnits === 'number' && Number.isFinite(maxUnits)");
    expect(dashboard).not.toContain('isSummer ? 8');
    expect(dashboard).not.toContain('previousTermGpa >= 17');
    expect(dashboard).not.toContain('ترم آخری (۲۴ واحد)');
  });

  it('does not evaluate a stale local selection when profile or saved plan retrieval fails',()=>{
    const dashboard=source('src/components/StudentDashboard.tsx');
    expect(dashboard).toContain('!planRes.success || !planRes.data ||');
    expect(dashboard).toContain('!Array.isArray(planRes.data.selectedOfferingIds)');
    expect(dashboard).toContain('const planned = planRes.data.selectedOfferingIds;');
    expect(dashboard).not.toContain(': selectedOfferingIds;');
    expect(dashboard).toContain('setCurriculumId(null);');
    expect(dashboard).toContain('setEvaluations([]);');
    expect(dashboard).toContain('setRecommendations([]);');
    expect(dashboard).toContain('setAcademicLimits(null);');
    expect(dashboard).toContain('setCurrentTerm(null);');
    expect(dashboard).toContain('اطلاعات حساب حذف نشده‌اند');
  });

  it('blocks plan changes on unreliable data and holds the conflict modal during a pending save',()=>{
    const dashboard=source('src/components/StudentDashboard.tsx');
    expect(dashboard).toContain('if (loading || loadError)');
    expect(dashboard).toContain('برنامه هنوز به‌طور معتبر بارگذاری نشده است');
    expect(dashboard).toContain("if (!planMutationRef.current)");
    expect(dashboard).toContain('ref={conflictCancelRef} disabled={planStatus === \'saving\'}');
    expect(dashboard).toContain("planStatus === 'error' && planError");
    expect(dashboard).toContain('درخواست ثبت با بررسی سرور');
  });

  it('re-evaluates the persisted selection after a successful primary-group change',()=>{
    const dashboard=source('src/components/StudentDashboard.tsx');
    const begin=dashboard.indexOf('const handleSelectPrimaryOffering = async');
    const end=dashboard.indexOf('const handleAddFallbackOffering = async',begin);
    expect(begin).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(begin);
    const update=dashboard.slice(begin,end);
    expect(update).toContain('if (await syncPlanToServer(newSelected, coursePriorities, newOfferingPriorities))');
    expect(update).toContain('setSelectedOfferingIds(newSelected)');
    expect(update).toContain('void fetchDashboardData();');
  });

  it('does not leak a previous account plan or stale academic limits during reload',()=>{
    const dashboard=source('src/components/StudentDashboard.tsx');
    expect(dashboard).toContain('if (profile?.userId && profile.userId !== user?.id)');
    expect(dashboard).toContain('setSelectedOfferingIds([]);');
    expect(dashboard).toContain('setOfferingPriorities({});');
    expect(dashboard).toContain('setProfile(null);');
    expect(dashboard).toContain('setAcademicLimits(evalRes.data.academicLimits ?? null)');
    expect(dashboard).toContain('setCurrentTerm(evalRes.data.context?.term ?? null)');
    expect(dashboard).not.toContain('if (evalRes.data.academicLimits) setAcademicLimits');
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
