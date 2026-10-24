import { DEMO_COURSES } from './course-planner';
import type {
  ApiResponse, AcademicLimitInfo, AcademicPolicySettings, Course, CourseEligibilityResult,
  CourseOffering, StudentAcademicProfile,
} from '../types';

/**
 * Synthetic, BROWSER-ONLY API simulator for /demo/* pages.
 * It must never be used to authorize users or declare university eligibility.
 * Unsupported operations fail explicitly instead of pretending to succeed.
 */
export const DEMO_API_STORE_KEY = 'darschin_browser_mock_v1';
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
  academicSettings: AcademicPolicySettings;
}
const semester = { id: 'demo-term', name: 'نیمسال فرضی برای تست', year: 1405, termNumber: 1, isCurrent: true, active: true };
const university = { id: 'demo-university', name: 'دانشگاه نمونه (غیرواقعی)', code: 'DEMO-U', active: true };
const province = { id: 'demo-province', name: 'استان نمونه', active: true };
const campus = { id: 'demo-campus', universityId: university.id, provinceId: province.id, type: 'PROVINCE_UNIT', name: 'واحد نمونه', code: 'DEMO-C', active: true };
const degree = { id: 'demo-degree', name: 'کارشناسی نمونه', code: 'DEMO-BE', active: true };
const major = { id: 'demo-major', degreeLevelId: degree.id, name: 'مهندسی برق (نمونه)', code: 'DEMO-EE', active: true };
const entryYear = { id: 'demo-entry', year: 1403, active: true };
const curriculum = { id: 'demo-curriculum', universityId: university.id, campusId: campus.id, degreeLevelId: degree.id, majorId: major.id, entryYearId: entryYear.id, version: 'demo-1', name: 'چارت صرفاً نمایشی', status: 'active', createdAt: now() };
const sampleCourses: Course[] = DEMO_COURSES.map((c) => ({
  id: c.id, code: c.code, name: c.name, units: c.units,
  category: c.units === 1 ? 'آزمایشگاه' : 'اصلی', active: true,
}));
const sampleOfferings: CourseOffering[] = DEMO_COURSES.map((c) => ({
  id: 'off-' + c.id, termId: semester.id, campusId: campus.id,
  courseId: c.id, groupCode: '01', instructor: c.instructor, dayOfWeek: c.day,
  startTime: c.start, endTime: c.end, capacity: 40, enrolledCount: 16, source: 'manual', active: true,
}));
const defaults: AcademicPolicySettings = {
  normalMinUnits: 12, normalMaxUnits: 20, gpaBonusThreshold: 17, gpaBonusMaxUnits: 24,
  summerMinUnits: 1, summerMaxUnits: 8, finalSemesterMaxUnits: 24,
  finalSemesterThresholdUnits: 24, finalSemesterRuleEnabled: true,
};
function initialStore(): DemoStore {
  return {
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
      '/api/admin/users': [{ id: 'demo-student', name: 'دانشجوی نمونه', mobile: 'شمارهٔ ساختگی', roles: ['student'] }],
    },
    profile: {
      userId: 'demo-student', universityId: university.id, provinceId: province.id,
      campusId: campus.id, degreeLevelId: degree.id, majorId: major.id,
      entryYearId: entryYear.id, isTrackSelected: false, desiredTrackIds: [],
      currentTermId: semester.id, previousTermGpa: null, updatedAt: now(),
    },
    plan: { selectedOfferingIds: ['off-math2', 'off-physics'], coursePriorities: [], offeringPriorities: {} },
    passed: [], tickets: [], messages: [], bugs: [], academicSettings: { ...defaults },
  };
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
function academicLimits(s: DemoStore): AcademicLimitInfo {
  const total = sampleCourses.reduce((n, c) => n + c.units, 0);
  const passed = s.passed.reduce((n, p) => n + (sampleCourses.find(c => c.id === p.courseId)?.units || 0), 0);
  return {
    ...defaults, effectiveMinUnits: 0, effectiveMaxUnits: 99,
    isFinalSemester: false, isGradeA: false, isSummer: false,
    totalCurriculumUnits: total, passedUnits: passed, remainingUnits: total - passed,
    remainingCoursesCount: sampleCourses.length - s.passed.length,
    policySettings: { ...s.academicSettings }, majorRequiredPassed: passed,
    majorRequiredRemaining: total - passed, trackRequiredPassed: 0,
    trackRequiredRemaining: 0, electivesPassed: 0, electivesRemaining: 0,
  };
}
function demoEvaluation(s: DemoStore) {
  const courses = (s.collections['/api/academic/courses'] || []) as Course[];
  const offerings = (s.collections['/api/offerings'] || []) as CourseOffering[];
  // In demo ALL visible offerings are previewable, regardless of university rules.
  const results: CourseEligibilityResult[] = offerings.filter(o => o.active !== false).map(o => {
    const c = courses.find(course => course.id === o.courseId);
    return {
      offeringId: o.id, courseId: o.courseId, courseCode: c?.code || 'DEMO',
      courseName: c?.name || 'درس نمونه', units: c?.units || 0, category: c?.category || 'سایر',
      groupCode: o.groupCode, instructor: o.instructor, dayOfWeek: o.dayOfWeek,
      startTime: o.startTime, endTime: o.endTime, capacity: o.capacity,
      enrolledCount: o.enrolledCount, examDate: o.examDate,
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
    if (method === 'GET') return good(s.plan) as ApiResponse<T>;
    if (method === 'PUT') {
      s.plan = { ...s.plan, ...data, selectedOfferingIds: Array.isArray(data.selectedOfferingIds) ? data.selectedOfferingIds : s.plan.selectedOfferingIds };
      saveStore(s); return good(s.plan) as ApiResponse<T>;
    }
  }
  if (path === '/api/student/plan/select' && method === 'POST') {
    if (typeof data.offeringId !== 'string') return fail('شناسه گروه نامعتبر است.');
    const old = s.plan.selectedOfferingIds;
    s.plan.selectedOfferingIds = data.action === 'remove' ? old.filter(x=>x !== data.offeringId)
      : [...new Set([...old, data.offeringId])];
    saveStore(s); return good(s.plan) as ApiResponse<T>;
  }
  if (path === '/api/student/passed-courses' && method === 'GET') {
    const enriched = s.passed.map(row => ({ ...row, course: s.collections['/api/academic/courses'].find(c => c.id === row.courseId) }));
    const totalUnits = enriched.reduce((n,r) => n + (r.course?.units||0), 0);
    const categorySummary: Record<string,number> = {};
    enriched.forEach(r=>{if (r.course) categorySummary[r.course.category] = (categorySummary[r.course.category]||0)+r.course.units;});
    return good({ passedCourses: enriched, totalUnits, categorySummary }) as ApiResponse<T>;
  }
  if (path === '/api/student/passed-courses' && method === 'POST') {
    if (!sampleCourses.some(c=>c.id === data.courseId)) return fail('این درس در فهرست نمونه نیست.');
    if (s.passed.some(p=>p.courseId===data.courseId)) return fail('این درس قبلاً اضافه شده است.');
    s.passed.push({id:id(),userId:'demo-student',courseId:data.courseId,grade:data.grade,status:'PASSED',passedAt:now()});
    saveStore(s);return good(s.passed.at(-1)) as ApiResponse<T>;
  }
  if (path === '/api/student/passed-courses/batch' && method === 'POST') {
    const ids = Array.isArray(data.courseIds) ? data.courseIds : [];
    let addedCount=0;
    for(const courseId of ids){if(sampleCourses.some(c=>c.id===courseId)&&!s.passed.some(p=>p.courseId===courseId)){s.passed.push({id:id(),userId:'demo-student',courseId,status:'PASSED',passedAt:now()});addedCount++;}}
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
  if (path === '/api/imports/batches' && method === 'GET') return good([]) as ApiResponse<T>;
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
  if (path === '/api/support/admin/tickets' && method === 'GET') return good(s.tickets) as ApiResponse<T>;
  if (path === '/api/support/admin/bugs' && method === 'GET') return good(s.bugs) as ApiResponse<T>;
  if (path === '/api/curriculum' && method === 'GET') return good(s.collections['/api/curriculum']) as ApiResponse<T>;
  if (path.match(/^\/api\/curriculum\/[^/]+\/full$/) && method === 'GET') return good({ curriculum, courses: [], rules: [] }) as ApiResponse<T>;
  if (path.match(/^\/api\/curriculum\/[^/]+\/courses/)) {
    if(method==='GET') return good([]) as ApiResponse<T>;
    return fail('ویرایش روابط آموزشی در دمو فعال نیست؛ نیازمند تأیید قوانین دانشگاه است.');
  }
  const route=collectionRoute(path);
  if (route) {
    const rows=s.collections[route.key]||[];
    if(method==='GET') return good(route.id ? rows.find(row=>row.id===route.id)||null : rows) as ApiResponse<T>;
    if(route.key === '/api/curriculum/rules' || route.key === '/api/curriculum') {
      return fail('ویرایش چارت و قوانین دانشگاهی در دمو غیرفعال است.');
    }
    if(method==='POST'){
      const row={...data,id:id(),active:data.active!==false};rows.push(row);s.collections[route.key]=rows;saveStore(s);return good(row) as ApiResponse<T>;
    }
    if(method==='PUT' && route.id){const idx=rows.findIndex(row=>row.id===route.id);if(idx<0)return fail('رکورد دمو یافت نشد.');rows[idx]={...rows[idx],...data,id:route.id};saveStore(s);return good(rows[idx]) as ApiResponse<T>;}
    if(method==='DELETE' && route.id){s.collections[route.key]=rows.filter(row=>row.id!==route.id);saveStore(s);return good({}) as ApiResponse<T>;}
  }
  return fail('این مسیر در شبیه‌ساز مرورگر هنوز پیاده‌سازی نشده است: '+path+'. برای تست واقعی آن Backend لازم است.');
}
