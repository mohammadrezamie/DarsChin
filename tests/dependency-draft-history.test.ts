import { describe, expect, it } from 'vitest';
import type { AcademicRule } from '../src/types';
import {
  freshConnectionHistory, recordConnectionDraft, undoConnectionDraft, redoConnectionDraft,
  previewDependencyImpact,
} from '../src/domain/dependency-draft-history';
import { readFileSync } from 'node:fs';

const edge = (from: string, to: string): AcademicRule => ({
  id: from + '-to-' + to, curriculumId: 'chart', targetCourseId: to,
  relationshipType: 'PREREQUISITE', expression: { type: 'COURSE', courseId: from },
});

describe('admin dependency graph: unsaved selection history', () => {
  it('undoes source, destination and type changes one at a time, then redoes them', () => {
    const empty = freshConnectionHistory();
    const source = recordConnectionDraft(empty, { sourceId: 'a', targetId: '', kind: 'PREREQUISITE' });
    const target = recordConnectionDraft(source, { sourceId: 'a', targetId: 'b', kind: 'PREREQUISITE' });
    const coreq = recordConnectionDraft(target, { sourceId: 'a', targetId: 'b', kind: 'COREQUISITE' });
    expect(undoConnectionDraft(coreq).present).toEqual(target.present);
    expect(undoConnectionDraft(undoConnectionDraft(coreq)).present).toEqual(source.present);
    expect(redoConnectionDraft(undoConnectionDraft(coreq)).present).toEqual(coreq.present);
    expect(undoConnectionDraft(empty)).toBe(empty);
    expect(redoConnectionDraft(empty)).toBe(empty);
    expect(recordConnectionDraft(coreq, coreq.present)).toBe(coreq);
  });

  it('invalidates the redo branch when the editor diverges', () => {
    const initial = freshConnectionHistory();
    const one = recordConnectionDraft(initial, { sourceId: 'a', targetId: '', kind: 'PREREQUISITE' });
    const two = recordConnectionDraft(one, { sourceId: 'a', targetId: 'b', kind: 'PREREQUISITE' });
    const branch = recordConnectionDraft(undoConnectionDraft(two), { sourceId: 'a', targetId: 'c', kind: 'PREREQUISITE' });
    expect(branch.future).toHaveLength(0);
    expect(redoConnectionDraft(branch)).toBe(branch);
  });

  it('caps browser-only history to 40 steps and can reset when changing charts', () => {
    let history = freshConnectionHistory();
    for (let i = 0; i < 60; i++) {
      history = recordConnectionDraft(history, { sourceId: String(i), targetId: '', kind: 'PREREQUISITE' });
    }
    expect(history.past).toHaveLength(40);
    expect(history.past[0].sourceId).toBe('19');
    expect(freshConnectionHistory()).toEqual({
      past: [], present: { sourceId: '', targetId: '', kind: 'PREREQUISITE' }, future: [],
    });
  });
});

describe('whole-chart change previews', () => {
  it('predicts indirect impact on every upstream ancestor for a new edge', () => {
    const preview = previewDependencyImpact('chart', ['a','b','c','d'], [edge('a','b'), edge('c','d')], {
      direction: 'add', sourceId: 'b', targetId: 'c', kind: 'PREREQUISITE',
    });
    expect(preview.valid).toBe(true);
    expect(new Map(preview.impacted.map(item => [item.courseId, item.afterCount]))).toEqual(
      new Map([['a', 3], ['b', 2]]),
    );
    expect(preview.impacted.find(item => item.courseId === 'a')?.afterDepth).toBe(3);
  });

  it('predicts the reverse when removing exactly one rule', () => {
    const preview = previewDependencyImpact('chart', ['a','b','c','d'],
      [edge('a','b'), edge('b','c'), edge('c','d')],
      { direction: 'remove', ruleId: 'b-to-c' });
    expect(preview.valid).toBe(true);
    expect(preview.impacted.find(item => item.courseId === 'a')?.afterCount).toBe(1);
    expect(preview.impacted.find(item => item.courseId === 'b')?.afterCount).toBe(0);
  });

  it('never declares a cycle valid, and does not fabricate missing removal', () => {
    const chart = ['a','b','c'];
    const rules = [edge('a','b'), edge('b','c')];
    const cyclic = previewDependencyImpact('chart',chart,rules,
      {direction:'add',sourceId:'c',targetId:'a',kind:'PREREQUISITE'});
    expect(cyclic.valid).toBe(false);
    expect(cyclic.impacted).toHaveLength(0);
    const missing = previewDependencyImpact('chart',chart,rules,
      {direction:'remove',ruleId:'unknown'});
    expect(missing.valid).toBe(false);
  });

  it('shows a co-requisite but never changes prerequisite priority/depth', () => {
    const preview = previewDependencyImpact('chart',['a','b','c'],[edge('a','b')],{
      direction:'add',sourceId:'b',targetId:'c',kind:'COREQUISITE',
    });
    expect(preview.valid).toBe(true);
    expect(preview.impacted).toHaveLength(0);
  });

  it('keeps client-side undo separate from persisted API mutations', () => {
    const graph = readFileSync('src/components/AdminDependencyWorkbench.tsx','utf8');
    expect(graph).toContain('تاریخچهٔ انتخاب و اتصالِ');
    expect(graph).toContain('setDraftHistory(undoConnectionDraft)');
    expect(graph).toContain('setDraftHistory(redoConnectionDraft)');
    expect(graph).toContain('setDraftHistory(freshConnectionHistory())');
    expect(graph).toContain('previewDependencyImpact(');
    expect(graph).toContain('پس از تأیید جداگانه');
    expect(graph).toContain('onChanged()');
    expect(graph).toContain("setLayoutMode('chain')");
    expect(graph).toContain("setLayoutMode('semester')");
    expect(graph).toContain('insight.depth + 1');
    expect(graph).toContain('sortedTerms.length - 1 - column');
    expect(graph).toContain('layout.chainModeActive ? from.x : from.x + NODE_WIDTH');
    expect(graph).toContain("layout.chainModeActive ? 'سطح زنجیرهٔ ' : 'ترم پیشنهادی '");

  });
});
