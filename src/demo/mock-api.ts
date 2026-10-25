import { DEMO_COURSES } from './course-planner';
import { processImportPayload } from '../domain/import-validator';
import { summarizeCourseTeachers, validRatingScores, type TeacherRating } from '../domain/teacher-ratings';
import { extractSourceCourseIds } from '../utils/academic';
import { createsPrerequisiteCycle } from '../domain/prerequisite-graph';
import type { AcademicRule } from '../types';
import type {
  ApiResponse, AcademicLimitInfo, AcademicPolicySettings, Course, CourseEligibilityResult,
  CourseOffering, StudentAcademicProfile,
} from '../types';

/**
 * Synthetic, BROWSER-ONLY API simulator for /demo/* pages.
 * It must never be used to authorize users or declare university eligibility.
 * Unsupported operations fail explicitly instead of pretending to succeed.
 */
export const DEMO_API_STORE_KEY = 'darschin_browser_mock_pilot_v2';
const now = () => new Date().toISOString();
type Row = Record<string, any>;
interface DemoStore {
  collections: Record<string, Row[]>;
  profile: StudentAcademicProfile;
  plan: { selectedOfferingIds: string[]; coursePriorities: string[]; offeringPriorities: Record<string, string[]> };
  passed: Row[];
  tickets: Row[];
  messages: Row[];
  bugs: Row[];
  teacherRatings: TeacherRating[];
  importBatches: Row[];
  importRecords: Row[];
  academicSettings: AcademicPolicySettings;
}
const semester = { id: 'demo-term', name: 'نیمسال فرضی برای تست', year: 1405, termNumber: 1, isCurrent: true, active: true };
const university = { id: 'demo-university', name: 'دانشگاه آزاد اسلامی (محیط آزمایشی)', code: 'DEMO-U', active: true };
const province = { id: 'demo-province', name: 'استان تهران', active: true };
const campus = { id: 'demo-campus', universityId: university.id, provinceId: province.id, type: 'INDEPENDENT_UNIT', name: 'واحد علوم و تحقیقات (دمو)', code: 'DEMO-C', active: true };
const degree = { id: 'demo-degree', name: 'کارشناسی پیوسته (دمو)', code: 'DEMO-BE', active: true };
const major = { id: 'demo-major', degreeLevelId: degree.id, name: 'مهندسی برق (پایلوت آزمایشی)', code: 'DEMO-EE', active: true };
const entryYear = { id: 'demo-entry', year: 1403, active: true };
const curriculum = { id: 'demo-curriculum', universityId: university.id, campusId: campus.id, degreeLevelId: degree.id, majorId: major.id, entryYearId: entryYear.id, version: 'demo-1', name: 'چارت آزمایشی کارشناسی برق، غیرمصوب', status: 'active', createdAt: now() };
const sampleCourses: Course[] = DEMO_COURSES.map((c) => ({
  id: c.id, code: c.code, name: c.name, units: c.units,
  category: c.units === 1 ? 'آزمایشگاه' : 'اصلی', active: true,
}));
const sampleOfferings: CourseOffering[] = DEMO_COURSES.map((c) => ({
  id: 'off-' + c.id, termId: semester.id, campusId: campus.id,
  courseId: c.id, groupCode: '01', instructor: c.instructor, dayOfWeek: c.day,
  startTime: c.start, endTime: c.end, capacity: 40, enrolledCount: 16, source: 'manual', active: true,
}));
// Second synthetic class for demonstrating comparison of teachers within one course.
sampleOfferings.push({
  id: 'off-math2-alt', termId: semester.id, campusId: campus.id,
  courseId: 'math2', groupCode: '02', instructor: 'استاد نمونه جایگزین',
  dayOfWeek: 'دوشنبه', startTime: '08:00', endTime: '10:00',
  capacity: 35, enrolledCount: 10, source: 'manual', active: true,
});
const sampleRatings: TeacherRating[] = sampleOfferings.flatMap((o, idx) =>
  [1, 2, 3].map((n) => ({
    reviewerId: `synthetic-reviewer-${n}-${o.courseId}-${o.instructor}`,
    courseId: o.courseId, instructor: o.instructor,
    scores: {
      teachingClarity: Math.min(5, 3 + ((idx + n) % 3)),
      courseOrganization: 4, assessmentFairness: idx % 2 ? 3 : 4,
      studentSupport: 4,
    },
  })),
);
const defaults: AcademicPolicySettings = {
  normalMinUnits: 12, normalMaxUnits: 20, gpaBonusThreshold: 17, gpaBonusMaxUnits: 24,
  summerMinUnits: 1, summerMaxUnits: 8, finalSemesterMaxUnits: 24,
  finalSemesterThresholdUnits: 24, finalSemesterRuleEnabled: true,
};
function initialStore(): DemoStore {
  // Clone fixtures per reset; otherwise add/delete operations mutate the module-level
  // sample arrays and corrupt all subsequent demo sessions.
  return structuredClone({
    collections: {
      '/api/academic/universities': [university],
      '/api/academic/provinces': [province],
      '/api/academic/campuses': [campus],
      '/api/academic/degrees': [degree],
      '/api/academic/majors': [major],
      '/api/academic/tracks': [],
      '/api/academic/entry-years': [entryYear],
      '/api/academic/terms': [semester],
      '/api/academic/courses': sampleCourses,
      '/api/offerings': sampleOfferings,
      '/api/curriculum': [curriculum],
      '/api/curriculum/rules': [],
      '/api/curriculum-courses': [],
      '/api/admin/users': [{ id: 'demo-student', name: 'دانشجوی نمونه', mobile: 'شمارهٔ ساختگی', roles: ['student'] }],
    },
    profile: {
      userId: 'demo-student', universityId: university.id, provinceId: province.id,
      campusId: campus.id, degreeLevelId: degree.id, majorId: major.id,
      entryYearId: entryYear.id, isTrackSelected: false, desiredTrackIds: [],
      currentTermId: semester.id, previousTermGpa: null, updatedAt: now(),
    },
    plan: { selectedOfferingIds: ['off-math2', 'off-physics'], coursePriorities: [], offeringPriorities: {} },
    passed: [],
    tickets: [{
      id: 'demo-ticket-1', userId: 'demo-student',
      subject: 'نمونه تیکت برای تست گردش پاسخ‌گویی',
      status: 'OPEN', createdAt: '2026-10-25T00:00:00.000Z', updatedAt: '2026-10-25T00:00:00.000Z',
    }],
    messages: [],
    bugs: [{
      id: 'demo-bug-1', userId: 'demo-student',
      title: 'نمونه گزارش باگ دمو', category: 'UI', severity: 'LOW',
      description: 'این مورد کاملاً ساختگی است و فقط برای آزمایش پنل مدیریت ایجاد شده است.',
      pageContext: '/demo/student', status: 'OPEN', createdAt: '2026-10-25T00:00:00.000Z',
    }],
    teacherRatings: sampleRatings,
    importBatches: [],
    importRecords: [],
    academicSettings: { ...defaults },
  }) as DemoStore;
}
let volatileStore: DemoStore | undefined;
function readStore(): DemoStore {
  try {
    const raw = localStorage.getItem(DEMO_API_STORE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && obj.collections &&
          typeof obj.collections === 'object' && Array.isArray(obj.passed) &&
          Array.isArray(obj.tickets) && obj.plan && obj.profile) {
        // Upgrade older browser-only demo sessions without touching real users.
        if (!Array.isArray(obj.teacherRatings)) obj.teacherRatings = structuredClone(sampleRatings);
        if (!Array.isArray(obj.collections['/api/curriculum-courses'])) obj.collections['/api/curriculum-courses'] = [];
        if (!Array.isArray(obj.importBatches)) obj.importBatches = [];
        if (!Array.isArray(obj.importRecords)) obj.importRecords = [];
        return obj as DemoStore;
      }
    }
  } catch { /* unavailable local storage */ }
  return volatileStore ?? initialStore();
}
function saveStore(store: DemoStore) {
  volatileStore = store;
  try { localStorage.setItem(DEMO_API_STORE_KEY, JSON.stringify(store)); }
  catch { /* continue with a volatile session */ }
}
export function resetBrowserDemo() {
  volatileStore = initialStore();
  try { localStorage.removeItem(DEMO_API_STORE_KEY); } catch { /* private mode */ }
}
function good<T>(data: T): ApiResponse<T> { return { success: true, data }; }
function fail(error: string): ApiResponse<any> { return { success: false, error }; }
function bodyJson(options: RequestInit): Record<string, any> {
  if (typeof options.body !== 'string') return {};
  try { const obj = JSON.parse(options.body); return obj && typeof obj === 'object' ? obj : {}; }
  catch { return {}; }
}
function currentCourses(s: DemoStore): Course[] {
  return (s.collections['/api/academic/courses'] || []) as Course[];
}

function currentOfferings(s: DemoStore): CourseOffering[] {
  return (s.collections['/api/offerings'] || []) as CourseOffering[];
}

function isUsableOffering(s: DemoStore, offeringId: unknown): boolean {
  if (typeof offeringId !== 'string') return false;
  const offering = currentOfferings(s).find(o => o.id === offeringId && o.active !== false);
  return Boolean(offering && currentCourses(s).some(c => c.id === offering.courseId && c.active !== false));
}

/** Keep the local student plan coherent after demo admin disables/deletes offerings. */
function cleanDemoPlan(s: DemoStore): void {
  const valid = (ids: unknown): string[] =>
    Array.isArray(ids) ? [...new Set(ids.filter(id => isUsableOffering(s, id)))] : [];

  s.plan.selectedOfferingIds = valid(s.plan.selectedOfferingIds);
  s.plan.offeringPriorities = Object.fromEntries(
    Object.entries(s.plan.offeringPriorities || {})
      .map(([courseId, ids]) => [courseId, valid(ids)] as const)
      .filter(([courseId, ids]) => ids.length > 0 && currentCourses(s).some(c => c.id === courseId && c.active !== false)),
  );
  s.plan.coursePriorities = (s.plan.coursePriorities || []).filter(
    courseId => currentCourses(s).some(c => c.id === courseId && c.active !== false),
  );
}

function academicLimits(s: DemoStore): AcademicLimitInfo {
  const courses = currentCourses(s);
  const total = courses.reduce((n, c) => n + c.units, 0);
  const passed = s.passed.reduce((n, p) => n + (courses.find(c => c.id === p.courseId)?.units || 0), 0);
  return {
    ...defaults, effectiveMinUnits: 0, effectiveMaxUnits: 99,
    isFinalSemester: false, isGradeA: false, isSummer: false,
    totalCurriculumUnits: total, passedUnits: passed, remainingUnits: total - passed,
    remainingCoursesCount: Math.max(0, courses.length - s.passed.length),
    policySettings: { ...s.academicSettings }, majorRequiredPassed: passed,
    majorRequiredRemaining: total - passed, trackRequiredPassed: 0,
    trackRequiredRemaining: 0, electivesPassed: 0, electivesRemaining: 0,
  };
}
function demoEvaluation(s: DemoStore) {
  const courses = currentCourses(s);
  const offerings = currentOfferings(s);
  // In demo ALL visible offerings are previewable, regardless of university rules.
  const results: CourseEligibilityResult[] = offerings.filter(o => isUsableOffering(s, o.id)).map(o => {
    const c = courses.find(course => course.id === o.courseId);
    return {
      offeringId: o.id, courseId: o.courseId, courseCode: c?.code || 'DEMO',
      courseName: o.rawCourseName?.trim() || c?.name || 'درس نمونه', units: c?.units || 0, category: c?.category || 'سایر',
      groupCode: o.groupCode, instructor: o.instructor, dayOfWeek: o.dayOfWeek,
      startTime: o.startTime, endTime: o.endTime, capacity: o.capacity,
      enrolledCount: o.enrolledCount, enrolledCountKnown: o.enrolledCountKnown, examDate: o.examDate,
      overallStatus: 'AVAILABLE', isEligible: true, canSelect: true,
      primaryReason: 'فقط دادهٔ ساختگی دمو؛ بررسی آموزشی انجام نشده است.',
      allReasons: ['فقط دادهٔ ساختگی دمو؛ بررسی آموزشی انجام نشده است.'],
      missingPrerequisites: [], missingCorequisites: [], warnings: ['این نتیجه صرفاً برای آزمایش ظاهر سامانه است.'],
    };
  });
  return {
    report: {
      studentId: s.profile.userId, termId: semester.id, curriculumId: curriculum.id,
      totalOfferingsEvaluated: results.length, eligibleCount: results.length, blockedCount: 0,
      alreadyPassedCount: 0, needsReviewCount: 0, results, evaluatedAt: now(),
    },
    recommendations: results.map((r,i) => ({
      courseId: r.courseId, offeringId: r.offeringId, courseCode: r.courseCode,
      courseName: r.courseName, units: r.units, category: r.category, score: 80-i,
      suggestedSemester: 3, unlockedFutureCoursesCount: 0, unlockedCourseNames: [],
      reasons: ['پیشنهاد صرفاً نمونه؛ موتور قوانین دانشگاه اجرا نشده است.'], priority: 'MEDIUM',
    })),
    academicLimits: academicLimits(s),
    context: { profile: s.profile, curriculum, term: semester, campus, major, tracks: [] },
  };
}
function collectionRoute(endpoint: string) {
  const keys = ['/api/academic/universities', '/api/academic/provinces', '/api/academic/campuses',
    '/api/academic/degrees', '/api/academic/majors', '/api/academic/tracks',
    '/api/academic/entry-years', '/api/academic/terms', '/api/academic/courses',
    '/api/offerings', '/api/curriculum/rules', '/api/curriculum', '/api/admin/users'];
  const key = keys.find(k => endpoint === k || endpoint.startsWith(k + '/'));
  return key ? { key, id: endpoint === key ? null : endpoint.slice(key.length + 1).split('/')[0] } : null;
}
function id() { return 'demo-' + Math.random().toString(36).slice(2,10); }

export async function browserDemoRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  // No request is sent over network. This adapter is never used outside /demo routes.
  const s = readStore(), method = (options.method || 'GET').toUpperCase();
  const path = endpoint.split('?')[0], data = bodyJson(options);
  if (!path.startsWith('/api/')) return fail('مسیر دمو نامعتبر است.');

  if (path === '/api/demo/teacher-ratings') {
    const courseId = new URL(endpoint, 'https://demo.invalid').searchParams.get('courseId');
    if (method === 'GET') {
      if (!courseId) return fail('شناسه درس مشخص نشده است.');
      const instructors = (s.collections['/api/offerings'] || [])
        .filter(o => o.courseId === courseId && o.active)
        .map(o => String(o.instructor || ''));
      return good(summarizeCourseTeachers(courseId, instructors, s.teacherRatings || [])) as ApiResponse<T>;
    }
    if (method === 'PUT') {
      const courseId = data.courseId, instructor = data.instructor;
      if (typeof courseId !== 'string' || typeof instructor !== 'string' || !courseId || !instructor || !validRatingScores(data.scores)
        || Object.keys(data).some(key => !['courseId', 'instructor', 'scores'].includes(key))) {
        return fail('فقط چهار امتیاز صحیح بین ۱ تا ۵ برای استاد و درس مجاز است؛ نظر متنی پذیرفته نمی‌شود.');
      }
      const offeringExists = (s.collections['/api/offerings'] || [])
        .some(o => o.active && o.courseId === courseId && o.instructor === instructor);
      if (!offeringExists) return fail('این استاد در گروه‌های فعال درس نمونه وجود ندارد.');
      s.teacherRatings ||= [];
      s.teacherRatings = s.teacherRatings.filter(r => !(r.courseId === courseId && r.instructor === instructor && r.reviewerId === 'demo-student'));
      s.teacherRatings.push({ reviewerId: 'demo-student', courseId, instructor, scores: data.scores });
      saveStore(s);
      return good(summarizeCourseTeachers(courseId,
        (s.collections['/api/offerings'] || []).filter(o => o.courseId === courseId && o.active).map(o => String(o.instructor || '')),
        s.teacherRatings)) as ApiResponse<T>;
    }
    return fail('درخواست ارزشیابی دمو پشتیبانی نمی‌شود.');
  }
  if (path === '/api/student/profile') {
    if (method === 'GET') return good({ profile: s.profile }) as ApiResponse<T>;
    if (method === 'PUT') { s.profile = { ...s.profile, ...data, userId: 'demo-student', updatedAt: now() }; saveStore(s); return good(s.profile) as ApiResponse<T>; }
  }
  if (path === '/api/academic/all-meta' && method === 'GET') {
    return good({
      universities: s.collections['/api/academic/universities'],
      provinces: s.collections['/api/academic/provinces'],
      campuses: s.collections['/api/academic/campuses'],
      degreeLevels: s.collections['/api/academic/degrees'],
      majors: s.collections['/api/academic/majors'],
      tracks: s.collections['/api/academic/tracks'],
      entryYears: s.collections['/api/academic/entry-years'],
      academicTerms: s.collections['/api/academic/terms'],
    }) as ApiResponse<T>;
  }
  if (path === '/api/eligibility/evaluate' && method === 'POST') return good(demoEvaluation(s)) as ApiResponse<T>;
  if (path === '/api/student/plan') {
    if (method === 'GET') {
      cleanDemoPlan(s);
      return good(s.plan) as ApiResponse<T>;
    }
    if (method === 'PUT') {
      if (data.selectedOfferingIds !== undefined &&
        (!Array.isArray(data.selectedOfferingIds) || data.selectedOfferingIds.some((id: unknown) => !isUsableOffering(s, id)))) {
        return fail('یکی از گروه‌های انتخاب‌شده دیگر در دمو فعال یا موجود نیست.');
      }
      s.plan = {
        ...s.plan, ...data,
        selectedOfferingIds: Array.isArray(data.selectedOfferingIds) ? [...new Set(data.selectedOfferingIds)] : s.plan.selectedOfferingIds,
      };
      cleanDemoPlan(s);
      saveStore(s);
      return good(s.plan) as ApiResponse<T>;
    }
  }
  if (path === '/api/student/plan/select' && method === 'POST') {
    if (typeof data.offeringId !== 'string' || !['add', 'remove'].includes(data.action)) {
      return fail('درخواست تغییر برنامهٔ دمو معتبر نیست.');
    }
    if (data.action === 'add' && !isUsableOffering(s, data.offeringId)) {
      return fail('این گروه درسی در داده‌های فعلی دمو موجود یا فعال نیست.');
    }
    const old = s.plan.selectedOfferingIds;
    s.plan.selectedOfferingIds = data.action === 'remove' ? old.filter(x=>x !== data.offeringId)
      : [...new Set([...old, data.offeringId])];
    cleanDemoPlan(s);
    saveStore(s);
    return good(s.plan) as ApiResponse<T>;
  }
  if (path === '/api/student/passed-courses' && method === 'GET') {
    const enriched = s.passed.map(row => ({ ...row, course: s.collections['/api/academic/courses'].find(c => c.id === row.courseId) }));
    const totalUnits = enriched.reduce((n,r) => n + (r.course?.units||0), 0);
    const categorySummary: Record<string,number> = {};
    enriched.forEach(r=>{if (r.course) categorySummary[r.course.category] = (categorySummary[r.course.category]||0)+r.course.units;});
    return good({ passedCourses: enriched, totalUnits, categorySummary }) as ApiResponse<T>;
  }
  if (path === '/api/student/passed-courses' && method === 'POST') {
    if (!currentCourses(s).some(c=>c.id === data.courseId)) return fail('این درس در بانک فعلی دمو نیست.');
    if (s.passed.some(p=>p.courseId===data.courseId)) return fail('این درس قبلاً اضافه شده است.');
    s.passed.push({id:id(),userId:'demo-student',courseId:data.courseId,grade:data.grade,status:'PASSED',passedAt:now()});
    saveStore(s);return good(s.passed.at(-1)) as ApiResponse<T>;
  }
  if (path === '/api/student/passed-courses/batch' && method === 'POST') {
    const ids = Array.isArray(data.courseIds) ? data.courseIds : [];
    let addedCount=0;
    for(const courseId of ids){if(currentCourses(s).some(c=>c.id===courseId)&&!s.passed.some(p=>p.courseId===courseId)){s.passed.push({id:id(),userId:'demo-student',courseId,status:'PASSED',passedAt:now()});addedCount++;}}
    saveStore(s);return good({addedCount,totalPassed:s.passed.length}) as ApiResponse<T>;
  }
  if (path.startsWith('/api/student/passed-courses/') && method === 'DELETE') {
    s.passed=s.passed.filter(p=>p.id!==path.split('/').at(-1));saveStore(s);return good({}) as ApiResponse<T>;
  }
  if (path === '/api/admin/stats' && method === 'GET') return good({
    totalUsers: 1,totalStudents: 1,totalUniversities: 1,totalProvinces: s.collections['/api/academic/provinces'].length,
    totalCampuses: s.collections['/api/academic/campuses'].length,totalDegreeLevels: 1,totalMajors: 1,
    totalTracks: 0,totalCurricula: s.collections['/api/curriculum'].length,totalCourses: s.collections['/api/academic/courses'].length,
  }) as ApiResponse<T>;
  if (path === '/api/admin/academic-settings') {
    if (method === 'GET') return good(s.academicSettings) as ApiResponse<T>;
    if (method === 'PUT') {s.academicSettings={...s.academicSettings,...data};saveStore(s);return good(s.academicSettings) as ApiResponse<T>;}
  }
  if (path === '/api/admin/students-overview' && method === 'GET') return good([]) as ApiResponse<T>;
  if (path === '/api/admin/diagnostics' && method === 'GET') return fail('سرور واقعی در محیط دمو وجود ندارد؛ عیب‌یابی سرور شبیه‌سازی نشده است.');
  if ((path === '/api/admin/audit-logs' || path === '/api/admin/error-logs') && method === 'GET') return good([]) as ApiResponse<T>;
  if (path === '/api/sync/jobs' && method === 'GET') return good([]) as ApiResponse<T>;
  // Browser-only upload preview: never modifies canonical offerings.
  if (path === '/api/imports/process' && method === 'POST') {
    const batchId = id();
    const review = processImportPayload(data.payload, batchId, semester.id, campus.id, currentCourses(s));
    if (!review.totalRecords) return fail(review.errors.join(' | ') || 'هیچ داده‌ای در فایل نمونه پیدا نشد.');
    const batch = {
      id: batchId, userId: 'demo-student', termId: semester.id, source: 'extension',
      schemaVersion: '1.0', totalRecords: review.totalRecords, matchedRecords: review.matchedCount,
      reviewRecords: review.reviewCount, invalidRecords: review.invalidCount, createdAt: now(),
    };
    s.importBatches ||= [];
    s.importRecords ||= [];
    s.importBatches.unshift(batch);
    s.importRecords.push(...review.importRecords);
    saveStore(s);
    return good({
      batch, records: review.importRecords,
      summary: { total: review.totalRecords, matched: review.matchedCount, review: review.reviewCount,
        invalid: review.invalidCount },
      createdOfferingsCount: 0, requiresReview: true,
      message: 'بسته نمونه ذخیره شد؛ هیچ گروه درسی واقعی یا ساختگی به فهرست ارائه‌های اصلی افزوده نشد.',
    }) as ApiResponse<T>;
  }
  if (path === '/api/imports/batches' && method === 'GET') return good(s.importBatches || []) as ApiResponse<T>;
  if (path.startsWith('/api/imports/batches/') && method === 'GET') {
    const id = path.split('/').at(-1);
    const batch = (s.importBatches || []).find(row => row.id === id);
    if (!batch) return fail('بسته آزمایشی یافت نشد.');
    return good({ batch, records: (s.importRecords || []).filter(row => row.batchId === id) }) as ApiResponse<T>;
  }
  const importReviewRoute = path.match(/^\/api\/imports\/batches\/([^/]+)\/records\/([^/]+)\/review$/);
  if (importReviewRoute && method === 'PUT') {
    const batch = (s.importBatches || []).find(item => item.id === importReviewRoute[1]);
    const record = (s.importRecords || []).find(item => item.batchId === batch?.id && item.id === importReviewRoute[2]);
    if (!batch || !record) return fail('ردیف مربوط به این بسته در دمو پیدا نشد.');
    const validKeys = data.action === 'CONFIRM_MATCH'
      ? ['action', 'courseId', 'reason'] : ['action', 'reason'];
    if (!['CONFIRM_MATCH', 'REJECT_MATCH'].includes(data.action) ||
        Object.keys(data).some(key => !validKeys.includes(key)) ||
        typeof data.reason !== 'string' || data.reason.trim().length < 10 ||
        data.reason.trim().length > 500) {
      return fail('درخواست بررسی باید دارای دلیل معتبر و بدون فیلد اضافی باشد.');
    }
    if (data.action === 'CONFIRM_MATCH' && !currentCourses(s)
      .some(course => course.id === data.courseId && course.active !== false)) {
      return fail('درس مقصد معتبر در کاتالوگ دمو یافت نشد.');
    }
    record.reviewDecision = data.action === 'CONFIRM_MATCH' ? 'COURSE_MATCH_CONFIRMED' : 'REJECTED';
    record.matchedCourseId = data.action === 'CONFIRM_MATCH' ? data.courseId : null;
    record.reviewNotes = data.reason.trim();
    record.reviewedBy = 'demo-manager';
    record.reviewedAt = now();
    saveStore(s);
    return good(record) as ApiResponse<T>;
  }
  if (path === '/api/support/tickets') {
    if(method==='GET') return good(s.tickets) as ApiResponse<T>;
    if(method==='POST'){const t={id:id(),userId:'demo-student',subject:String(data.subject||'درخواست دمو'),status:'OPEN',createdAt:now(),updatedAt:now()};s.tickets.push(t);saveStore(s);return good(t) as ApiResponse<T>;}
  }
  if (path.match(/^\/api\/support\/tickets\/[^/]+\/messages$/)) {
    const ticketId=path.split('/')[4];
    if(method==='GET') return good(s.messages.filter(m=>m.ticketId===ticketId)) as ApiResponse<T>;
    if(method==='POST'){const m={id:id(),ticketId,senderId:'demo-student',content:String(data.content||''),createdAt:now()};s.messages.push(m);saveStore(s);return good(m) as ApiResponse<T>;}
  }
  if (path === '/api/support/bugs') {
    if(method==='GET') return good(s.bugs) as ApiResponse<T>;
    if(method==='POST'){const bug={...data,id:id(),userId:'demo-student',status:'OPEN',createdAt:now()};s.bugs.push(bug);saveStore(s);return good(bug) as ApiResponse<T>;}
  }
  // Exercise exactly the status workflows shown by the real admin component.
  // This is an in-browser simulation, never a privileged server operation.
  const statusParts = path.split('/');
  const statusRoute = statusParts.length === 7 &&
    statusParts[1] === 'api' && statusParts[2] === 'support' &&
    statusParts[3] === 'admin' && ['tickets', 'bugs'].includes(statusParts[4]) &&
    statusParts[6] === 'status';
  if (statusRoute && method === 'PUT') {
    const kind = statusParts[4];
    const recordId = statusParts[5];
    const allowed = kind === 'tickets'
      ? ['OPEN', 'IN_PROGRESS', 'ANSWERED', 'CLOSED']
      : ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!allowed.includes(data.status)) return fail('وضعیت در این گردش پشتیبانی معتبر نیست.');
    const records = kind === 'tickets' ? s.tickets : s.bugs;
    const item = records.find(record => record.id === recordId);
    if (!item) return fail('رکورد ساختگی پیدا نشد.');
    item.status = data.status;
    if (kind === 'tickets') item.updatedAt = now();
    saveStore(s);
    return good(item) as ApiResponse<T>;
  }
  if (path === '/api/support/admin/tickets' && method === 'GET') return good(s.tickets) as ApiResponse<T>;
  if (path === '/api/support/admin/bugs' && method === 'GET') return good(s.bugs) as ApiResponse<T>;
  // Draft-only mock curriculum editor: changes are local and have NO effect
  // on demo eligibility or any actual academic regulations.
  if (path === '/api/curriculum') {
    if (method === 'GET') return good(s.collections['/api/curriculum']) as ApiResponse<T>;
    if (method === 'POST') {
      const required = ['universityId', 'campusId', 'degreeLevelId', 'majorId', 'entryYearId', 'name'];
      if (data.status !== 'draft' || required.some(key => typeof data[key] !== 'string' || !data[key].trim())) {
        return fail('چارت دمو فقط به صورت پیش‌نویس و با مشخصات کامل ساخته می‌شود.');
      }
      const found = (key: string, value: string) => (s.collections[key] || []).find(row => row.id === value);
      const match = found('/api/academic/campuses', data.campusId)?.universityId === data.universityId &&
        found('/api/academic/majors', data.majorId)?.degreeLevelId === data.degreeLevelId &&
        Boolean(found('/api/academic/degrees', data.degreeLevelId)) &&
        Boolean(found('/api/academic/entry-years', data.entryYearId)) &&
        Boolean(found('/api/academic/universities', data.universityId));
      if (!match) return fail('ترکیب واحد، رشته، مقطع و ورودی در دمو معتبر نیست.');
      const version = typeof data.version === 'string' && data.version.trim() ? data.version.trim() : 'draft-1';
      if (s.collections['/api/curriculum'].some(row => row.campusId === data.campusId &&
        row.majorId === data.majorId && row.entryYearId === data.entryYearId && row.degreeLevelId === data.degreeLevelId &&
        row.version === version)) return fail('نسخه تکراری چارت آزمایشی.');
      const row = { ...data, id: id(), version, status: 'draft', createdAt: now() };
      s.collections['/api/curriculum'].push(row);
      saveStore(s);
      return good(row) as ApiResponse<T>;
    }
  }
  const fullChartMatch = path.match(/^\/api\/curriculum\/([^/]+)\/full$/);
  if (fullChartMatch && method === 'GET') {
    const chart = s.collections['/api/curriculum'].find(row => row.id === fullChartMatch[1]);
    if (!chart) return fail('چارت نمونه یافت نشد.');
    const linked = (s.collections['/api/curriculum-courses'] || [])
      .filter(row => row.curriculumId === chart.id)
      .map(row => ({ ...row, course: currentCourses(s).find(course => course.id === row.courseId) }));
    const rules = (s.collections['/api/curriculum/rules'] || []).filter(row => row.curriculumId === chart.id);
    return good({ curriculum: chart, courses: linked,
      prerequisites: rules.filter(rule => rule.relationshipType === 'PREREQUISITE'),
      corequisites: rules.filter(rule => rule.relationshipType === 'COREQUISITE') }) as ApiResponse<T>;
  }
  const chartCourseMatch = path.match(/^\/api\/curriculum\/([^/]+)\/courses(?:\/([^/]+))?$/);
  if (chartCourseMatch) {
    const chart = s.collections['/api/curriculum'].find(row => row.id === chartCourseMatch[1]);
    if (!chart) return fail('چارت نمونه یافت نشد.');
    s.collections['/api/curriculum-courses'] ||= [];
    const rows = s.collections['/api/curriculum-courses'];
    if (method === 'GET') return good(rows.filter(row => row.curriculumId === chart.id)) as ApiResponse<T>;
    if (chart.status !== 'draft') return fail('فقط چارت پیش‌نویس نمونه قابل ویرایش است.');
    if (method === 'POST') {
      if (!currentCourses(s).some(course => course.id === data.courseId) ||
          !['MAJOR_REQUIRED', 'MAJOR_ELECTIVE', 'TRACK_REQUIRED', 'TRACK_ELECTIVE'].includes(data.classification) ||
          (data.trackId && !(s.collections['/api/academic/tracks'] || []).some(track => track.id === data.trackId && track.majorId === chart.majorId)) ||
          rows.some(row => row.curriculumId === chart.id && row.courseId === data.courseId && (row.trackId || '') === (data.trackId || ''))) {
        return fail('درس، گرایش یا رابطه تکراری این پیش‌نویس نامعتبر است.');
      }
      const row = { id: id(), curriculumId: chart.id, courseId: data.courseId,
        trackId: data.trackId || null, classification: data.classification,
        suggestedSemester: Number(data.suggestedSemester || 1), active: true };
      rows.push(row); saveStore(s); return good(row) as ApiResponse<T>;
    }
    if (method === 'DELETE' && chartCourseMatch[2]) {
      const courseId = chartCourseMatch[2];
      if (!rows.some(row => row.curriculumId === chart.id && row.courseId === courseId)) return fail('درس در چارت پیدا نشد.');
      s.collections['/api/curriculum-courses'] = rows.filter(row => !(row.curriculumId === chart.id && row.courseId === courseId));
      s.collections['/api/curriculum/rules'] = (s.collections['/api/curriculum/rules'] || [])
        .filter(rule => !(rule.curriculumId === chart.id && (rule.targetCourseId === courseId ||
          extractSourceCourseIds(rule.expression).includes(courseId))));
      saveStore(s);
      return good({}) as ApiResponse<T>;
    }
  }
  if (path === '/api/curriculum/rules' && method === 'POST') {
    const chart = s.collections['/api/curriculum'].find(row => row.id === data.curriculumId);
    if (!chart || chart.status !== 'draft' ||
        !['PREREQUISITE', 'COREQUISITE'].includes(data.relationshipType) ||
        typeof data.targetCourseId !== 'string' || !currentCourses(s).some(course => course.id === data.targetCourseId) ||
        !data.expression || !['COURSE', 'GROUP'].includes(data.expression.type)) {
      return fail('تعریف رابطه صرفاً برای چارت پیشنویس با درس مقصد و ساختار معتبر مجاز است.');
    }
    const sources = extractSourceCourseIds(data.expression);
    const assigned = new Set((s.collections['/api/curriculum-courses'] || [])
      .filter(row => row.curriculumId === chart.id).map(row => row.courseId));
    if (!assigned.has(data.targetCourseId) || !sources.length ||
        sources.some(source => !assigned.has(source))) {
      return fail('درس مقصد و تمام پیش‌نیازها/هم‌نیازها باید ابتدا در همین پیش‌نویس چارت ثبت شده باشند.');
    }
    s.collections['/api/curriculum/rules'] ||= [];
    const existingRules = s.collections['/api/curriculum/rules'] as AcademicRule[];
    if (data.relationshipType === 'PREREQUISITE' &&
        createsPrerequisiteCycle(chart.id, data.targetCourseId, data.expression, existingRules)) {
      return fail('رابطه پیش‌نیاز چرخه ایجاد می‌کند.');
    }
    const row = { id: id(), curriculumId: chart.id, targetCourseId: data.targetCourseId,
      relationshipType: data.relationshipType, expression: data.expression, notes: 'صرفاً آزمایشی — تأییدنشده' };
    existingRules.push(row); saveStore(s); return good(row) as ApiResponse<T>;
  }
  const removeRuleMatch = path.match(/^\/api\/curriculum\/rules\/([^/]+)$/);
  if (removeRuleMatch && method === 'DELETE') {
    const rules = s.collections['/api/curriculum/rules'] || [];
    const rule = rules.find(row => row.id === removeRuleMatch[1]);
    const chart = s.collections['/api/curriculum'].find(row => row.id === rule?.curriculumId);
    if (!rule || chart?.status !== 'draft') return fail('رابطه در پیش‌نویس یافت نشد.');
    s.collections['/api/curriculum/rules'] = rules.filter(row => row.id !== rule.id);
    saveStore(s); return good({}) as ApiResponse<T>;
  }
  const route=collectionRoute(path);
  if (route) {
    const rows=s.collections[route.key]||[];
    if(method==='GET') return good(route.id ? rows.find(row=>row.id===route.id)||null : rows) as ApiResponse<T>;
    if(route.key === '/api/curriculum/rules' || route.key === '/api/curriculum') {
      return fail('ویرایش چارت و قوانین دانشگاهی در دمو غیرفعال است.');
    }
    // Referential checks are intentionally scoped to the academic demo records.
    // Real authorization and official eligibility policy remain server responsibilities.
    const isCourse = route.key === '/api/academic/courses';
    const isOffering = route.key === '/api/offerings';
    if (method === 'POST' || method === 'PUT') {
      if (isCourse) {
        const name = data.name ?? (route.id ? rows.find(row => row.id === route.id)?.name : undefined);
        const code = data.code ?? (route.id ? rows.find(row => row.id === route.id)?.code : undefined);
        const units = data.units ?? (route.id ? rows.find(row => row.id === route.id)?.units : undefined);
        if (typeof name !== 'string' || !name.trim() || typeof code !== 'string' || !code.trim() ||
          typeof units !== 'number' || !Number.isFinite(units) || units < 0) {
          return fail('عنوان، کد و تعداد واحد معتبر برای درس نمونه الزامی‌اند.');
        }
        if (rows.some(row => row.code === code && row.id !== route.id)) return fail('کد درس نمونه تکراری است.');
      }
      if (isOffering) {
        const previous = route.id ? rows.find(row => row.id === route.id) : null;
        const draft = { ...(previous || {}), ...data };
        const linkedCourseId = draft.courseId;
        if (!currentCourses(s).some(course => course.id === linkedCourseId && course.active !== false) ||
            !(s.collections['/api/academic/terms'] || []).some(term => term.id === (draft.termId || semester.id)) ||
            !(s.collections['/api/academic/campuses'] || []).some(c => c.id === (draft.campusId || campus.id))) {
          return fail('درس فعال، نیمسال و واحد نمونه باید از فهرست معتبر دمو انتخاب شوند.');
        }
        const start = String(draft.startTime ?? '').trim();
        const end = String(draft.endTime ?? '').trim();
        const toMinute = (value: string): number | null => {
          const ascii = value.replace(/[۰-۹]/g, ch => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
            .replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)));
          const match = /^(\d{1,2}):(\d{2})$/.exec(ascii);
          if (!match) return null;
          const hour = Number(match[1]), minute = Number(match[2]);
          return hour < 24 && minute < 60 ? hour * 60 + minute : null;
        };
        if (Boolean(start) !== Boolean(end) ||
            (start && (toMinute(start) === null || toMinute(end) === null ||
              toMinute(start)! >= toMinute(end)!))) {
          return fail('ساعت شروع و پایان را هر دو معتبر وارد کنید، یا هر دو خالی بگذارید.');
        }
        const capacity = Number(draft.capacity === '' || draft.capacity === undefined ? 40 : draft.capacity);
        const enrolled = Number(draft.enrolledCount === '' || draft.enrolledCount === undefined ? 0 : draft.enrolledCount);
        if (!Number.isSafeInteger(capacity) || capacity < 1 ||
            !Number.isSafeInteger(enrolled) || enrolled < 0 || enrolled > capacity) {
          return fail('ظرفیت گروه در دمو باید مثبت و تعداد ثبت‌نامی بین صفر و ظرفیت باشد.');
        }
        // Normalize only an explicitly provided valid clock; leave unspecified
        // times empty for the unscheduled-class review list.
        const formatted = (value: string) => {
          const minute = toMinute(value);
          return minute === null ? '' : String(Math.floor(minute / 60)).padStart(2, '0') +
            ':' + String(minute % 60).padStart(2, '0');
        };
        data.startTime = start ? formatted(start) : '';
        data.endTime = end ? formatted(end) : '';
        data.dayOfWeek = typeof draft.dayOfWeek === 'string' ? draft.dayOfWeek : '';
        data.capacity = capacity;
        data.enrolledCount = enrolled;
        data.enrolledCountKnown = draft.enrolledCountKnown === false ? false :
          draft.enrolledCountKnown === true || (draft.enrolledCount !== undefined && draft.enrolledCount !== '');
      }
    }
    if(method==='POST'){
      const row: Row={...data,id:id(),active:data.active!==false};
      if(isOffering){
        row.termId ??= semester.id;
        row.campusId ??= campus.id;
        row.source ??= 'manual';
        row.enrolledCount ??= 0;
        row.enrolledCountKnown ??= false;
        row.capacity ??= 40;
      }
      rows.push(row);s.collections[route.key]=rows;saveStore(s);return good(row) as ApiResponse<T>;
    }
    if(method==='PUT' && route.id){
      const idx=rows.findIndex(row=>row.id===route.id);
      if(idx<0)return fail('رکورد دمو یافت نشد.');
      const updated: Row={...rows[idx],...data,id:route.id};

      rows[idx]=updated;
      if (isCourse || isOffering) cleanDemoPlan(s);
      saveStore(s);
      return good(rows[idx]) as ApiResponse<T>;
    }
    if(method==='DELETE' && route.id){
      if (!rows.some(row => row.id === route.id)) return fail('رکورد دمو برای حذف پیدا نشد.');
      if (isCourse && (currentOfferings(s).some(o => o.courseId === route.id) || s.passed.some(p => p.courseId === route.id))) {
        return fail('این درس در گروه‌های ارائه یا سوابق نمونه استفاده شده است؛ ابتدا وابستگی‌ها را بررسی کن.');
      }
      s.collections[route.key]=rows.filter(row=>row.id!==route.id);
      if (isCourse || isOffering) cleanDemoPlan(s);
      saveStore(s);
      return good({}) as ApiResponse<T>;
    }
  }
  return fail('این مسیر در شبیه‌ساز مرورگر هنوز پیاده‌سازی نشده است: '+path+'. برای تست واقعی آن Backend لازم است.');
}
