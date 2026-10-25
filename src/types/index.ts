// ==========================================
// DARSCHYN (درس‌چین) - Shared Type Definitions
// ==========================================

export type UserRole = 'student' | 'admin' | 'super-admin';

export interface User {
  id: string;
  mobile: string;
  name: string;
  password?: string;
  recoveryKey?: string;
  roles: UserRole[];
  permissions?: string[];
  /** Department-level access: the admin.panel.access permission alone grants no survey PII access. */
  demandScopes?: DemandManagerScope[];
  createdBy?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  createdAt: string;
}

export interface OtpChallenge {
  id: string;
  mobile: string;
  purpose: 'login' | 'registration' | 'password_recovery' | 'admin_auth';
  hashedOtp: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  consumedAt?: number;
  recoveredAt?: number;
  provider?: string;
  providerMessageId?: string;
}

export interface CaptchaChallenge {
  id: string;
  value: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  consumedAt?: number;
}

export interface University {
  id: string;
  name: string;
  code: string;
  active: boolean;
  isExtraUnit?: boolean; // مازاد بر واحد
}

export interface Province {
  id: string;
  name: string;
  active: boolean;
}

export type UnitType = 'PROVINCE_UNIT' | 'INDEPENDENT_UNIT' | 'SPECIAL_UNIT';

export interface Campus {
  id: string;
  universityId: string;
  provinceId?: string | null;
  type: UnitType;
  name: string;
  code: string;
  city?: string;
  active: boolean;
}

export interface DegreeLevel {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface Major {
  id: string;
  degreeLevelId: string;
  name: string;
  code: string;
  active: boolean;
}

export interface Track {
  id: string;
  majorId: string;
  name: string;
  code: string;
  active: boolean;
}

export interface EntryYear {
  id: string;
  year: number; // e.g. 1403
  active: boolean;
}

export interface AcademicTerm {
  id: string;
  name: string; // e.g. "نیمسال اول ۱۴۰۵-۱۴۰۶"
  year: number; // 1405
  termNumber: 1 | 2 | 3; // 1: Fall, 2: Spring, 3: Summer
  isCurrent: boolean;
  active: boolean;
}

export type CourseCategory =
  | 'عمومی'
  | 'پایه'
  | 'اصلی'
  | 'تخصصی'
  | 'اختیاری'
  | 'آزمایشگاه'
  | 'پروژه'
  | 'کارآموزی'
  | 'سایر';

export interface CourseCodeInfo {
  code: string;
  entryYear?: number;
  majorId?: string;
  trackId?: string;
  notes?: string;
  active?: boolean;
}

export interface Course {
  id: string;
  code: string; // e.g. "2104112" (primary code)
  alternateCodes?: string[]; // e.g. ["2104112-old", "54321"]
  courseCodes?: CourseCodeInfo[]; // structured multi-code model
  name: string; // e.g. "ریاضی عمومی ۱"
  units: number;
  isExtraUnit?: boolean; // Added for UI // e.g. 3
  practicalUnits?: number; // e.g. 0
  category: CourseCategory;
  description?: string;
  active: boolean;
}

export interface Curriculum {
  id: string;
  universityId: string;
  campusId: string;
  degreeLevelId: string;
  majorId: string;
  entryYearId: string;
  version: string; // e.g. "1403-v1"
  name: string; // e.g. "چارت مهندسی برق ورودی ۱۴۰۳"
  notes?: string;
  status: 'active' | 'draft' | 'archived';
  createdAt: string;
}

export type CourseClassification = 'MAJOR_REQUIRED' | 'MAJOR_ELECTIVE' | 'TRACK_REQUIRED' | 'TRACK_ELECTIVE';

export interface CurriculumCourse {
  id: string;
  curriculumId: string;
  courseId: string;
  trackId?: string | null; // If specified, only applies to this track
  classification: CourseClassification;
  suggestedSemester: number; // 1 to 8
  categoryOverride?: CourseCategory;
  active: boolean;
}

export type RelationshipType = 'PREREQUISITE' | 'COREQUISITE' | 'CONTEXTUAL_RETAKE_RULE';

export type RuleLogicalOperator = 'AND' | 'OR';

export interface AcademicRuleNode {
  type: 'COURSE' | 'GROUP';
  courseId?: string; // If type === 'COURSE'
  operator?: RuleLogicalOperator; // If type === 'GROUP'
  operands?: AcademicRuleNode[]; // If type === 'GROUP'
}

export interface AcademicRule {
  id: string;
  curriculumId: string;
  targetCourseId: string;
  relationshipType: RelationshipType;
  
  // Structured logical expression for the rule
  expression: AcademicRuleNode;
  
  entryYearId?: string | null;
  majorId?: string | null;
  trackId?: string | null;
  
  notes?: string;
}

export interface StudentAcademicProfile {
  userId: string;
  universityId: string;
  provinceId?: string | null;
  campusId: string;
  degreeLevelId: string;
  majorId: string;
  entryYearId: string;
  isTrackSelected: boolean; // Has student officially chosen a track?
  selectedTrackId?: string | null; // If isTrackSelected === true
  desiredTrackIds: string[]; // If isTrackSelected === false: array of trackIds student is considering
  currentTermId?: string | null;
  /** Optional self-entered identifier, never present in public academic lists. */
  studentNumber?: string;
  previousTermGpa?: number | null;
  isFinalSemesterOverride?: boolean | null; // Admin manual override
  finalSemesterNotes?: string;
  updatedAt: string;
}

export interface AcademicPolicySettings {
  normalMinUnits: number; // default: 12
  normalMaxUnits: number; // default: 20
  gpaBonusThreshold: number; // default: 17.0 (GPA >= 17 gets 24 units)
  gpaBonusMaxUnits: number; // default: 24
  summerMinUnits: number; // default: 1
  summerMaxUnits: number; // default: 8
  finalSemesterMaxUnits: number; // default: 24
  finalSemesterThresholdUnits: number; // default: 24 (if remaining units <= 24, student qualifies for final semester)
  finalSemesterRuleEnabled: boolean; // default: true
}

export interface AcademicLimitInfo {
  normalMinUnits: number;
  normalMaxUnits: number;
  effectiveMinUnits: number;
  effectiveMaxUnits: number;
  isFinalSemester: boolean;
  finalSemesterReason?: string;
  isGradeA: boolean;
  isSummer: boolean;
  totalCurriculumUnits: number;
  passedUnits: number;
  remainingUnits: number;
  remainingCoursesCount: number;
  policySettings: AcademicPolicySettings;
  
  // Advanced Curriculum Progress
  majorRequiredPassed: number;
  majorRequiredRemaining: number;
  trackRequiredPassed: number;
  trackRequiredRemaining: number;
  electivesPassed: number;
  electivesRemaining: number;
}

export type CourseAttemptStatus = 'PASSED' | 'FAILED' | 'ABSENT';

export interface StudentPassedCourse {
  id: string;
  userId: string;
  courseId: string;
  grade?: number; // Optional grade (e.g. 17.5 or 8.0)
  status?: CourseAttemptStatus; // default: 'PASSED'
  termId?: string | null;
  passedAt: string;
}

/** Manager assignments are independent of generic administrator status. */
export interface DemandManagerScope {
  campusId: string;
  degreeLevelId: string;
  majorId: string;
}

export type DemandSurveyStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
export interface DemandSurvey {
  id: string;
  title: string;
  description: string;
  targetTermId: string;
  universityId: string;
  campusId: string;
  degreeLevelId: string;
  majorId: string;
  curriculumId?: string;
  entryYearIds: string[];
  trackIds: string[];
  courseIds: string[];
  recommendedMinimumByCourse: Record<string, number>;
  startsAt?: string;
  endsAt?: string;
  status: DemandSurveyStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DemandResponse {
  id: string;
  surveyId: string;
  userId: string;
  studentNumber: string;
  anticipatedGraduation: 'YES' | 'NO' | 'UNKNOWN';
  courseIds: string[];
  /** Context at time of submission: never inferred to be officially verified. */
  snapshot: {
    studentName: string;
    campusId: string;
    majorId: string;
    entryYearId: string;
    isTrackSelected: boolean;
    selectedTrackId?: string | null;
  };
  submittedAt: string;
  updatedAt: string;
}

export interface StudentPlan {
  id: string;
  userId: string;
  termId: string;
  selectedOfferingIds: string[];
  /** New clients store ordered course IDs; old plans may contain numeric priority ranks. */
  coursePriorities?: string[] | Record<string, number>;
  offeringPriorities?: Record<string, string[]>;
  updatedAt: string;
}

export type OfferingSource = 'extension' | 'manual' | 'api';

export interface CourseOffering {
  id: string;
  termId: string;
  campusId: string;
  courseId: string; // Matched course ID in curriculum/catalog
  rawCourseCode?: string;
  rawCourseName?: string;
  groupCode: string; // e.g. "01", "02"
  instructor: string;
  dayOfWeek: string; // e.g. "شنبه", "دوشنبه"
  startTime: string; // "08:00"
  endTime: string; // "10:00"
  location?: string;
  capacity: number;
  enrolledCount: number;
  /** false when no verified enrollment count was provided by the source. */
  enrolledCountKnown?: boolean;
  examDate?: string;
  notes?: string;
  /** Stable identity supplied by the source adapter for idempotent reconciliation. */
  sourceIdentity?: string;
  source: OfferingSource;
  active: boolean;
}

// ----------------------------------------------------
// Extension & Import Schemas (Schema Version 1.0)
// ----------------------------------------------------

export interface RawExtractedOffering {
  courseCode: string;
  courseName: string;
  group: string;
  instructor?: string | null;
  units?: number | null;
  day?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  capacity?: number | null;
  availableCapacity?: number | null;
  status?: string | null;
  examDate?: string | null;
  location?: string | null;
}

export interface ExtensionExportPayload {
  schemaVersion: '1.0';
  source: 'darschyn-chrome-extension' | 'mock-educational-system' | 'manual-file';
  extractedAt: string;
  term?: string | null;
  university?: string | null;
  campus?: string | null;
  records: RawExtractedOffering[];
}

export type ImportRecordStatus = 'MATCHED' | 'NEEDS_REVIEW' | 'INVALID';

export interface ImportRecord {
  id: string;
  batchId: string;
  rawData: RawExtractedOffering;
  matchedCourseId?: string | null;
  status: ImportRecordStatus;
  reviewReason?: string;
  /** An audited mapping decision is not permission to publish an offering. */
  reviewDecision?: 'COURSE_MATCH_CONFIRMED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface ImportBatch {
  id: string;
  userId: string;
  termId: string;
  source: OfferingSource;
  schemaVersion: string;
  totalRecords: number;
  matchedRecords: number;
  reviewRecords: number;
  invalidRecords: number;
  rawJson?: string;
  createdAt: string;
}

// ----------------------------------------------------
// Eligibility Engine Types
// ----------------------------------------------------

export type EligibilityStatus =
  | 'AVAILABLE' // ✅ قابل اخذ
  | 'BLOCKED_PREREQUISITE' // ❌ پیش‌نیاز پاس نشده
  | 'BLOCKED_COREQUISITE' // ❌ هم‌نیاز برداشته یا پاس نشده
  | 'ALREADY_PASSED' // ℹ️ قبلاً پاس شده
  | 'NOT_IN_CURRICULUM' // ⚠️ خارج از چارت تحصیلی
  | 'MAJOR_MISMATCH' // ⚠️ مغایرت با رشته تحصیلی
  | 'NEEDS_REVIEW'; // ❓ نیازمند بررسی دستی / قانون نامشخص

export interface TrackEligibilityBreakdown {
  trackId: string;
  trackName: string;
  status: EligibilityStatus;
  isEligible: boolean;
  reasons: string[];
  missingPrerequisites: Array<{ id: string; name: string; code: string }>;
  missingCorequisites: Array<{ id: string; name: string; code: string }>;
}

export interface CourseEligibilityResult {
  offeringId: string;
  courseId: string;
  courseCode: string;
  /** Raw code actually supplied with the offering (may be absent). Never silently conflate it with catalog code. */
  rawCourseCode?: string;
  courseName: string;
  units: number;
  category: CourseCategory;
  groupCode: string;
  instructor: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  capacity: number;
  enrolledCount: number;
  /** false when no verified enrollment count was provided by the source. */
  enrolledCountKnown?: boolean;
  examDate?: string;
  overallStatus: EligibilityStatus;
  isEligible: boolean;
  canSelect: boolean; // Authoritative boolean: true iff isEligible && overallStatus === 'AVAILABLE'
  primaryReason: string;
  allReasons: string[];
  missingPrerequisites: Array<{ id: string; name: string; code: string }>;
  missingCorequisites: Array<{ id: string; name: string; code: string }>;
  academicRestrictions?: string[];
  warnings?: string[];
  suggestedSemester?: number;
  classification?: CourseClassification;
  trackBreakdowns?: TrackEligibilityBreakdown[]; // If student is undeclared with multi-tracks
  curriculumContext?: {
    curriculumId: string;
    curriculumName?: string;
    classification?: CourseClassification;
    suggestedSemester?: number;
  };
}

export interface EligibilityEvaluationReport {
  studentId: string;
  termId: string;
  curriculumId: string;
  totalOfferingsEvaluated: number;
  eligibleCount: number;
  blockedCount: number;
  alreadyPassedCount: number;
  needsReviewCount: number;
  results: CourseEligibilityResult[];
  evaluatedAt: string;
}

// ----------------------------------------------------
// Recommendation Engine Types
// ----------------------------------------------------

export interface CourseRecommendation {
  courseId: string;
  offeringId?: string;
  courseCode: string;
  courseName: string;
  units: number;
  category: CourseCategory;
  score: number; // 0 to 100
  suggestedSemester: number;
  unlockedFutureCoursesCount: number;
  unlockedCourseNames: string[];
  reasons: string[]; // Persian explanation tags
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ----------------------------------------------------
// API Response Types
// ----------------------------------------------------

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}


// --- Support & Diagnostics ---

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'ANSWERED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface BugReport {
  id: string;
  userId: string;
  title: string;
  category: 'UI' | 'ACADEMIC_DATA' | 'PREREQUISITE' | 'ELIGIBILITY' | 'EXTENSION' | 'IMPORT' | 'OTHER';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  pageContext?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
  createdAt: string;
}

export interface ErrorLog {
  id: string;
  context: string;
  errorMessage: string;
  stackTrace?: string;
  createdAt: string;
}
