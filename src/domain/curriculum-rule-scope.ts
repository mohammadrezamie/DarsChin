import type { AcademicRule, Curriculum, CurriculumCourse, Track } from '../types';
import { analyzeCurriculumDependencies } from './course-dependency-insights';
import { extractSourceCourseIds } from '../utils/academic';

/** Shared assignments apply to every track; scoped assignments never cross tracks. */
export function ruleScopeCourseIds(assignments: readonly CurriculumCourse[], curriculumId: string, trackId: string | null | undefined): Set<string> {
  return new Set(assignments.filter(row => row.curriculumId === curriculumId && row.active !== false &&
    (!row.trackId || (Boolean(trackId) && row.trackId === trackId))).map(row => row.courseId));
}

/** A graph represents one real academic context, never a union of mutually exclusive tracks. */
export function validateScopedCurriculumRules(
  chart: Pick<Curriculum,'id'|'majorId'|'entryYearId'>,
  assignments: readonly CurriculumCourse[],
  rules: readonly AcademicRule[],
  tracks: readonly Track[],
): string | null {
  const validTracks = new Set(tracks.filter(t=>t.active && t.majorId===chart.majorId).map(t=>t.id));
  const activeLinks = assignments.filter(a=>a.curriculumId===chart.id && a.active!==false);
  const scopedRules = rules.filter(r=>r.curriculumId===chart.id);
  const scopes = new Set<string|null>([null]);
  for(const link of activeLinks){
    if(link.trackId){
      if(!validTracks.has(link.trackId)) return 'گرایش یکی از دروس با چارت سازگار نیست.';
      scopes.add(link.trackId);
    }
  }
  for(const rule of scopedRules){
    if((rule.majorId&&rule.majorId!==chart.majorId)||(rule.entryYearId&&rule.entryYearId!==chart.entryYearId)||
        (rule.trackId&&!validTracks.has(rule.trackId))) return 'دامنهٔ یکی از قوانین با چارت سازگار نیست.';
    const allowed = ruleScopeCourseIds(activeLinks,chart.id,rule.trackId);
    const sources = extractSourceCourseIds(rule.expression);
    if(!allowed.has(rule.targetCourseId)||!sources.length||sources.some(id=>!allowed.has(id))) {
      return 'درس مرتبط یکی از قوانین خارج از دامنهٔ مشترک یا گرایش آن است.';
    }
    if(rule.trackId) scopes.add(rule.trackId);
  }
  for(const scope of scopes){
    const ids = [...ruleScopeCourseIds(activeLinks,chart.id,scope)];
    const applicable = scopedRules.filter(rule=>!rule.trackId||rule.trackId===scope);
    const analysis = analyzeCurriculumDependencies(chart.id,ids,applicable);
    if(!analysis.valid) return analysis.errors[0]||'زنجیرهٔ پیش‌نیازها در یکی از گرایش‌ها معتبر نیست.';
  }
  return null;
}

/** حذف انتساب نباید رابطهٔ آموزشی را بی‌اعتبار یا بی‌صدا حذف کند. */
export function rulesBlockingAssignmentRemoval(
  remaining: readonly CurriculumCourse[], rules: readonly AcademicRule[],
  curriculumId: string, courseId: string,
): string[] {
  return rules.filter(rule=>{
    if(rule.curriculumId!==curriculumId)return false;
    const sources=extractSourceCourseIds(rule.expression);
    if(rule.targetCourseId!==courseId&&!sources.includes(courseId))return false;
    const allowed=ruleScopeCourseIds(remaining,curriculumId,rule.trackId);
    return !allowed.has(rule.targetCourseId)||!sources.length||sources.some(id=>!allowed.has(id));
  }).map(rule=>rule.id);
}
