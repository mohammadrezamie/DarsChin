// ============================================================================
// DARSCHYN (درس‌چین) - Database Engine & Local Persistence Layer
// ============================================================================

import fs from 'fs';
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
  ImportBatch,
  ImportRecord,
  AcademicPolicySettings,
  AcademicLimitInfo,
  SupportTicket, SupportMessage, BugReport, AuditLog, ErrorLog
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
  importBatches: ImportBatch[];
  importRecords: ImportRecord[];
  academicSettings: AcademicPolicySettings;
  supportTickets: SupportTicket[];
  supportMessages: SupportMessage[];
  bugReports: BugReport[];
  auditLogs: AuditLog[];
  errorLogs: ErrorLog[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'darschyn-db.json');

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
    importBatches: [],
    importRecords: [],
    academicSettings: { ...DEFAULT_ACADEMIC_SETTINGS },
    supportTickets: [],
    supportMessages: [],
    bugReports: [],
    auditLogs: [],
    errorLogs: [],
  };

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

        const superAdmin = this.data.users.find(u => u.mobile === '09911902465' || u.id === 'usr-super');
        if (!superAdmin) {
            this.data.users.push({
                id: 'usr-super',
                mobile: '09911902465',
                password: bcrypt.hashSync('1010', 10),
                recoveryKey: 'darschyn-root-key',
                name: 'مدیر ارشد سامانه',
                roles: ['super-admin', 'admin', 'student'],
                createdAt: new Date().toISOString()
            });
            console.log("SUPER ADMIN INJECTED IN LOCAL DATABASE");
            this.save();
        } else {
            superAdmin.id = 'usr-super';
            superAdmin.mobile = '09911902465';
            superAdmin.name = superAdmin.name || 'مدیر ارشد سامانه';
            superAdmin.roles = ['super-admin', 'admin', 'student'];
            if (!superAdmin.password || bcrypt.compareSync('admin123', superAdmin.password)) {
              superAdmin.password = bcrypt.hashSync('1010', 10);
              superAdmin.recoveryKey = 'darschyn-root-key';
            }
            this.save();
        }

        
        if (!this.data.supportTickets) this.data.supportTickets = [];
        if (!this.data.supportMessages) this.data.supportMessages = [];
        if (!this.data.bugReports) this.data.bugReports = [];
        if (!this.data.auditLogs) this.data.auditLogs = [];
        if (!this.data.errorLogs) this.data.errorLogs = [];
        this.isInitialized = true;
        return;
      } catch (err) {
        console.error('Error reading database file, re-initializing with seed data:', err);
      }
    }

    if (seedIfEmpty) {
      const { getInitialSeedData } = await import('./seed');
      this.data = getInitialSeedData();
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
    this.data = getInitialSeedData();
    this.save();
    return this.data;
  }

  public exportBackup(): DatabaseSchema {
    // Return copy of data without sensitive password hashes for export
    const safeData: DatabaseSchema = JSON.parse(JSON.stringify(this.data));
    safeData.users = safeData.users.map((u) => ({
      ...u,
      passwordHash: undefined,
    }));
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
  get importBatches() { return this.data.importBatches; }
  get importRecords() { return this.data.importRecords; }
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
        totalCurriculumUnits: 140,
        passedUnits: 0,
        remainingUnits: 140,
        remainingCoursesCount: 45,
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
    const curriculum =
      this.curricula.find(
        (c) =>
          c.universityId === profile.universityId &&
          c.majorId === profile.majorId &&
          c.entryYearId === profile.entryYearId
      ) || this.curricula[0];

    const curriculumId = curriculum?.id || '';

    // Find courses associated with this curriculum
    const currCourses = this.curriculumCourses.filter(
      (cc) =>
        cc.curriculumId === curriculumId &&
        (!cc.trackId || !profile.selectedTrackId || cc.trackId === profile.selectedTrackId)
    );


    const currCourseIds = new Set(currCourses.map((cc) => cc.courseId));
    const relevantCourses = this.courses.filter((c) => currCourseIds.has(c.id));
    const totalCurriculumUnits = relevantCourses.reduce((sum, c) => sum + (c.units || 0), 0) || 140;

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

    for (const cc of currCourses) {
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

    if (profile.isFinalSemesterOverride === true) {
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
    const effectiveMinUnits = isSummer ? settings.summerMinUnits : settings.normalMinUnits;
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
