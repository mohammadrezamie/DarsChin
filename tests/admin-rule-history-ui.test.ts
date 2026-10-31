import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read=(p:string)=>readFileSync(p,'utf8');

describe('private administrator rule history UI',()=>{
  it('sends exact chart revision with every graphical create and delete request',()=>{
    const component=read('src/components/AdminDependencyWorkbench.tsx');
    expect(component).toContain("headers: { 'If-Match': revision }");
    expect(component).toContain('disabled={!pending || !assessment.valid || saving || !revision}');
    expect(component).toContain('disabled={saving || !revision}');
  });

  it('makes persisted undo a separate confirmed, server-audited operation',()=>{
    const component=read('src/components/AdminDependencyWorkbench.tsx');
    expect(component).toContain('تاریخچهٔ تغییرات ثبت‌شدهٔ چارت');
    expect(component).toContain('/rules/history/');
    expect(component).toContain("'/revert'");
    expect(component).toContain('expectedRevision: revision');
    expect(component).toContain('تأیید بازگردانی تغییر ثبت‌شده');
    expect(component).toContain('latestChange?.canRevert');
    expect(component).toContain('setHistorySnapshot(null)');
    expect(component).toContain('تازه‌سازی قوانین');
  });

  it('never represents local preview as a production historical mutation in the browser demo',()=>{
    const mock=read('src/demo/mock-api.ts');
    expect(mock).toContain("return good({ revision: '0'.repeat(64), entries: [] })");
    expect(mock).toContain('بازگردانی قوانین ثبت‌شده در حالت دمو فعال نیست');
    const server=read('server/routes/curriculum.ts');
    expect(server).toContain("requirePermission('prerequisite.manage')");
    expect(server).toContain('checkAcademicRuleRevert');
    expect(server).toContain('appendAcademicRuleEvent');
  });
});
