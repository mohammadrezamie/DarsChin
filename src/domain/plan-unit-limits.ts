import type { Course } from '../types';

/**
 * One credit policy for one-by-one selection and whole-plan persistence.
 * Extra-unit status MUST be an explicit catalog decision. Never infer a legal
 * exception from the course's Persian display name.
 *
 * Repeated IDs count once; duplicate sections are rejected elsewhere.
 */
export function plannedUnitCount(
  courseIds: readonly string[],
  courses: readonly Pick<Course, 'id' | 'units' | 'isExtraUnit'>[],
):number {
  const byId=new Map(courses.map(c=>[c.id,c]));
  return [...new Set(courseIds)].reduce((sum,id)=>{
    const course=byId.get(id);
    if(!course || course.isExtraUnit===true) return sum;
    return sum+(Number.isFinite(course.units)&&course.units>0 ? course.units : 0);
  },0);
}
