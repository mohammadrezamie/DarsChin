import { z } from 'zod';
const id=z.string().trim().min(1).max(150);
const period=z.object({id,kind:z.enum(['regular','summer','other']),label:z.string().trim().min(1).max(150)}).strict();
// Choice placeholders require an approved pool catalogue; do not invent one.
const item=z.object({id,kind:z.literal('course'),courseId:id,periodId:id}).strict();
export const studyPlanPayload=z.object({
  trackId:id.nullable(),
  plan:z.object({curriculumId:id,periods:z.array(period).max(100),items:z.array(item).max(2000)}).strict().nullable(),
}).strict();


/** Required precondition for every mutation, including deletion. Null means no saved draft. */
export const studyPlanMutation=studyPlanPayload.extend({expectedRevision:z.string().min(1).max(150).nullable()});
export function studyPlanRevision(row:{revision?:string}|undefined):string|null{return row?row.revision||'legacy':null;}
