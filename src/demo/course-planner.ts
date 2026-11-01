/** Browser-only synthetic timetable playground: deliberately excludes academic eligibility rules. */
export type DemoDay = 'شنبه' | 'یکشنبه' | 'دوشنبه' | 'سه‌شنبه' | 'چهارشنبه' | 'پنجشنبه';

export interface DemoCourse {
  id: string;
  name: string;
  code: string;
  units: number;
  day: DemoDay;
  start: string; // 24h HH:mm
  end: string;
  instructor: string;
}

export const DEMO_STORAGE_KEY = 'darschin_demo_planner_v1';
export const DEMO_DAYS: DemoDay[] = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه'];

export const DEMO_COURSES: DemoCourse[] = [
  { id: 'math2', name: 'ریاضی عمومی ۲', code: 'DEMO-101', units: 3, day: 'شنبه', start: '08:00', end: '10:00', instructor: 'استاد نمونه ۱' },
  { id: 'circuits', name: 'مدارهای الکتریکی ۱', code: 'DEMO-102', units: 3, day: 'شنبه', start: '09:00', end: '11:00', instructor: 'استاد نمونه ۲' },
  { id: 'physics', name: 'فیزیک ۲', code: 'DEMO-103', units: 3, day: 'یکشنبه', start: '10:00', end: '12:00', instructor: 'استاد نمونه ۳' },
  { id: 'signals', name: 'سیگنال‌ها و سیستم‌ها', code: 'DEMO-104', units: 3, day: 'دوشنبه', start: '10:00', end: '12:00', instructor: 'استاد نمونه ۴' },
  { id: 'logic', name: 'مدارهای منطقی', code: 'DEMO-105', units: 3, day: 'سه‌شنبه', start: '13:00', end: '15:00', instructor: 'استاد نمونه ۵' },
  { id: 'em', name: 'الکترومغناطیس', code: 'DEMO-106', units: 3, day: 'چهارشنبه', start: '09:00', end: '11:00', instructor: 'استاد نمونه ۶' },
  { id: 'lab', name: 'آزمایشگاه مدار', code: 'DEMO-107', units: 1, day: 'چهارشنبه', start: '12:00', end: '14:00', instructor: 'استاد نمونه ۷' },
  { id: 'english', name: 'زبان انگلیسی عمومی', code: 'DEMO-108', units: 3, day: 'پنجشنبه', start: '10:00', end: '12:00', instructor: 'استاد نمونه ۸' },
];

export const DEMO_INITIAL_IDS = ['math2', 'physics', 'logic'];

const timeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

export function normalizeDemoSelection(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEMO_INITIAL_IDS];
  const known = new Set(DEMO_COURSES.map((course) => course.id));
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && known.has(id)))];
}

export function readDemoSelection(storage?: Pick<Storage, 'getItem'>): string[] {
  if (!storage) return [...DEMO_INITIAL_IDS];
  try {
    const stored = storage.getItem(DEMO_STORAGE_KEY);
    return stored === null ? [...DEMO_INITIAL_IDS] : normalizeDemoSelection(JSON.parse(stored));
  } catch {
    return [...DEMO_INITIAL_IDS];
  }
}

export function getSelectedCourses(ids: readonly string[]): DemoCourse[] {
  const selected = new Set(ids);
  return DEMO_COURSES.filter((course) => selected.has(course.id));
}

export function getDemoTotalUnits(ids: readonly string[]): number {
  return getSelectedCourses(ids).reduce((sum, course) => sum + course.units, 0);
}

export interface DemoTimeConflict {
  first: DemoCourse;
  second: DemoCourse;
}

export function getDemoTimeConflicts(ids: readonly string[]): DemoTimeConflict[] {
  const courses = getSelectedCourses(ids);
  const conflicts: DemoTimeConflict[] = [];
  for (let i = 0; i < courses.length; i += 1) {
    for (let j = i + 1; j < courses.length; j += 1) {
      const a = courses[i];
      const b = courses[j];
      if (a.day !== b.day) continue;
      if (timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end)) {
        conflicts.push({ first: a, second: b });
      }
    }
  }
  return conflicts;
}
