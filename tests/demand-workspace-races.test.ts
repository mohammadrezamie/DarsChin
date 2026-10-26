import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequestEpoch } from '../src/utils/request-epoch';

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

describe('demand UI account/survey guards', () => {
  it('clears saved student answers and manager reports immediately on each selected survey', () => {
    const s=source();
    expect(s).toContain("setDetailState('loading');");
    expect(s).toContain("setMyResponse(null);");
    expect(s).toContain("setReport(null);");
    expect(s).toContain("setSelectedCourses([]);");
    expect(s).toContain("return ()=>{active=false};");
    expect(s).toContain("},[survey?.id,role,detailRevision]);");
    expect(s).not.toContain("},[survey?.id,role,profile?.studentNumber]);");
  });

  it('does not allow edits before confirmed response loading or after survey closes', () => {
    const s=source();
    expect(s).toContain("if(!survey || detailState !== 'ready')return;");
    expect(s).toContain("disabled={busy||detailState!=='ready'||survey.status!=='OPEN'}");
    expect(s).toContain("disabled={busy||!chartReady||!newCourseIds.length}");
    expect(s).toContain("disabled={busy} onClick={()=>setSelectedId(s.id)}");
    expect(s).toContain("detailState === 'error'");
    expect(s).toContain("setDetailRevision(value=>value+1)");
  });

  it('never shows dependencies from an old academic chart as verified for the new one', () => {
    const s=source();
    expect(s).toContain('const chartReady = Boolean(chartContextId && loadedChartId === chartContextId)');
    expect(s).toContain('setLoadedChartId(null);');
    expect(s).toContain('setAssigned([]);');
    expect(s).toContain('setRules([]);');
    expect(s).toContain('setLoadedChartId(curriculumId);');
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
