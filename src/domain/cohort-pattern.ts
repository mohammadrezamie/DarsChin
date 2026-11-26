import { clockMinutes, normalizedExamDay } from './plan-conflicts';

export type PatternSession = { day: string; start: string; end: string; mode: 'physical' | 'online' };
export type PatternExam = { date: string; start: string; end?: string } | 'not-required' | 'unknown';
export interface PatternGroup {
  id: string;
  sessions: readonly PatternSession[];
  exam: PatternExam;
}
export interface PatternCourse {
  id: string;
  groups: readonly PatternGroup[];
  lockedGroupId?: string;
}
export interface PatternOption {
  selections: { courseId: string; groupId: string }[];
  physicalDays: number;
  teachingDays: number;
  gapMinutes: number;
  examInformationComplete: boolean;
}
export interface PatternResult {
  status: 'optimal' | 'approximate' | 'impossible' | 'undetermined' | 'invalid';
  option: PatternOption | null;
  examinedNodes: number;
  issues: string[];
}
const DAYS = ['شنبه','یکشنبه','دوشنبه','سهشنبه','چهارشنبه','پنجشنبه','جمعه'];
const dayKey = (value: string) => value.replace(/\u200c/g,'').replace(/\s+/g,'').replace(/ي/g,'ی');
type Session = { day: string; start: number; end: number; mode: PatternSession['mode'] };
type Exam = { date: string; start: number; end: number | null };
type Candidate = { courseId: string; groupId: string; sessions: Session[]; exam: Exam | null; examComplete: boolean };
const overlap = (a: Session, b: Session) => a.day === b.day && a.start < b.end && b.start < a.end;
const examOverlap = (a: Exam, b: Exam) => a.date === b.date && (a.start === b.start ||
  (a.end !== null && b.end !== null && a.start < b.end && b.start < a.end));
function candidate(courseId: string, group: PatternGroup): Candidate | null {
  if (!group.id || group.sessions.length < 1 || group.sessions.length > 14) return null;
  const sessions: Session[] = [];
  for (const s of group.sessions) {
    const day = dayKey(s.day), start = clockMinutes(s.start), end = clockMinutes(s.end);
    if (!DAYS.includes(day) || start === null || end === null || end <= start ||
        (s.mode !== 'physical' && s.mode !== 'online')) return null;
    const next = {day,start,end,mode:s.mode};
    if (sessions.some(old => overlap(old,next))) return null;
    sessions.push(next);
  }
  let exam: Exam | null = null;
  let examComplete = group.exam === 'not-required';
  if (group.exam !== 'not-required' && group.exam !== 'unknown') {
    const date = normalizedExamDay(group.exam.date);
    const start = clockMinutes(group.exam.start);
    const end = group.exam.end === undefined ? null : clockMinutes(group.exam.end);
    if (!date || start === null || (group.exam.end !== undefined && (end === null || end <= start))) return null;
    exam = {date,start,end};
    examComplete = end !== null;
  }
  return {courseId,groupId:group.id,sessions,exam,examComplete};
}
function measure(selected: Candidate[]): PatternOption {
  const sessions = selected.flatMap(c => c.sessions);
  const physicalDays = new Set(sessions.filter(s=>s.mode==='physical').map(s=>s.day)).size;
  const teachingDays = new Set(sessions.map(s=>s.day)).size;
  let gapMinutes = 0;
  for (const day of DAYS) {
    const sorted = sessions.filter(s=>s.day===day).sort((a,b)=>a.start-b.start);
    for(let i=1;i<sorted.length;i++) gapMinutes += Math.max(0,sorted[i].start-sorted[i-1].end);
  }
  return {selections:selected.map(c=>({courseId:c.courseId,groupId:c.groupId})),physicalDays,teachingDays,gapMinutes,
    examInformationComplete:selected.every(c=>c.examComplete)};
}
function better(a: PatternOption,b: PatternOption) {
  return a.physicalDays < b.physicalDays ||
    (a.physicalDays === b.physicalDays && (a.teachingDays < b.teachingDays ||
      (a.teachingDays === b.teachingDays && a.gapMinutes < b.gapMinutes)));
}
/** موتور پیشنهادی مستقل، بدون دسترسی به حساب، چارت یا API. هر درس یک گروه کامل دارد.
 * نتیجهٔ optimal صرفاً نسبت به ورودی معتبر و تداخل‌های شناخته‌شده است؛ نه تأیید رسمی برنامه.
 */
export function solveCohortPattern(courses: readonly PatternCourse[], nodeLimit = 50000): PatternResult {
  const result: PatternResult = {status:'invalid',option:null,examinedNodes:0,issues:[]};
  if (!Number.isSafeInteger(nodeLimit) || nodeLimit < 1 || nodeLimit > 100000 ||
    courses.length < 1 || courses.length > 40 || new Set(courses.map(c=>c.id)).size !== courses.length) {
    result.issues.push('تعداد دروس، شناسه‌ها یا سقف جست‌وجو نامعتبر است.');
    return result;
  }
  const rows: Candidate[][] = [];
  for (const c of courses) {
    if (!c.id || c.groups.length > 60 || new Set(c.groups.map(g=>g.id)).size !== c.groups.length ||
        (c.lockedGroupId !== undefined && !c.groups.some(g=>g.id===c.lockedGroupId))) {
      result.issues.push('گزینه یا قفل نامعتبر برای درس '+c.id);
      return result;
    }
    const groups = c.groups.filter(g=>c.lockedGroupId===undefined || g.id===c.lockedGroupId);
    const choices: Candidate[] = [];
    for (const g of groups) {
      const parsed = candidate(c.id,g);
      if (!parsed) {
        result.issues.push('اطلاعات جلسه یا امتحان نامعتبر: '+c.id+' / '+g.id);
        return result;
      }
      choices.push(parsed);
    }
    if (!choices.length) {
      result.issues.push('درس بدون گزینه: '+c.id);
      result.status = 'impossible';
      return result;
    }
    rows.push(choices.sort((a,b)=>a.groupId.localeCompare(b.groupId)));
  }
  rows.sort((a,b)=>a.length-b.length);
  let truncated = false;
  const selected: Candidate[] = [];
  function visit(index: number) {
    if (truncated) return;
    if (result.examinedNodes >= nodeLimit) {truncated=true;return;}
    result.examinedNodes++;
    if (index === rows.length) {
      const option = measure(selected);
      if (!result.option || better(option,result.option)) result.option=option;
      return;
    }
    // تعداد روزها فقط می‌تواند افزایش یابد؛ فاصله‌ها برای هرس امن نیستند.
    if (result.option && measure(selected).physicalDays > result.option.physicalDays) return;
    for (const next of rows[index]) {
      if (result.examinedNodes >= nodeLimit) {truncated=true;return;}
      if (selected.some(old=>old.sessions.some(a=>next.sessions.some(b=>overlap(a,b))) ||
        (old.exam !== null && next.exam !== null && examOverlap(old.exam,next.exam)))) continue;
      selected.push(next);visit(index+1);selected.pop();
      if(truncated)return;
    }
  }
  visit(0);
  result.status = truncated ? (result.option?'approximate':'undetermined') : (result.option?'optimal':'impossible');
  if (result.option && !result.option.examInformationComplete) result.issues.push('اطلاعات امتحان کامل نیست؛ نبود تداخل امتحان تأیید نشده است.');
  return result;
}
