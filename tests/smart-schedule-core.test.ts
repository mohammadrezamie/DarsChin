import { describe,expect,it } from 'vitest';
import { suggestSmartSchedules } from '../src/domain/smart-schedule';
import type { CourseEligibilityResult } from '../src/types';

const mk=(id:string,courseId:string,day='شنبه',start='08:00',end='10:00',examDate?:string):CourseEligibilityResult=>({
  offeringId:id,courseId,courseCode:courseId,courseName:courseId,
  instructor:'استاد '+id,groupCode:id,dayOfWeek:day,startTime:start,endTime:end,
  canSelect:true,isEligible:true,overallStatus:'AVAILABLE',examDate,
} as CourseEligibilityResult);
const m1=mk('math-a','math','شنبه','08:00','10:00');
const m2=mk('math-b','math','دوشنبه','08:00','10:00');
const p1=mk('physics-a','physics','شنبه','10:00','12:00');
const p2=mk('physics-b','physics','سه‌شنبه','08:00','10:00');
const base={
  chosenCourseIds:['math','physics'],coursePriorities:['math','physics'],
  evaluations:[m1,m2,p1,p2],offeringPriorities:{math:['math-b','math-a'],physics:['physics-b','physics-a']},
  maxDays:2 as const,criterion:'fewest-days' as const,
};
describe('موتور ساخت برنامهٔ واقعی ۲ تا ۵ روزه',()=>{
  it('یک گروه برای هر درس و ترکیب کم‌روز بدون تداخل پیشنهاد می‌دهد',()=>{
    const result=suggestSmartSchedules(base);
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.options[0].days).toEqual(['شنبه']);
    expect(result.options[0].offeringIds).toEqual(['math-a','physics-a']);
    expect(result.options[0].offerings.map(o=>o.courseId)).toEqual(['math','physics']);
    expect(result.options.every(s=>s.days.length<=2)).toBe(true);
  });
  it('اولویت استاد تعیین‌شده توسط دانشجو را در صورت مجاز بودن ترجیح می‌دهد',()=>{
    const result=suggestSmartSchedules({...base,maxDays:3,criterion:'my-teachers'});
    expect(result.options[0].offeringIds).toEqual(['math-b','physics-b']);
    expect(result.options[0].days).toHaveLength(2);
  });
  it('از تداخل زمان کلاس و شروع مشترک امتحان پیشنهاد نمی‌سازد',()=>{
    const collision=suggestSmartSchedules({...base,evaluations:[
      mk('math-a','math','شنبه','08:00','10:00','1405/11/10 - 08:00'),
      mk('physics-a','physics','شنبه','09:00','11:00','1405/11/10 - 08:00'),
    ]});
    expect(collision.options).toEqual([]);
  });
  it('برنامه ناقص و زمان نامعتبر را به عنوان برنامه قطعی معرفی نمی‌کند',()=>{
    const unknown=suggestSmartSchedules({...base,evaluations:[mk('math-a','math','','',''),p1]});
    expect(unknown.options).toEqual([]);
    expect(unknown.unverifiedTimeCourseIds).toEqual(['math']);
    const missing=suggestSmartSchedules({...base,evaluations:[m1,{...p1,isEligible:false}]});
    expect(missing.options).toEqual([]);
    expect(missing.missingCourseIds).toEqual(['physics']);
  });
  it('اگر سه روز اجباری است، آن را برنامه دو روزه اعلام نمی‌کند',()=>{
    const three=[mk('a','a','شنبه'),mk('b','b','دوشنبه'),mk('c','c','چهارشنبه')];
    const props={...base,chosenCourseIds:['a','b','c'],coursePriorities:[],evaluations:three,offeringPriorities:{}};
    expect(suggestSmartSchedules({...props,maxDays:2}).options).toEqual([]);
    expect(suggestSmartSchedules({...props,maxDays:3}).options).toHaveLength(1);
  });
});
