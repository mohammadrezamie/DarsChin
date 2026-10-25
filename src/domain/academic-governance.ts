/** 
 * Versioned academic source model. Records here describe *evidence*, not
 * verified eligibility. Do not grant course enrollment from these types alone.
 */
export type AuthorityKind = 'MINISTRY_PROGRAM' | 'IAU_APPROVED' | 'OTHER_AUTHORIZED';
export type VerificationState = 'DRAFT' | 'PENDING_SOURCE' | 'VERIFIED' | 'SUPERSEDED';
export type CourseAttemptOutcome =
  | 'PASSED' | 'FAILED_EXAM' | 'EXAM_ABSENCE_EXCUSED'
  | 'EXAM_ABSENCE_UNEXCUSED' | 'CLASS_ABSENCE_EXCUSED'
  | 'CLASS_ABSENCE_UNEXCUSED' | 'DISCIPLINARY_FAIL'
  | 'ADMIN_WITHDRAWAL' | 'UNKNOWN';

export interface AcademicDocumentReference {
  id: string;
  authority: AuthorityKind;
  documentNumber?: string;
  title: string;
  issuedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  sourceUrl?: string;
  fileSha256?: string;
  verification: VerificationState;
  verifiedAt?: string;
}

export type LocalCurriculumChangeType = 'ADD_REQUIRED' | 'REPLACE' | 'REMOVE_WITH_APPROVAL' | 'OVERRIDE_UNITS';
export interface LocalCurriculumChange {
  type: LocalCurriculumChangeType;
  courseId: string;
  replacementCourseId?: string;
  reason: string;
  approvalDocumentId?: string;
}

export interface CampusProgramAuthorization {
  campusId: string;
  degreeLevelId: string;
  majorId: string;
  /** Null means a major without tracks; do not fabricate an unspecified track. */
  trackId: string | null;
  admissionYearFrom: number;
  admissionYearTo?: number;
  permitted: boolean;
  approvalDocumentId?: string;
  verification: VerificationState;
}

export interface VersionedCurriculumEvidence {
  curriculumId: string;
  programDocumentId?: string;
  referenceProgramId?: string;
  campusId: string;
  degreeLevelId: string;
  majorId: string;
  entryYear: number;
  trackId: string | null;
  changes: LocalCurriculumChange[];
  verification: VerificationState;
}

export type AcademicReadiness = 'VERIFIED' | 'NEEDS_VERIFICATION';
export function assessCurriculumEvidence(
  evidence: VersionedCurriculumEvidence,
  docs: readonly AcademicDocumentReference[],
): { status: AcademicReadiness; problems: string[] } {
  const problems: string[] = [];
  const doc = docs.find(d => d.id === evidence.programDocumentId);
  if (!doc || doc.verification !== 'VERIFIED') problems.push('منبع رسمی چارت هنوز تأیید نشده است.');
  if (evidence.verification !== 'VERIFIED') problems.push('نسخه چارت هنوز تأیید نشده است.');
  if (!Number.isInteger(evidence.entryYear) || evidence.entryYear < 1300) problems.push('سال ورود معتبر نیست.');
  if (!evidence.campusId || !evidence.degreeLevelId || !evidence.majorId) problems.push('واحد، مقطع و رشته باید مشخص باشند.');
  for (const change of evidence.changes) {
    if (!change.reason.trim() || !change.approvalDocumentId ||
        !docs.some(d => d.id === change.approvalDocumentId && d.verification === 'VERIFIED')) {
      problems.push(`تغییر درس ${change.courseId} مستند تأییدشده ندارد.`);
    }
    if (change.type === 'REPLACE' && !change.replacementCourseId) {
      problems.push(`درس جایگزین ${change.courseId} مشخص نشده است.`);
    }
  }
  return { status: problems.length ? 'NEEDS_VERIFICATION' : 'VERIFIED', problems };
}

/**
 * Track availability is scoped to campus + degree + major + entry year,
 * independent of whether the catalog globally defines many tracks.
 */
export function permittedCampusTracks(
  options: readonly CampusProgramAuthorization[],
  context: { campusId: string; degreeLevelId: string; majorId: string; entryYear: number },
): string[] {
  return [...new Set(options.filter(o =>
    o.campusId === context.campusId && o.degreeLevelId === context.degreeLevelId &&
    o.majorId === context.majorId && o.admissionYearFrom <= context.entryYear &&
    (o.admissionYearTo === undefined || o.admissionYearTo >= context.entryYear) &&
    o.permitted && o.verification === 'VERIFIED' && o.trackId !== null,
  ).map(o => o.trackId!))];
}
