import { createHash, randomUUID } from 'node:crypto';
import type { AcademicRule, AuditLog } from '../../src/types';

export type RuleHistoryKind = 'ADD' | 'DELETE';
export interface RuleHistoryDetails {
  schema: 1;
  curriculumId: string;
  kind: RuleHistoryKind;
  rule: AcademicRule;
  beforeRevision: string;
  afterRevision: string;
  revertedEventId?: string;
}
const EVENTS = new Set(['ACADEMIC_RULE_ADDED', 'ACADEMIC_RULE_DELETED', 'ACADEMIC_RULE_REVERTED']);

/** Content-based revision: a rule edit by another administrator invalidates
 * optimistic saves and undo. No personal information is included in the hash.
 */
export function academicRulesRevision(curriculumId: string, rules: readonly AcademicRule[]): string {
  const relevant = rules.filter(rule => rule.curriculumId === curriculumId)
    .map(rule => ({...rule})).sort((a,b) => a.id.localeCompare(b.id));
  return createHash('sha256').update(JSON.stringify(relevant)).digest('hex');
}

export function expectedAcademicRevision(header: unknown): string | null | 'invalid' {
  if (header == null) return null;
  if (typeof header !== 'string' || !/^[a-f0-9]{64}$/.test(header)) return 'invalid';
  return header;
}

export function readAcademicRuleHistory(log: AuditLog): RuleHistoryDetails | null {
  if (!EVENTS.has(log.action) || log.entityType !== 'AcademicRule' || !log.details) return null;
  try {
    const details = JSON.parse(log.details) as Partial<RuleHistoryDetails>;
    if (details.schema !== 1 || typeof details.curriculumId !== 'string' ||
      (details.kind !== 'ADD' && details.kind !== 'DELETE') ||
      !details.rule || typeof details.rule.id !== 'string' ||
      details.rule.curriculumId !== details.curriculumId ||
      typeof details.beforeRevision !== 'string' ||
      typeof details.afterRevision !== 'string') return null;
    return details as RuleHistoryDetails;
  } catch { return null; }
}

export function latestRuleEvent(logs: readonly AuditLog[], curriculumId: string):
  { log: AuditLog; details: RuleHistoryDetails } | null {
  // Existing audit entries are ordered inconsistently in legacy routes.
  // The current rule log entry uses time, plus monotonically sorted UUID only
  // as a deterministic tiebreak; records are appended to the array.
  for (let i = logs.length - 1; i >= 0; i--) {
    const details = readAcademicRuleHistory(logs[i]);
    if (details?.curriculumId === curriculumId) return { log: logs[i], details };
  }
  return null;
}

export function appendAcademicRuleEvent(
  logs: AuditLog[],
  adminId: string,
  curriculumId: string,
  kind: RuleHistoryKind,
  rule: AcademicRule,
  beforeRevision: string,
  afterRevision: string,
  revertedEventId?: string,
): AuditLog {
  const log: AuditLog = {
    id: 'academic-rule-' + randomUUID(),
    adminId,
    action: revertedEventId ? 'ACADEMIC_RULE_REVERTED'
      : kind === 'ADD' ? 'ACADEMIC_RULE_ADDED' : 'ACADEMIC_RULE_DELETED',
    entityType: 'AcademicRule',
    entityId: rule.id,
    details: JSON.stringify({
      schema: 1, curriculumId, kind, rule,
      beforeRevision, afterRevision, ...(revertedEventId ? { revertedEventId } : {}),
    } satisfies RuleHistoryDetails),
    createdAt: new Date().toISOString(),
  };
  logs.push(log);
  return log;
}

/** Revert is allowed only for the latest recorded change to the same chart.
 * Successive reverts form a reversible sequence (Undo then Redo) while no
 * external mutation intervenes; no unrecorded server action is replayed.
 */
export function checkAcademicRuleRevert(
  logs: readonly AuditLog[],
  rules: readonly AcademicRule[],
  curriculumId: string,
  eventId: string,
  actorId: string,
  isRoot: boolean,
): { ok: true; event: AuditLog; details: RuleHistoryDetails; reverseKind: RuleHistoryKind } |
   { ok: false; error: string } {
  const latest = latestRuleEvent(logs, curriculumId);
  if (!latest || latest.log.id !== eventId)
    return { ok:false,error:'بعد از این نسخه، قانون دیگری تغییر کرده است؛ تاریخچه را تازه‌سازی کنید.' };
  if (!isRoot && latest.log.adminId !== actorId)
    return { ok:false,error:'فقط ثبت‌کنندهٔ این تغییر یا مدیر ارشد مجاز به بازگردانی آن است.' };
  if (academicRulesRevision(curriculumId,rules) !== latest.details.afterRevision)
    return { ok:false,error:'نسخهٔ فعلی چارت تغییر کرده است؛ بازگردانی متوقف شد.' };
  const exists = rules.some(rule => rule.id === latest.details.rule.id);
  if (latest.details.kind === 'ADD' && !exists)
    return { ok:false,error:'قانون اضافه‌شده دیگر وجود ندارد.' };
  if (latest.details.kind === 'DELETE' && exists)
    return { ok:false,error:'قانونی با همین شناسه دوباره ثبت شده است.' };
  return { ok:true,event:latest.log,details:latest.details,
    reverseKind:latest.details.kind === 'ADD' ? 'DELETE' : 'ADD' };
}
