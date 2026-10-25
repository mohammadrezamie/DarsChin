// ============================================================================
// DARSCHYN (درس‌چین) - Database Engine & Local Persistence Layer
// ============================================================================

import fs from 'fs';
import type { SmsConfiguration, SmsDelivery } from '../sms/service';
import bcrypt from 'bcryptjs';
import { getInitialSeedData } from './seed';
import path from 'path';
import {
  User,
  University,
  Province,
  Campus,
  DegreeLevel,
  Major,
  Track,
  EntryYear,
  Curriculum,
  Course,
  CurriculumCourse,
  AcademicRule,
  
  AcademicTerm,
  CourseOffering,
  StudentAcademicProfile,
  StudentPassedCourse,
  StudentPlan,
  DemandSurvey,
  DemandResponse,
  ImportBatch,
  ImportRecord,
  AcademicPolicySettings,
  AcademicLimitInfo,
  SupportTicket, SupportMessage, BugReport, AuditLog, ErrorLog, UserRole, OtpChallenge, CaptchaChallenge
} from '../../src/types';

export const DEFAULT_ACADEMIC_SETTINGS: AcademicPolicySettings = {
  normalMinUnits: 12,
  normalMaxUnits: 20,
  gpaBonusThreshold: 17.0,
  gpaBonusMaxUnits: 24,
  summerMinUnits: 1,
  summerMaxUnits: 8,
  finalSemesterMaxUnits: 24,
  finalSemesterThresholdUnits: 24,
  finalSemesterRuleEnabled: true,
};

export interface DatabaseSchema {
  syncJobs: any[];
  syncSnapshots: any[];
  users: User[];
  universities: University[];
  provinces: Province[];
  campuses: Campus[];
  degreeLevels: DegreeLevel[];
  majors: Major[];
  tracks: Track[];
  entryYears: EntryYear[];
  academicTerms: AcademicTerm[];
  curricula: Curriculum[];
  courses: Course[];
  curriculumCourses: CurriculumCourse[];
  academicRules: AcademicRule[];
  
  courseOfferings: CourseOffering[];
  studentProfiles: StudentAcademicProfile[];
  studentPassedCourses: StudentPassedCourse[];
  studentPlans?: StudentPlan[];
  demandSurveys: DemandSurvey[];
  demandResponses: DemandResponse[];
  importBatches: ImportBatch[];
  importRecords: ImportRecord[];
  academicSettings: AcademicPolicySettings;
  supportTickets: SupportTicket[];
  supportMessages: SupportMessage[];
  bugReports: BugReport[];
  auditLogs: AuditLog[];
  errorLogs: ErrorLog[];
  otpChallenges: OtpChallenge[];
  captchaChallenges: CaptchaChallenge[];
  smsSettings?: SmsConfiguration;
  smsHistory?: SmsDelivery[];
}

const DATA_DIR = process.env.DARSCHYN_DATA_DIR
  ? path.resolve(process.env.DARSCHYN_DATA_DIR)
  : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'darschyn-db.json');

/**
 * Normalize only review/sync collections introduced after the original JSON
 * database format. Safe for loading old files and applying old admin backups:
 * retain valid arrays and never silently overwrite existing review decisions.
 */
export function ensureReviewCollections(data: Partial<DatabaseSchema>): void {
  if (!Array.isArray(data.demandSurveys)) data.demandSurveys = [];
  if (!Array.isArray(data.smsHistory)) data.smsHistory = [];
  if (!Array.isArray(data.demandResponses)) data.demandResponses = [];
  if (!Array.isArray(data.importBatches)) data.importBatches = [];
  if (!Array.isArray(data.importRecords)) data.importRecords = [];
  if (!Array.isArray(data.syncJobs)) data.syncJobs = [];
  if (!Array.isArray(data.syncSnapshots)) data.syncSnapshots = [];
}

/** Demo seed accounts are never acceptable authentication identities on a public service. */
export function isKnownDemoSeedUser(user: Pick<User, 'id' | 'mobile'>): boolean {
  return (user.id === 'usr-admin-1' && user.mobile === '09121111111') ||
    (user.id === 'usr-student-1' && user.mobile === '09120000000');
}

export class LocalDatabase {
  public data: DatabaseSchema = {
    users: [],
    universities: [],
    provinces: [],
    campuses: [],
    degreeLevels: [],
    majors: [],
    tracks: [],
    entryYears: [],
    academicTerms: [],
    curricula: [],
    courses: [],
    curriculumCourses: [],
    academicRules: [],
    
    courseOfferings: [],
    studentProfiles: [],
    studentPassedCourses: [],
    demandSurveys: [],
    demandResponses: [],
    importBatches: [],
    importRecords: [],
    academicSettings: { ...DEFAULT_ACADEMIC_SETTINGS },
    supportTickets: [],
    supportMessages: [],
    bugReports: [],
    auditLogs: [],
    errorLogs: [],
    otpChallenges: [],
    captchaChallenges: [],
    syncJobs: [],
    syncSnapshots: [],
  };

  // Keep legacy route accessors backed by the persisted schema. Separate arrays here
  // silently lost sync history whenever the process restarted.
  public get syncJobs(): any[] {
    return this.data.syncJobs || (this.data.syncJobs = []);
  }

  public set syncJobs(value: any[]) {
    this.data.syncJobs = Array.isArray(value) ? value : [];
  }

  public get syncSnapshots(): any[] {
    return this.data.syncSnapshots || (this.data.syncSnapshots = []);
  }

  public set syncSnapshots(value: any[]) {
    this.data.syncSnapshots = Array.isArray(value) ? value : [];
  }

  private isInitialized = false;

  constructor() {
    this.ensureDataDir();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  public async init(seedIfEmpty = true) {
    if (this.isInitialized) return;
    this.ensureDataDir();
    let loadedExisting = false;

    if (fs.existsSync(DB_FILE)) {
      try {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(content);
        if (!this.data.provinces) this.data.provinces = [];
        // Clean and deduplicate users by ID
        const seenIds = new Set<string>();
        const cleanUsers: any[] = [];
        for (const u of this.data.users) {
          if (!u.id || seenIds.has(u.id)) continue;
          seenIds.add(u.id);
          cleanUsers.push(u);
        }
        this.data.users = cleanUsers;

        this.data.users.forEach((u) => {
          if (!Array.isArray(u.roles)) {
            u.roles = u.roles ? [(u.roles as any)] : ['student'];
          }
        });

        
        
if (!this.data.supportTickets) this.data.supportTickets = [];
        if (!this.data.supportMessages) this.data.supportMessages = [];
        if (!this.data.bugReports) this.data.bugReports = [];
        if (!this.data.auditLogs) this.data.auditLogs = [];
        ensureReviewCollections(this.data);
        if (!this.data.errorLogs) this.data.errorLogs = [];
        if (!this.data.otpChallenges) this.data.otpChallenges = [];
        if (!this.data.captchaChallenges) this.data.captchaChallenges = [];
        if (!this.data.otpChallenges) this.data.otpChallenges = [];
        if (!this.data.captchaChallenges) this.data.captchaChallenges = [];
        if (process.env.NODE_ENV === 'production') {
          const beforeCount = this.data.users.length;
          this.data.users = this.data.users.filter(user => !isKnownDemoSeedUser(user));
          if (this.data.users.length !== beforeCount) this.save();
        }
        loadedExisting = true;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          // Never overwrite a damaged production database with synthetic seed data.
          throw new Error('Unable to read persisted production database; restore an audited backup.', { cause: err });
        }
        console.error('Error reading database file, re-initializing with seed data:', err);
      }
    }

    if (seedIfEmpty && !loadedExisting) {
      const { getInitialSeedData } = await import('./seed');
      this.data = getInitialSeedData();
      if (process.env.NODE_ENV === 'production') {
        // NEVER expose well-known sample users/passwords on a public VPS.
        // Academic seed content remains visibly synthetic until explicitly
        // replaced with verified pilot catalog/curriculum data.
        this.data.users = [];
        this.data.studentProfiles = [];
        this.data.studentPassedCourses = [];
        this.data.studentPlans = [];
        this.data.otpChallenges = [];
        this.data.captchaChallenges = [];
      }
      this.save();
    }
    
        const rootMobile = process.env.ROOT_OWNER_MOBILE;
        const rootPassword = process.env.ROOT_OWNER_PASSWORD; 
        const rootRecovery = process.env.ROOT_OWNER_RECOVERY_KEY;
        
        if (!rootMobile || !rootPassword) {
            console.error('CRITICAL: ROOT_OWNER_MOBILE and ROOT_OWNER_PASSWORD must be set in environment variables.');
            if (process.env.NODE_ENV === 'production') {
                 process.exit(1);
            }
            // For testing only, allow continuing without root if not provided, but do NOT set fallbacks
        }

        let superAdmin = rootMobile ? this.data.users.find(u => u.mobile === rootMobile || u.id === 'usr-super') : null;
        
        const allRoles = ['super-admin', 'admin', 'student'];
        const allPerms = [
            'student.access', 'student.profile.read', 'student.plan.manage', 'student.academic.read',
            'admin.panel.access', 'course.read', 'course.create', 'course.update', 'course.delete',
            'prerequisite.manage', 'corequisite.manage', 'curriculum.manage', 'offering.manage',
            'academic-policy.manage', 'student-management.read', 'support.manage', 'import.manage',
            'admin.create', 'admin.manage', 'admin.remove', 'admin.permission.manage',
            'system.settings.manage', 'backup.manage', 'demand.manage', 'demand.export', 'sms.manage'
        ];

        if (!superAdmin && rootMobile && rootPassword) {
            this.data.users.push({
                id: 'usr-super',
                mobile: rootMobile,
                password: bcrypt.hashSync(rootPassword, 10),
                recoveryKey: rootRecovery,
                name: 'مدیر ارشد سامانه (Root)',
                roles: allRoles as UserRole[],
                permissions: allPerms,
                createdAt: new Date().toISOString()
            });
            console.log("ROOT OWNER INJECTED IN LOCAL DATABASE");
            this.save();
        } else if (superAdmin && rootMobile) {
            // Do NOT silently overwrite an existing password
            superAdmin.mobile = rootMobile;
            superAdmin.roles = allRoles as UserRole[];
            superAdmin.permissions = allPerms;
            superAdmin.name = superAdmin.name || 'مدیر ارشد سامانه (Root)';
            this.save();
        }


        
        
this.isInitialized = true;
  }

  public save() {
    this.ensureDataDir();
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  }

  public resetToSeed() {
    // Sample accounts have known credentials and sample university data.
    // This operation can never be used against a VPS holding real students.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Reset to demo seed data is disabled in production.');
    }
    this.data = getInitialSeedData();
    this.save();
    return this.data;
  }

  public exportBackup(): DatabaseSchema {
    // Downloadable admin backups must not contain credentials or transient auth challenges.
    // Restoring a backup preserves the current users, so this does not block account recovery.
    const safeData: DatabaseSchema = JSON.parse(JSON.stringify(this.data));
    safeData.users = safeData.users.map(({ password, recoveryKey, ...user }) => user);
    safeData.otpChallenges = [];
    safeData.captchaChallenges = [];
    return safeData;
  }

  public importBackup(importedData: Partial<DatabaseSchema>) {
    // Preserve existing users so admin isn't locked out
    const currentUsers = this.data.users;
    this.data = {
      ...this.data,
      ...importedData,
      users: currentUsers,
    };
    ensureReviewCollections(this.data);
    this.save();
    return this.data;
  }

  // --- Getters and CRUD Helpers ---

  get users() { return this.data.users; }
  get universities() { return this.data.universities; }
  get provinces() { return this.data.provinces || []; }
  get campuses() { return this.data.campuses; }
  get degreeLevels() { return this.data.degreeLevels; }
  get majors() { return this.data.majors; }
  get tracks() { return this.data.tracks; }
  get entryYears() { return this.data.entryYears; }
  get academicTerms() { return this.data.academicTerms; }
  get curricula() { return this.data.curricula; }
  get courses() { return this.data.courses; }
  get curriculumCourses() { return this.data.curriculumCourses; }
  get academicRules() { return this.data.academicRules; }
  
  get courseOfferings() { return this.data.courseOfferings; }
  get studentProfiles() { return this.data.studentProfiles; }
  get studentPassedCourses() { return this.data.studentPassedCourses; }
  get studentPlans() { return this.data.studentPlans || (this.data.studentPlans = []); }
  get demandSurveys() { return this.data.demandSurveys || (this.data.demandSurveys = []); }
  get demandResponses() { return this.data.demandResponses || (this.data.demandResponses = []); }
  get importBatches() { return this.data.importBatches || (this.data.importBatches = []); }
  get importRecords() { return this.data.importRecords || (this.data.importRecords = []); }
  get academicSettings(): AcademicPolicySettings {
    if (!this.data.academicSettings) {
      this.data.academicSettings = { ...DEFAULT_ACADEMIC_SETTINGS };
    }
    return this.data.academicSettings;
  }
  set academicSettings(settings: AcademicPolicySettings) {
    this.data.academicSettings = { ...this.data.academicSettings, ...settings };
    this.save();
  }
  get supportTickets() { return this.data.supportTickets || []; }
  get supportMessages() { return this.data.supportMessages || []; }
  get bugReports() { return this.data.bugReports || []; }

  get auditLogs() { return this.data.auditLogs || []; }
  get errorLogs() { return this.data.errorLogs || []; }
  get otpChallenges() { return this.data.otpChallenges || []; }
  get captchaChallenges() { return this.data.captchaChallenges || []; }


  /**
   * Deterministically calculates a student's graduation progress and academic limits,
   * evaluating whether they are in their final semester.
   */
  public calculateStudentAcademicLimits(userId: string): AcademicLimitInfo {
    const settings = this.academicSettings;
    const profile = this.studentProfiles.find((p) => p.userId === userId);

    if (!profile) {
      return {
        normalMinUnits: settings.normalMinUnits,
        normalMaxUnits: settings.normalMaxUnits,
        effectiveMinUnits: settings.normalMinUnits,
        effectiveMaxUnits: settings.normalMaxUnits,
        isFinalSemester: false,
        isGradeA: false,
        isSummer: false,
        // No profile means the scope is unknown, not a fabricated 140-unit curriculum.
        totalCurriculumUnits: 0,
        passedUnits: 0,
        remainingUnits: 0,
        remainingCoursesCount: 0,
        policySettings: settings,
        majorRequiredPassed: 0,
        majorRequiredRemaining: 0,
        trackRequiredPassed: 0,
        trackRequiredRemaining: 0,
        electivesPassed: 0,
        electivesRemaining: 0,
      };
    }

    // Find student curriculum
    const curriculum = this.curricula.find(c =>
      c.status === 'active' &&
      c.universityId === profile.universityId &&
      c.campusId === profile.campusId &&
      c.degreeLevelId === profile.degreeLevelId &&
      c.majorId === profile.majorId &&
      c.entryYearId === profile.entryYearId
    ) || null;

    const curriculumId = curriculum?.id || '';

    // Find courses associated with this curriculum
    // A student who has not formally chosen a track cannot be assumed to
    // require every track's courses. Count only the common curriculum until
    // that choice is official; never manufacture a graduation status.
    const officialTrackId = profile.isTrackSelected ? profile.selectedTrackId : null;
    const currCourses = this.curriculumCourses.filter(cc =>
      cc.curriculumId === curriculumId &&
      cc.active !== false &&
      (!cc.trackId || (officialTrackId && cc.trackId === officialTrackId))
    );


    const currCourseIds = new Set(currCourses.map((cc) => cc.courseId));
    const relevantCourses = this.courses.filter((c) => currCourseIds.has(c.id));
    const totalCurriculumUnits = relevantCourses.reduce((sum, c) => sum + (c.units || 0), 0);

    // Passed courses for this user (excluding failed or absent attempts)
    const passed = this.studentPassedCourses.filter(
      (sp) =>
        sp.userId === userId &&
        sp.status !== 'FAILED' &&
        sp.status !== 'ABSENT' &&
        (sp.status === 'PASSED' || sp.grade === undefined || sp.grade >= 10)
    );
    const passedCourseIds = new Set(passed.map((p) => p.courseId));
    const passedUnits = this.courses
      .filter((c) => passedCourseIds.has(c.id))
      .reduce((sum, c) => sum + (c.units || 0), 0);

    // Advanced Curriculum Progress
    let majorRequiredPassed = 0;
    let majorRequiredRemaining = 0;
    let trackRequiredPassed = 0;
    let trackRequiredRemaining = 0;
    let electivesPassed = 0;
    let electivesRemaining = 0;

    const countedCourses = new Set<string>();
    for (const cc of currCourses) {
      // A course may appear once as common and again under a track. Progress
      // counts course identity once, never both rows.
      if (countedCourses.has(cc.courseId)) continue;
      countedCourses.add(cc.courseId);
      const course = this.courses.find(c => c.id === cc.courseId);
      if (!course) continue;
      
      const units = course.units || 0;
      const isPassed = passedCourseIds.has(course.id);
      
      if (cc.classification === 'MAJOR_REQUIRED') {
        if (isPassed) majorRequiredPassed += units;
        else majorRequiredRemaining += units;
      } else if (cc.classification === 'TRACK_REQUIRED') {
        if (isPassed) trackRequiredPassed += units;
        else trackRequiredRemaining += units;
      } else if (cc.classification === 'MAJOR_ELECTIVE' || cc.classification === 'TRACK_ELECTIVE') {
        if (isPassed) electivesPassed += units;
        else electivesRemaining += units;
      }
    }

    // Use specific remaining required courses plus some elective logic if needed
    // For now we will consider total remaining units across all categories that apply
    // If a curriculum defines a specific number of elective units, this logic could be enhanced.
    const strictRemainingUnits = majorRequiredRemaining + trackRequiredRemaining + electivesRemaining;

    // Remaining curriculum courses
    const remainingCourses = relevantCourses.filter((c) => !passedCourseIds.has(c.id));
    const remainingUnits = strictRemainingUnits;
    const remainingCoursesCount = remainingCourses.length;


    // Term & Grade analysis
    const currentTermId = profile.currentTermId || this.academicTerms.find((t) => t.isCurrent)?.id;
    const currentTerm = this.academicTerms.find((t) => t.id === currentTermId);
    const isSummer = currentTerm?.termNumber === 3;
    const isGradeA =
      profile.previousTermGpa !== undefined && profile.previousTermGpa !== null
        ? profile.previousTermGpa >= settings.gpaBonusThreshold
        : false;

    // Final semester evaluation
    let isFinalSemester = false;
    let finalSemesterReason = '';

    if (!curriculum) {
      // Without an exact active chart there is no verified basis for inferred
      // remaining credits or final-semester eligibility.
      finalSemesterReason = 'چارت فعال مطابق واحد، مقطع، رشته و ورودی یافت نشد؛ وضعیت ترم آخر نامشخص است.';
    } else if (!profile.isTrackSelected && this.curriculumCourses.some(cc =>
      cc.curriculumId === curriculum.id && cc.active !== false && !!cc.trackId)) {
      finalSemesterReason = 'گرایش رسمی دانشجو مشخص نیست؛ واحدهای باقی‌ماندهٔ گرایش هنوز قابل محاسبهٔ قطعی نیستند.';
    } else if (profile.isFinalSemesterOverride === true) {
      isFinalSemester = true;
      finalSemesterReason =
        profile.finalSemesterNotes ||
        'مجوز دانشجوی ترم آخری توسط اداره آموزش ثبت و تایید شده است (سقف ۲۴ واحد فعال).';
    } else if (profile.isFinalSemesterOverride === false) {
      isFinalSemester = false;
      finalSemesterReason = 'مجوز ترم آخری توسط اداره آموزش رد شده است.';
    } else if (
      settings.finalSemesterRuleEnabled &&
      remainingUnits > 0 &&
      remainingUnits <= settings.finalSemesterThresholdUnits
    ) {
      isFinalSemester = true;
      finalSemesterReason = `تعداد واحدهای باقیمانده تا فراغت از تحصیل (${remainingUnits} واحد) کمتر یا مساوی سقف مجاز ترم آخری (${settings.finalSemesterThresholdUnits} واحد) می‌باشد.`;
    } else {
      isFinalSemester = false;
      if (remainingUnits > settings.finalSemesterThresholdUnits) {
        finalSemesterReason = `واحدهای باقیمانده (${remainingUnits} واحد) بیش از آستانه ترم آخری (${settings.finalSemesterThresholdUnits} واحد) است.`;
      }
    }

    // Determine limits
    let effectiveMinUnits = isSummer ? settings.summerMinUnits : settings.normalMinUnits;
    if (isFinalSemester && !isSummer) effectiveMinUnits = 2;
    let effectiveMaxUnits = settings.normalMaxUnits;

    if (isSummer) {
      effectiveMaxUnits = settings.summerMaxUnits;
    } else if (isFinalSemester) {
      effectiveMaxUnits = settings.finalSemesterMaxUnits;
    } else if (isGradeA) {
      effectiveMaxUnits = settings.gpaBonusMaxUnits;
    }

    return {
      normalMinUnits: settings.normalMinUnits,
      normalMaxUnits: settings.normalMaxUnits,
      effectiveMinUnits,
      effectiveMaxUnits,
      isFinalSemester,
      finalSemesterReason,
      isGradeA,
      isSummer,
      totalCurriculumUnits,
      passedUnits,
      remainingUnits,
      remainingCoursesCount,
      policySettings: settings,
      majorRequiredPassed: majorRequiredPassed,
      majorRequiredRemaining: majorRequiredRemaining,
      trackRequiredPassed: trackRequiredPassed,
      trackRequiredRemaining: trackRequiredRemaining,
      electivesPassed: electivesPassed,
      electivesRemaining: electivesRemaining,
    };
  }
}

export const db = new LocalDatabase();
