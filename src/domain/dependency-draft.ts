import type { AcademicRule } from '../types';
import { analyzeCurriculumDependencies, type DependencyEdge } from './course-dependency-insights';

export type DraftDependencyLink = Pick<DependencyEdge, 'from' | 'to' | 'kind'>;

export interface DraftLinkValidation {
  ok: boolean;
  message: string;
}

/** Isolated transient rule objects: constructing a visual draft must NEVER write to the real curriculum. */
export function draftLinksAsRules(curriculumId: string, links: readonly DraftDependencyLink[]): AcademicRule[] {
  return links.map((edge, index) => ({
    id: `preview-${index}`,
    curriculumId,
    targetCourseId: edge.to,
    relationshipType: edge.kind,
    expression: { type: 'COURSE', courseId: edge.from },
  }));
}

/**
 * Validate a new connection against the entire chart and the already entered
 * transient draft. Existing OR expressions remain as-is, with optional paths
 * marked by the core analyzer. No publication/DB writes happen here.
 */
export function validateDraftLink(
  curriculumId: string,
  assignedIds: readonly string[],
  publishedRules: readonly AcademicRule[],
  pendingLinks: readonly DraftDependencyLink[],
  candidate: DraftDependencyLink,
): DraftLinkValidation {
  const ids = new Set(assignedIds);
  if (!curriculumId || !ids.size) {
    return { ok: false, message: 'ابتدا یک چارت معتبر با فهرست درس‌ها بارگذاری کن.' };
  }
  if (!ids.has(candidate.from) || !ids.has(candidate.to)) {
    return { ok: false, message: 'هر دو درس باید عضو همین چارت باشند.' };
  }
  if (candidate.from === candidate.to) {
    return { ok: false, message: 'نمی‌توان یک درس را به خودش متصل کرد.' };
  }
  if (candidate.kind !== 'PREREQUISITE' && candidate.kind !== 'COREQUISITE') {
    return { ok: false, message: 'نوع اتصال معتبر نیست.' };
  }
  const base = analyzeCurriculumDependencies(curriculumId, assignedIds,
    [...publishedRules, ...draftLinksAsRules(curriculumId, pendingLinks)]);
  if (!base.valid) {
    return { ok: false, message: 'تا اصلاح خطاهای چارت فعلی، افزودن رابطه ممکن نیست.' };
  }
  const duplicate = base.edges.some(edge =>
    edge.from === candidate.from && edge.to === candidate.to && edge.kind === candidate.kind);
  if (duplicate) {
    return { ok: false, message: 'این رابطه پیش‌تر در چارت یا پیش‌نویس وجود دارد.' };
  }
  const next = analyzeCurriculumDependencies(curriculumId, assignedIds, [
    ...publishedRules,
    ...draftLinksAsRules(curriculumId, [...pendingLinks, candidate]),
  ]);
  if (!next.valid) {
    return { ok: false, message: next.errors[0] || 'این اتصال زنجیرهٔ نامعتبر ایجاد می‌کند.' };
  }
  return { ok: true, message: 'اتصال به پیش‌نویس اضافه شد؛ هنوز در سامانه ذخیره نشده است.' };
}
