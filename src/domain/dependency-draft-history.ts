import type { AcademicRule } from '../types';
import { analyzeCurriculumDependencies, type CurriculumDependencyAnalysis } from './course-dependency-insights';
import type { VisualRelationship } from './dependency-editor';

export interface ConnectionDraft {
  sourceId: string;
  targetId: string;
  kind: VisualRelationship;
}

export interface ConnectionDraftHistory {
  past: ConnectionDraft[];
  present: ConnectionDraft;
  future: ConnectionDraft[];
}

const MAX_DRAFT_STEPS = 40;

export function freshConnectionHistory(kind: VisualRelationship = 'PREREQUISITE'): ConnectionDraftHistory {
  return { past: [], present: { sourceId: '', targetId: '', kind }, future: [] };
}

/** Only unsaved selections enter this history. Persisted API mutations are
 * deliberately NOT reversible without a server revision/authorization check.
 */
export function recordConnectionDraft(history: ConnectionDraftHistory, next: ConnectionDraft): ConnectionDraftHistory {
  const current = history.present;
  if (current.sourceId === next.sourceId && current.targetId === next.targetId && current.kind === next.kind) return history;
  return {
    past: [...history.past, current].slice(-MAX_DRAFT_STEPS),
    present: { ...next },
    future: [],
  };
}

export function undoConnectionDraft(history: ConnectionDraftHistory): ConnectionDraftHistory {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future].slice(0, MAX_DRAFT_STEPS),
  };
}

export function redoConnectionDraft(history: ConnectionDraftHistory): ConnectionDraftHistory {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present].slice(-MAX_DRAFT_STEPS),
    present: history.future[0],
    future: history.future.slice(1),
  };
}

export interface DependencyImpactRow {
  courseId: string;
  beforeCount: number;
  afterCount: number;
  beforeDepth: number;
  afterDepth: number;
}

export interface DependencyImpactPreview {
  valid: boolean;
  error: string;
  impacted: DependencyImpactRow[];
  /** Only the preview of direct, standalone rules is supported. */
  direction: 'add' | 'remove';
}

/** Preview downstream changes for the whole chart, including indirect
 * ancestors and diamonds. Never assert that an OR path is compulsory.
 */
export function previewDependencyImpact(
  curriculumId: string,
  courseIds: readonly string[],
  rules: readonly AcademicRule[],
  change: { direction: 'add'; sourceId: string; targetId: string; kind: VisualRelationship } |
          { direction: 'remove'; ruleId: string },
): DependencyImpactPreview {
  const before = analyzeCurriculumDependencies(curriculumId, courseIds, rules);
  if (!before.valid) return { valid: false, error: before.errors.join(' ') || 'چارت نامعتبر است.', impacted: [], direction: change.direction };

  let next: AcademicRule[];
  if (change.direction === 'add') {
    next = [...rules, {
      id: '__impact_preview_only__',
      curriculumId,
      targetCourseId: change.targetId,
      relationshipType: change.kind,
      expression: { type: 'COURSE', courseId: change.sourceId },
    }];
  } else {
    if (!rules.some(rule => rule.id === change.ruleId && rule.curriculumId === curriculumId)) {
      return { valid: false, error: 'قانون انتخاب‌شده در این چارت وجود ندارد.', impacted: [], direction: change.direction };
    }
    next = rules.filter(rule => rule.id !== change.ruleId);
  }

  const after = analyzeCurriculumDependencies(curriculumId, courseIds, next);
  if (!after.valid) return { valid: false, error: after.errors.join(' ') || 'تغییر پیشنهادی معتبر نیست.', impacted: [], direction: change.direction };
  const original = new Map(before.insights.map(item => [item.courseId, item]));
  const impacted: DependencyImpactRow[] = after.insights.flatMap(item => {
    const old = original.get(item.courseId);
    if (!old || (old.downstreamCount === item.downstreamCount && old.longestChain === item.longestChain)) return [];
    return [{ courseId: item.courseId, beforeCount: old.downstreamCount,
      afterCount: item.downstreamCount, beforeDepth: old.longestChain, afterDepth: item.longestChain }];
  }).sort((a,b) => Math.abs(b.afterCount-b.beforeCount)-Math.abs(a.afterCount-a.beforeCount) ||
    Math.abs(b.afterDepth-b.beforeDepth)-Math.abs(a.afterDepth-a.beforeDepth) || a.courseId.localeCompare(b.courseId));
  return { valid: true, error: '', impacted, direction: change.direction };
}
