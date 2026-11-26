import type {
  AcademicRule, DemandResponse, DemandSurvey, DemandManagerScope,
  StudentAcademicProfile, User,
} from '../types';
import { extractSourceCourseIds } from '../utils/academic';
import { summarizeFormAnswers } from './demand-form';

/** The same survey has one effective response per user; repeated submissions replace it. */
export function surveyAppliesToProfile(s: DemandSurvey, profile: StudentAcademicProfile): boolean {
  return s.universityId === profile.universityId &&
    s.campusId === profile.campusId &&
    s.degreeLevelId === profile.degreeLevelId &&
    s.majorId === profile.majorId &&
    (!s.entryYearIds.length || s.entryYearIds.includes(profile.entryYearId)) &&
    (!s.trackIds.length || (!!profile.isTrackSelected && !!profile.selectedTrackId &&
      s.trackIds.includes(profile.selectedTrackId)));
}

export function managerCanAccessDemand(user: User, survey: Pick<DemandSurvey, 'campusId'|'degreeLevelId'|'majorId'>, exportPersonal = false): boolean {
  // An old role label alone is never proof of verified root identity.
  if (user.roles.includes('super-admin')) return false;
  // Student-role tokens cannot become department managers from a stray permission.
  if (!user.roles.includes('admin')) return false;
  if (!user.permissions?.includes(exportPersonal ? 'demand.export' : 'demand.manage')) return false;
  const assignments: DemandManagerScope[] = user.demandScopes || [];
  return assignments.some(scope => scope.campusId === survey.campusId &&
    scope.degreeLevelId === survey.degreeLevelId && scope.majorId === survey.majorId);
}

export type DemandParticipationStats={
  withCourseRequests:number;
  withoutCourseRequests:number;
  totalCourseRequests:number;
  graduationYes:number;
  graduationNo:number;
  graduationUnknown:number;
};

export function summarizeDemand(survey: DemandSurvey, responses: DemandResponse[]) {
  const relevant = responses.filter(r => r.surveyId === survey.id);
  const surveyCourseIds=new Set(survey.courseIds);
  const participation:DemandParticipationStats={
    withCourseRequests:0,withoutCourseRequests:0,totalCourseRequests:0,
    graduationYes:0,graduationNo:0,graduationUnknown:0,
  };
  for(const response of relevant){
    const count=new Set(response.courseIds.filter(id=>surveyCourseIds.has(id))).size;
    if(count>0)participation.withCourseRequests++;
    else participation.withoutCourseRequests++;
    participation.totalCourseRequests+=count;
    if(response.anticipatedGraduation==='YES')participation.graduationYes++;
    else if(response.anticipatedGraduation==='NO')participation.graduationNo++;
    else participation.graduationUnknown++;
  }
  const byCourse = survey.courseIds.map(courseId => {
    const count = relevant.reduce((total, r) => total + Number(r.courseIds.includes(courseId)), 0);
    const threshold = survey.recommendedMinimumByCourse[courseId] || 0;
    return {
      courseId, count, threshold, meetsSuggestedThreshold: threshold > 0 && count >= threshold,
      selfReportedFinalSemester: relevant.filter(r => r.courseIds.includes(courseId) && r.anticipatedGraduation === 'YES').length,
    };
  });
  return {
    surveyId: survey.id,participantCount:relevant.length,participation,byCourse,
    byQuestion:summarizeFormAnswers(survey.questions||[],relevant),
  };
}

/** No user-supplied CSV values may execute as a formula when opened by spreadsheet software. */
function safeCell(value: string | number | boolean | null | undefined) {
  // CSV row separators and embedded controls must not let untrusted student
  // fields start a new record or manufacture an executable spreadsheet cell.
  const text = String(value ?? '').replace(/[\r\n\t\u2028\u2029]/g, ' ');
  const guarded = /^[\s\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\ufeff]*[=+\-@]/.test(text)
    ? "'" + text : text;
  return '"' + guarded.replace(/"/g, '""') + '"';
}
export function exportDemandCsv(survey: DemandSurvey, responses: DemandResponse[], courseNames: Map<string,string>, entryYears: Map<string,string>, tracks: Map<string,string>, majors: Map<string,string> = new Map()) {
  const rows = [
    ['نام دانشجو','شماره دانشجویی','ورودی','رشته','انتخاب رسمی گرایش','گرایش','اظهار ترم آخر','نام درس','کد/شناسه درس','آخرین ویرایش'].map(safeCell).join(','),
  ];
  for (const r of responses.filter(x => x.surveyId === survey.id)) {
    // A submitted empty selection still counts as a participating student.
    // Omitting that row makes the personal export contradict the aggregate.
    for (const courseId of r.courseIds.length > 0 ? r.courseIds : [null]) {
      rows.push([
        r.snapshot.studentName, r.studentNumber,
        entryYears.get(r.snapshot.entryYearId) || r.snapshot.entryYearId,
        majors.get(survey.majorId) || survey.majorId,
        r.snapshot.isTrackSelected ? 'بله' : 'خیر',
        r.snapshot.selectedTrackId ? (tracks.get(r.snapshot.selectedTrackId) || r.snapshot.selectedTrackId) : 'انتخاب نشده',
        r.anticipatedGraduation === 'YES' ? 'بله (اظهار دانشجو)' : r.anticipatedGraduation === 'NO' ? 'خیر (اظهار دانشجو)' : 'نامشخص',
        courseId ? (courseNames.get(courseId) || courseId) : 'بدون درس درخواستی', courseId ?? '', r.updatedAt,
      ].map(safeCell).join(','));
    }
  }
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}

/** Scoped aggregate CSV has NO student identity; safe for demand.manage without demand.export.
 * All text (including course names) is escaped against spreadsheet formulas. */
export function exportDemandSummaryCsv(
  survey: DemandSurvey,
  responses: DemandResponse[],
  courseNames: ReadonlyMap<string,string>,
  courseCodes: ReadonlyMap<string,string>,
):string {
  const summary=summarizeDemand(survey,responses);
  const lines=[
    ['نام درس','کد درس','تعداد تقاضا','حدنصاب پیشنهادی','باقی‌مانده تا حدنصاب',
      'اظهار ترم آخر','وضعیت شاخص'].map(safeCell).join(','),
  ];
  for(const row of summary.byCourse){
    const gap=row.threshold>0?Math.max(0,row.threshold-row.count):'تعریف نشده';
    lines.push([
      courseNames.get(row.courseId)||row.courseId,courseCodes.get(row.courseId)||row.courseId,
      row.count,row.threshold,gap,row.selfReportedFinalSemester,
      row.threshold===0?'حدنصاب تعریف نشده':row.meetsSuggestedThreshold?'حدنصاب پیشنهادی تأمین شده':'تقاضا کمتر از حدنصاب پیشنهادی',
    ].map(safeCell).join(','));
  }
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
}

/** خروجی آماری سؤال‌ها؛ متن آزاد و شناسهٔ پاسخ‌دهنده هرگز صادر نمی‌شود. */
export function exportDemandQuestionSummaryCsv(
  survey:DemandSurvey,responses:DemandResponse[],
):string {
  const questions=summarizeDemand(survey,responses).byQuestion;
  const rows=[['عنوان سؤال','نوع سؤال','تعداد مشمولان','تعداد پاسخ معتبر',
    'درصد تکمیل از مشمولان','گزینه','تعداد انتخاب گزینه','درصد از پاسخ‌دهندگان'].map(safeCell).join(',')];
  const kinds={
    single_choice:'تک‌انتخابی',multiple_choice:'چندانتخابی',rating:'امتیازی',
    short_text:'متن کوتاه',long_text:'متن بلند',
  } as const;
  const percent=(count:number,total:number)=>total>0?
    (Math.round(count/total*1000)/10).toFixed(1)+'%':'—';
  for(const question of questions){
    const common=[question.title,kinds[question.kind],question.visibleCount,question.answeredCount,
      percent(question.answeredCount,question.visibleCount)];
    if(question.textAnswersPrivate){
      rows.push([...common,'متن خصوصی است','',''].map(safeCell).join(','));
      continue;
    }
    for(const option of question.options){
      rows.push([...common,option.label,option.count,
        percent(option.count,question.answeredCount)].map(safeCell).join(','));
    }
  }
  return '\uFEFF'+rows.join('\r\n')+'\r\n';
}

/** Full custom answers are sensitive: restricted to the separately authorized personal-data export. */
export function exportDemandAnswersCsv(
  survey:DemandSurvey,responses:readonly DemandResponse[],
):string {
  const questions=survey.questions||[];
  const header=['نام دانشجو','شماره دانشجویی','زمان پاسخ',...questions.map(q=>q.title)];
  const rows=[header.map(safeCell).join(',')];
  for(const response of responses.filter(item=>item.surveyId===survey.id)){
    rows.push([
      response.snapshot.studentName,response.studentNumber,response.updatedAt,
      ...questions.map(q=>{
        const answer=response.answers?.[q.id];
        return Array.isArray(answer)?answer.join(' | '):answer||'';
      }),
    ].map(safeCell).join(','));
  }
  return '\uFEFF'+rows.join('\r\n')+'\r\n';
}

/** Only graph-derived planning insights; never a statement of eligibility. */
export function downstreamCourseIds(courseId: string, curriculumId: string, rules: readonly AcademicRule[]): string[] {
  const outgoing = new Map<string, Set<string>>();
  for (const rule of rules) {
    if (rule.curriculumId !== curriculumId || rule.relationshipType !== 'PREREQUISITE') continue;
    for (const prereqId of extractSourceCourseIds(rule.expression)) {
      const targets = outgoing.get(prereqId) || new Set<string>();
      targets.add(rule.targetCourseId);
      outgoing.set(prereqId, targets);
    }
  }
  const visited = new Set<string>(), queue = [...(outgoing.get(courseId) || [])];
  while (queue.length) {
    const target = queue.shift()!;
    if (target === courseId || visited.has(target)) continue;
    visited.add(target);
    for (const next of outgoing.get(target) || []) if (!visited.has(next)) queue.push(next);
  }
  return [...visited];
}
