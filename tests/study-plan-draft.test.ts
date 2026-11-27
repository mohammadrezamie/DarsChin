import { describe, expect, it } from 'vitest';
import { validateStudyPlanDraft, type StudyPlanDraft, type StudyPeriod } from '../src/domain/study-plan-draft';

const context = { curriculumId: 'chart-a', courseIds: ['a','b'], choicePoolIds: ['electives'] };
const periods = (n: number): StudyPeriod[] => Array.from({length:n},(_,i)=>({id:'p'+(i+1),kind:'regular',label:'دوره '+(i+1)}));
const draft = (n: number): StudyPlanDraft => ({curriculumId:'chart-a', periods:periods(n),items:[]});

describe('برنامهٔ پیشنهادی مستقل از چارت',()=>{
  it('نبود برنامه مجاز است',()=>{
    expect(validateStudyPlanDraft(context,null)).toEqual({status:'absent'});
  });
  it.each([2,4,8,10,18])('تعداد دورهٔ %i در دادهٔ مصنوعی ثابت فرض نمی‌شود',(n)=>{
    expect(validateStudyPlanDraft(context,draft(n))).toEqual({status:'valid',unplannedCourseIds:['a','b']});
  });
  it('تابستان مستقل و جای‌نگهدار واقعی گروه انتخاب پذیرفته می‌شوند',()=>{
    const d: StudyPlanDraft={curriculumId:'chart-a',periods:[...periods(4),{id:'summer',kind:'summer',label:'تابستان'}],items:[
      {id:'i1',kind:'course',courseId:'a',periodId:'summer'},
      {id:'i2',kind:'choice',poolId:'electives',periodId:'p1',label:'درس انتخابی'},
    ]};
    expect(validateStudyPlanDraft(context,d)).toEqual({status:'valid',unplannedCourseIds:['b']});
  });
  it('برنامهٔ متعلق به چارت دیگر رد می‌شود',()=>{
    expect(validateStudyPlanDraft(context,{...draft(4),curriculumId:'chart-b'}).status).toBe('invalid');
  });
  it('درس و گروه و دورهٔ خارج از محدوده رد می‌شوند',()=>{
    const d: StudyPlanDraft={...draft(4),items:[
      {id:'i1',kind:'course',courseId:'other',periodId:'p1'},
      {id:'i2',kind:'choice',poolId:'other',periodId:'missing',label:'انتخابی'},
    ]};
    const r=validateStudyPlanDraft(context,d);
    expect(r.status).toBe('invalid');
    if(r.status==='invalid')expect(r.issues).toHaveLength(3);
  });
  it('درس تکراری یا شناسهٔ دورهٔ تکراری رد می‌شود',()=>{
    const d: StudyPlanDraft={...draft(2),periods:[...periods(2),...periods(1)],items:[
      {id:'i1',kind:'course',courseId:'a',periodId:'p1'},
      {id:'i2',kind:'course',courseId:'a',periodId:'p2'},
    ]};
    expect(validateStudyPlanDraft(context,d).status).toBe('invalid');
  });
});
