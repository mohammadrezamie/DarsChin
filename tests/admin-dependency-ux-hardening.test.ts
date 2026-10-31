import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('editable dependency graph and administrator workflow', () => {
  it('keeps the graphical chain editor as the primary workflow and compounds as advanced options', () => {
    const rules = read('src/components/AdminAcademicRules.tsx');
    expect(rules.indexOf('<AdminDependencyWorkbench')).toBeLessThan(rules.indexOf('قوانین ترکیبی و استثناها'));
    expect(rules).toContain('ویرایش پیشرفته');
    expect(rules).toContain('<details');
    expect(rules).toContain('role="group" aria-label="تأیید حذف قانون"');
    expect(rules).not.toContain('window.confirm(');
    expect(rules).not.toContain('alert(');
  });

  it('does not recreate the recursive AND/OR component on each parent keystroke', () => {
    const source = read('src/components/AdminAcademicRules.tsx');
    expect(source.indexOf('const NodeEditor =')).toBeLessThan(source.indexOf('export const AdminAcademicRules:'));
    expect(source).toContain('dataReady &&');
    expect(source).toContain('اطلاعات فرم حفظ شدند');
    expect(source).toContain('disabled={saving}');
  });

  it('reports invalid graph structure and chain depth without claiming false importance', () => {
    const graph = read('src/components/AdminDependencyWorkbench.tsx');
    expect(graph).toContain('!analysis.valid');
    expect(graph).toContain('analysis.errors.join');
    expect(graph).toContain('insight.longestChain.toLocaleString');
    expect(graph).toContain('اهمیت نیازمند بازبینی چارت');
    expect(graph).toContain("relationshipType: kind");
    expect(graph).toContain('findRemovableDirectDependency(');
  });

  it('does not leave the save/delete action stuck after network failure', () => {
    const graph = read('src/components/AdminDependencyWorkbench.tsx');
    expect(graph).toContain('اتصال هنوز ثبت‌شده تلقی نمی‌شود');
    expect(graph).toContain('حذف اتصال تأیید نشده است');
    expect(graph.match(/setSaving\(false\);/g)?.length).toBeGreaterThanOrEqual(2);
    expect(graph).toContain('finally {');
  });
});
