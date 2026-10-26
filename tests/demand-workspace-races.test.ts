import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequestEpoch } from '../src/utils/request-epoch';
import { demandDetailKey, isCurrentDemandDetail } from '../src/utils/demand-detail-context';

const source = () => readFileSync(resolve(process.cwd(), 'src/components/DemandWorkspace.tsx'), 'utf8');

describe('survey request epochs', () => {
  it('honors only the latest refresh, even if old results arrive later', async () => {
    const guard = createRequestEpoch();
    let finishOld!: (value: string) => void;
    let finishNew!: (value: string) => void;
    const old = new Promise<string>(resolve => { finishOld = resolve; });
    const recent = new Promise<string>(resolve => { finishNew = resolve; });
    const committed: string[] = [];
    const oldTicket = guard.begin();
    const oldTask = old.then(value => { if (guard.isCurrent(oldTicket)) committed.push(value); });
    const newTicket = guard.begin();
    const newTask = recent.then(value => { if (guard.isCurrent(newTicket)) committed.push(value); });

    finishNew('current form');
    await newTask;
    finishOld('stale form');
    await oldTask;
    expect(committed).toEqual(['current form']);
  });

  it('rejects a response after role switch/unmount and allows a fresh request', () => {
    const guard = createRequestEpoch();
    const before = guard.begin();
    guard.invalidate();
    expect(guard.isCurrent(before)).toBe(false);
    const after = guard.begin();
    expect(guard.isCurrent(after)).toBe(true);
  });
});

describe('principal isolation and safe role reinitialization', () => {
  it('remounts the workspace on student identity, role, permission or department scope change', () => {
    const s = source();
    expect(s).toContain("import { useAuth } from '../context/AuthContext'");
    expect(s).toContain('const principalKey = JSON.stringify([');
    expect(s).toContain('user?.id ?? null');
    expect(s).toContain('user?.permissions ?? []');
    expect(s).toContain('user?.demandScopes ?? []');
    expect(s).toContain('<DemandWorkspaceSession key={principalKey} role={role} />');
  });

  it('clears old identity fields and restores valid chart defaults when a role is reset', () => {
    const s = source();
    for (const token of [
      'setProfile(null);', "setStudentNumber('');", "setGraduation('UNKNOWN');",
      'setAssigned([]);', 'setRules([]);', 'setLoadedChartId(null);',
      'setNewCourseIds([]);', "setNewCurriculum('');", "setSelectedId('');",
      'void refresh(true);', 'const refresh = async (resetDefaults = false) =>',
      'resetDefaults || !newCurriculum', 'resetDefaults || !newTerm',
    ]) {
      expect(s).toContain(token);
    }
  });
});

describe('private manager CSV export scope', () => {
  it('does not create a download until the current report is ready and its request is still current', () => {
    const s = source();
    const start = s.indexOf('const exportFile=async()=>{');
    const end = s.indexOf('const toggle=',start);
    const code = s.slice(start,end);
    expect(code).toContain('if(!survey || !detailReady || busy)return;');
    expect(code).toContain('exportRequestRef.current.begin()');
    expect(code).toContain('activeDetailKeyRef.current===exportedKey');
    expect(code).toContain('exportRequestRef.current.isCurrent(exportEpoch)');
    expect(code.indexOf('if(!stillCurrent())return;')).toBeLessThan(code.indexOf('URL.createObjectURL(blob)'));
    expect(s).toContain('exportRequestRef.current.invalidate()');
    expect(s).toContain('disabled={busy||!detailReady} onClick={()=>void exportFile()}');
  });
});

describe('refresh fail-closed behavior', () => {
  it('invalidates previous survey detail and outstanding save before any network await', () => {
    const s = source();
    const refreshStart = s.indexOf('const refresh = async (resetDefaults = false)');
    const refreshEnd = s.indexOf('useEffect(()=>{', refreshStart);
    const body = s.slice(refreshStart, refreshEnd);
    const invalidate = body.indexOf('setDetailRevision(value => value + 1)');
    const preventSave = body.indexOf('saveRequestRef.current.invalidate()');
    const network = body.indexOf('await Promise.all');
    expect(invalidate).toBeGreaterThan(0);
    expect(preventSave).toBeGreaterThan(0);
    expect(network).toBeGreaterThan(invalidate);
    expect(network).toBeGreaterThan(preventSave);
    expect(body.match(/setDetailRevision\(value => value \+ 1\)/g)).toHaveLength(1);
    expect(body).toContain('if (!list.success || !Array.isArray(list.data))');
  });
});

describe('render-time survey detail isolation', () => {
  it('rejects the previously ready survey at the first render of a new selection, role or refresh', () => {
    const oldKey = demandDetailKey('student','survey-A',0);
    expect(isCurrentDemandDetail(oldKey,oldKey,'ready')).toBe(true);
    expect(isCurrentDemandDetail(demandDetailKey('student','survey-B',0),oldKey,'ready')).toBe(false);
    expect(isCurrentDemandDetail(demandDetailKey('admin','survey-A',0),oldKey,'ready')).toBe(false);
    expect(isCurrentDemandDetail(demandDetailKey('student','survey-A',1),oldKey,'ready')).toBe(false);
    expect(isCurrentDemandDetail(oldKey,oldKey,'error')).toBe(false);
    expect(isCurrentDemandDetail(null,oldKey,'ready')).toBe(false);
  });

  it('does not expose prior manager statistics, student choices or identifier while survey detail is unverified', () => {
    const s=source();
    for(const token of [
      'const detailReady = isCurrentDemandDetail(currentDetailKey, settledDetailKey, detailState)',
      'const visibleSelectedCourses = detailReady ? selectedCourses : []',
      'const visibleResponse = detailReady ? myResponse : null',
      'const visibleReport = detailReady ? report : null',
      'checked={visibleSelectedCourses.includes(courseId)}',
      'value={detailReady ? studentNumber :',
      "value={detailReady ? graduation : 'UNKNOWN'}",
      '{visibleReport?.participantCount',
      '{visibleReport?.byCourse.map',
      "if(!survey || !detailReady || busy || survey.status !== 'OPEN')return;",
    ]) expect(s).toContain(token);
    expect(s).toContain('setSettledDetailKey(requestedKey)');
    expect(s).toContain('setSettledDetailKey(null)');
  });
});

describe('demand UI account/survey guards', () => {
  it('clears saved student answers and manager reports immediately on each selected survey', () => {
    const s=source();
    expect(s).toContain("setDetailState('loading');");
    expect(s).toContain("setMyResponse(null);");
    expect(s).toContain("setReport(null);");
    expect(s).toContain("setSelectedCourses([]);");
    expect(s).toContain("return ()=>{active=false};");
    expect(s).toContain("},[survey?.id,role,detailRevision,user?.id]);");
    expect(s).not.toContain("},[survey?.id,role,profile?.studentNumber]);");
  });

  it('does not allow edits before confirmed response loading or after survey closes', () => {
    const s=source();
    expect(s).toContain("if(!survey || !detailReady || busy || survey.status !== 'OPEN')return;");
    expect(s).toContain("disabled={busy||!detailReady||survey.status!=='OPEN'}");
    expect(s).toContain("disabled={busy||!chartReady||!newCourseIds.length}");
    expect(s).toContain("disabled={busy} onClick={()=>setSelectedId(s.id)}");
    expect(s).toContain("currentDetailError");
    expect(s).toContain("setDetailRevision(value=>value+1)");
  });

  it('never shows dependencies from an old academic chart as verified for the new one', () => {
    const s=source();
    expect(s).toContain('loadedChartId === chartContextId &&');
    expect(s).toContain('loadedChartRevision === detailRevision');
    expect(s).toContain('setLoadedChartId(null);');
    expect(s).toContain('setAssigned([]);');
    expect(s).toContain('setRules([]);');
    expect(s).toContain('setLoadedChartId(curriculumId);');
    expect(s).toContain('setLoadedChartRevision(detailRevision);');
    expect(s).toContain('},[role,survey?.curriculumId,newCurriculum,detailRevision]);');
    expect(s).toContain('روابط درسی هنوز بارگذاری نشده‌اند');
  });

  it('invalidates any in-flight refresh on unmount or role change', () => {
    const s=source();
    expect(s).toContain('const requestVersion = refreshVersionRef.current.begin()');
    expect(s).toContain('refreshVersionRef.current.isCurrent(requestVersion)');
    expect(s).toContain('refreshVersionRef.current.invalidate()');
    expect(s).not.toContain('const stillSelected =');
  });
});
