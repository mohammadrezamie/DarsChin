import type { DatabaseSchema } from './database';

/**
 * Admin-uploaded backups are permitted to restore a *catalogue snapshot*.
 * Student-owned records, account credentials, current registration queues,
 * demand submissions and security/audit state must never be rolled back by
 * uploading an older JSON file through an ordinary web request.
 *
 * Full database disaster recovery remains an offline, operator-controlled
 * process with verified backups and a write freeze.
 */
export class InvalidCatalogBackupError extends Error {}

export const CATALOG_RESTORE_COLLECTIONS = [
  'universities', 'provinces', 'campuses', 'degreeLevels', 'majors',
  'tracks', 'entryYears', 'academicTerms', 'curricula', 'courses',
  'curriculumCourses', 'academicRules', 'courseOfferings',
] as const satisfies readonly (keyof DatabaseSchema)[];

const REQUIRED_COLLECTIONS = [
  'universities', 'campuses', 'degreeLevels', 'majors', 'entryYears',
  'academicTerms', 'curricula', 'courses', 'curriculumCourses', 'courseOfferings',
] as const;

type CatalogCollection = (typeof CATALOG_RESTORE_COLLECTIONS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function idSet(collection: readonly unknown[]): Set<string> {
  return new Set(collection.map(entry => (entry as { id: string }).id));
}

function ensureReferences(references: readonly (string | null | undefined)[], ids: ReadonlySet<string>, label: string): void {
  if (references.some(ref => typeof ref !== 'string' || !ids.has(ref))) {
    throw new InvalidCatalogBackupError(`بازیابی فهرست آموزشی با داده‌های موجود سازگار نیست: ${label}.`);
  }
}

export function prepareCatalogRestore(current: DatabaseSchema, incoming: unknown): DatabaseSchema {
  if (!isRecord(incoming)) throw new InvalidCatalogBackupError('ساختار فایل پشتیبان معتبر نیست.');

  for (const name of REQUIRED_COLLECTIONS) {
    if (!Array.isArray(incoming[name])) {
      throw new InvalidCatalogBackupError(`فهرست ضروری «${name}» در فایل پشتیبان وجود ندارد.`);
    }
  }
  const candidate: DatabaseSchema = { ...current };

  for (const name of CATALOG_RESTORE_COLLECTIONS) {
    const value = incoming[name];
    if (value === undefined) continue;
    if (!Array.isArray(value)) throw new InvalidCatalogBackupError(`فهرست «${name}» باید آرایه باشد.`);

    const ids = new Set<string>();
    for (const entry of value) {
      if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim() || ids.has(entry.id)) {
        throw new InvalidCatalogBackupError(`شناسهٔ نامعتبر یا تکراری در «${name}» موجود است.`);
      }
      ids.add(entry.id);
    }
    // Do not retain references to the request object in mutable database state.
    (candidate as unknown as Record<CatalogCollection, unknown>)[name] = structuredClone(value);
  }

  if (incoming.academicSettings !== undefined) {
    if (!isRecord(incoming.academicSettings)) {
      throw new InvalidCatalogBackupError('ساختار تنظیمات آموزشی در فایل پشتیبان معتبر نیست.');
    }
    // Preserve current policy unless a separate, reviewed policy change occurs.
    // A backup from another term must not silently change unit limits.
  }

  if (candidate.courses.length === 0 || candidate.curricula.length === 0) {
    throw new InvalidCatalogBackupError('فایل پشتیبان بدون درس یا چارت معتبر قابل جایگزینی نیست.');
  }

  const courses = idSet(candidate.courses);
  const offerings = idSet(candidate.courseOfferings);
  const curricula = idSet(candidate.curricula);
  const terms = idSet(candidate.academicTerms);
  const campuses = idSet(candidate.campuses);
  const majors = idSet(candidate.majors);
  const universities = idSet(candidate.universities);
  const levels = idSet(candidate.degreeLevels);
  const years = idSet(candidate.entryYears);

  // The restored catalogue itself must not contain dangling academic links.
  ensureReferences(candidate.campuses.map(x => x.universityId), universities, 'دانشگاه واحدها');
  ensureReferences(candidate.majors.map(x => x.degreeLevelId), levels, 'مقطع رشته‌ها');
  ensureReferences(candidate.curricula.map(x => x.universityId), universities, 'دانشگاه چارت‌ها');
  ensureReferences(candidate.curricula.map(x => x.campusId), campuses, 'واحد چارت‌ها');
  ensureReferences(candidate.curricula.map(x => x.degreeLevelId), levels, 'مقطع چارت‌ها');
  ensureReferences(candidate.curricula.map(x => x.majorId), majors, 'رشتهٔ چارت‌ها');
  ensureReferences(candidate.curricula.map(x => x.entryYearId), years, 'ورودی چارت‌ها');
  ensureReferences(candidate.academicRules.map(x => x.curriculumId), curricula, 'چارت قوانین آموزشی');
  ensureReferences(candidate.academicRules.map(x => x.targetCourseId), courses, 'درس مقصد قوانین آموزشی');
  ensureReferences(candidate.curriculumCourses.map(x => x.courseId), courses, 'دروس چارت');
  ensureReferences(candidate.curriculumCourses.map(x => x.curriculumId), curricula, 'شناسهٔ چارت');
  ensureReferences(candidate.courseOfferings.map(x => x.courseId), courses, 'دروس گروه‌ها');
  ensureReferences(candidate.courseOfferings.map(x => x.termId), terms, 'ترم گروه‌ها');
  ensureReferences(candidate.courseOfferings.map(x => x.campusId), campuses, 'واحد گروه‌ها');

  // Never orphan current student plans or survey responses when applying a
  // catalogue backup. Student data is always preserved, not overwritten.
  ensureReferences(current.studentPlans?.flatMap(x => x.selectedOfferingIds) ?? [], offerings, 'برنامهٔ جاری دانشجویان');
  ensureReferences(current.studentPassedCourses.map(x => x.courseId), courses, 'درس‌های گذرانده‌شده');
  ensureReferences(current.studentProfiles.map(x => x.universityId), universities, 'دانشگاه دانشجویان');
  ensureReferences(current.studentProfiles.map(x => x.campusId), campuses, 'واحد دانشجویان');
  ensureReferences(current.studentProfiles.map(x => x.degreeLevelId), levels, 'مقطع دانشجویان');
  ensureReferences(current.studentProfiles.map(x => x.majorId), majors, 'رشتهٔ دانشجویان');
  ensureReferences(current.studentProfiles.map(x => x.entryYearId), years, 'ورودی دانشجویان');
  ensureReferences(current.studentProfiles.flatMap(x => x.currentTermId ? [x.currentTermId] : []), terms, 'ترم دانشجویان');
  ensureReferences(current.studentPlans?.map(x => x.termId) ?? [], terms, 'ترم برنامهٔ دانشجویان');
  ensureReferences(current.demandSurveys.map(x => x.targetTermId), terms, 'ترم نیازسنجی');
  ensureReferences(current.demandSurveys.map(x => x.majorId), majors, 'رشتهٔ نیازسنجی');
  ensureReferences(current.demandSurveys.flatMap(x => x.courseIds), courses, 'نیازسنجی‌های فعال/ثبت‌شده');

  // All non-catalogue collections (users and session versions, plans,
  // responses, SMS configuration, audit logs, OTP and captcha challenges,
  // support conversations, sync state, imports) stay exactly as they are.
  return candidate;
}
