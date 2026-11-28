import type { CurriculumCourse, Course, Track } from '../types';

export interface PreviewCourse {
  courseId: string;
  course: Course | undefined;
  assignments: CurriculumCourse[];
  semester: number | null;
  needsReview: boolean;
}
export interface CurriculumSemesterPreview {
  scopeValid: boolean;
  groups: { semester: number; courses: PreviewCourse[] }[];
  unplanned: PreviewCourse[];
  totalCourses: number;
  reviewCount: number;
  inactiveCount: number;
}

/** Read-only projection of existing assignments, not an approved study plan or eligibility decision. */
export function buildCurriculumSemesterPreview(
  curriculumId: string, majorId: string,
  assignments: readonly CurriculumCourse[], courses: readonly Course[],
  tracks: readonly Track[], trackId: string | null,
): CurriculumSemesterPreview {
  const scopeValid = trackId === null || tracks.some(t=>t.id===trackId&&t.majorId===majorId&&t.active);
  const scoped = scopeValid ? assignments.filter(a=>a.curriculumId===curriculumId&&
    (!a.trackId || a.trackId===trackId)) : [];
  const byId = new Map<string,CurriculumCourse[]>();
  for(const a of scoped.filter(a=>a.active!==false)){
    const rows=byId.get(a.courseId)||[];
    rows.push(a);byId.set(a.courseId,rows);
  }
  const catalogue=new Map(courses.map(c=>[c.id,c]));
  const groups=new Map<number,PreviewCourse[]>();
  const unplanned:PreviewCourse[]=[];
  let reviewCount=0;
  for(const [courseId,rows] of byId){
    const course=catalogue.get(courseId);
    // Do not silently prefer a track-specific row over a shared row, or double-count a course.
    const value=rows[0].suggestedSemester;
    const validSemester=Number.isInteger(value)&&value>0;
    const conflicting=rows.length>1;
    const needsReview=conflicting||!course||!course.active||
      (!validSemester && value!==null && value!==undefined);
    const semester=validSemester&&!needsReview?value:null;
    const row={courseId,course,assignments:rows,semester,needsReview};
    if(needsReview)reviewCount++;
    if(semester===null)unplanned.push(row);
    else {const group=groups.get(semester)||[];group.push(row);groups.set(semester,group);}
  }
  const sort=(a:PreviewCourse,b:PreviewCourse)=>(a.course?.code||a.courseId).localeCompare(b.course?.code||b.courseId,'fa');
  return {scopeValid,groups:[...groups].sort(([a],[b])=>a-b).map(([semester,rows])=>({semester,courses:rows.sort(sort)})),
    unplanned:unplanned.sort(sort),totalCourses:byId.size,reviewCount,
    inactiveCount:scoped.filter(a=>a.active===false).length};
}
