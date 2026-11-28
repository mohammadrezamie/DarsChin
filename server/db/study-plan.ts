import { studyPlanPayload } from '../../src/domain/study-plan-payload';
export { studyPlanPayload } from '../../src/domain/study-plan-payload';
import type { DatabaseSchema } from './database';
import { validateStudyPlanDraft, type StudyPlanDraft } from '../../src/domain/study-plan-draft';
import { ruleScopeCourseIds } from '../../src/domain/curriculum-rule-scope';

export interface StoredStudyPlanDraft {
  curriculumId:string;
  trackId:string|null;
  plan:StudyPlanDraft;
  revision?:string; // Legacy rows use an explicit legacy revision until first write.
}
type ContextData=Pick<DatabaseSchema,'curricula'|'curriculumCourses'|'courses'|'tracks'>;
export function studyPlanScope(data:ContextData,curriculumId:string,trackId:string|null){
  const chart=data.curricula.find(c=>c.id===curriculumId);
  if(!chart||(trackId!==null&&!data.tracks.some(t=>t.id===trackId&&t.majorId===chart.majorId&&t.active)))return null;
  const ids=ruleScopeCourseIds(data.curriculumCourses,curriculumId,trackId);
  return {curriculumId,courseIds:data.courses.filter(c=>c.active&&ids.has(c.id)).map(c=>c.id),choicePoolIds:[]};
}
export function validateStoredStudyPlan(data:ContextData,row:StoredStudyPlanDraft):boolean{
  const parsed=studyPlanPayload.safeParse({trackId:row.trackId,plan:row.plan});
  if(!parsed.success||!parsed.data.plan)return false;
  const scope=studyPlanScope(data,row.curriculumId,row.trackId);
  return scope!==null&&validateStudyPlanDraft(scope,parsed.data.plan).status==='valid';
}

/** Protect even a legacy inconsistent row from silently losing its referenced course. */
export function studyPlanReferencesCourse(data:Pick<DatabaseSchema,'studyPlanDrafts'>,courseId:string):boolean{
  return (data.studyPlanDrafts||[]).some(row=>Array.isArray(row.plan?.items)&&row.plan.items.some(item=>item?.kind==='course'&&item.courseId===courseId));
}
