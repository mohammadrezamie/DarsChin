/** Student plan priorities may reference only one campus/term and their own course. */
export interface PriorityOffering {
  id: string;
  courseId: string;
  campusId: string;
  termId: string;
  active?: boolean;
}

/** Returns a Persian error rather than silently dropping unrelated or injected IDs. */
export function validatePlanPriorities(
  coursePriorities: string[] | Record<string, number> | undefined,
  offeringPriorities: Record<string, string[]> | undefined,
  offerings: readonly PriorityOffering[],
  campusId: string,
  termId: string,
): string | null {
  const valid = offerings.filter(o=>o.campusId===campusId &&
    o.termId===termId && o.active!==false);
  const byOffering=new Map(valid.map(o=>[o.id,o]));
  const availableCourses=new Set(valid.map(o=>o.courseId));
  if(coursePriorities!==undefined) {
    const ids=Array.isArray(coursePriorities)?coursePriorities:Object.keys(coursePriorities);
    if(ids.length>100 || new Set(ids).size!==ids.length ||
      ids.some(id=>!availableCourses.has(id))){
      return 'ترتیب درس‌ها دارای شناسهٔ تکراری یا خارج از فهرست همین واحد و نیمسال است.';
    }
  }
  if(offeringPriorities!==undefined){
    const entries=Object.entries(offeringPriorities);
    if(entries.length>100)return 'تعداد دروس موجود در اولویت گروه‌ها بیشتر از حد مجاز است.';
    for(const [courseId,ids] of entries){
      if(!availableCourses.has(courseId) || !Array.isArray(ids) || ids.length>50 ||
        new Set(ids).size!==ids.length ||
        ids.some(id=>byOffering.get(id)?.courseId!==courseId)){
        return 'اولویت گروه‌ها شامل شناسهٔ تکراری یا گروه متعلق به درس، واحد یا نیمسال دیگری است.';
      }
    }
  }
  return null;
}
