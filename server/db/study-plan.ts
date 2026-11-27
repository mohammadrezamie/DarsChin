import { z } from 'zod';
import type { DatabaseSchema } from './database';
import { validateStudyPlanDraft, type StudyPlanDraft } from '../../src/domain/study-plan-draft';
import { ruleScopeCourseIds } from '../../src/domain/curriculum-rule-scope';

const id=z.string().trim().min(1).max(150);
const period=z.object({id,kind:z.enum(['regular','summer','other']),label:z.string().trim().min(1).max(150)}).strict();
// Choice placeholders require an approved pool catalogue; do not invent one.
const item=z.object({id,kind:z.literal('course'),courseId:id,periodId:id}).strict();
export const studyPlanPayload=z.object({
  trackId:id.nullable(),
  plan:z.object({curriculumId:id,periods:z.array(period).max(100),items:z.array(item).max(2000)}).strict().nullable(),
}).strict();

export interface StoredStudyPlanDraft {
  curriculumId:string;
  trackId:string|null;
  plan:StudyPlanDraft;
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
