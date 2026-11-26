import { describe, expect, it } from 'vitest';
import { solveCohortPattern, type PatternGroup, type PatternSession } from '../src/domain/cohort-pattern';

const session=(day:string,start:string,end:string,mode:PatternSession['mode']='physical'):PatternSession=>({day,start,end,mode});
const group=(id:string,...sessions:PatternSession[]):PatternGroup=>({id,sessions,exam:'not-required'});

describe('الگوچین مستقل مدیر گروه',()=>{
  it('همهٔ دروس را حفظ و یک روز را بر دو روز ترجیح می‌دهد',()=>{
    const r=solveCohortPattern([
      {id:'math',groups:[group('a',session('شنبه','۰۸:۰۰','۱۰:۰۰')),group('b',session('دوشنبه','08:00','10:00'))]},
      {id:'physics',groups:[group('c',session('شنبه','10:00','12:00'))]},
      {id:'lab',groups:[group('d',session('شنبه','13:00','15:00'))]},
    ]);
    expect(r.status).toBe('optimal');
    expect(r.option?.physicalDays).toBe(1);
    expect(r.option?.selections).toHaveLength(3);
    expect(r.option?.gapMinutes).toBe(60);
  });
  it('جلسهٔ دوم مجازی با کلاس حضوری تداخل دارد و گروه جایگزین انتخاب می‌شود',()=>{
    const r=solveCohortPattern([
      {id:'a',groups:[group('a1',session('شنبه','08:00','10:00'),session('سه‌شنبه','10:00','12:00','online'))]},
      {id:'b',groups:[group('b1',session('سهشنبه','11:00','13:00')),group('b2',session('شنبه','10:00','12:00'))]},
    ]);
    expect(r.status).toBe('optimal');
    expect(r.option?.selections).toContainEqual({courseId:'b',groupId:'b2'});
    expect(r.option?.physicalDays).toBe(1);
    expect(r.option?.teachingDays).toBe(2);
  });
  it('قفل گروه و ناممکن بودن کامل را رعایت می‌کند و درس را حذف نمی‌کند',()=>{
    const r=solveCohortPattern([
      {id:'a',groups:[group('a1',session('شنبه','08:00','10:00'))]},
      {id:'b',lockedGroupId:'b1',groups:[group('b1',session('شنبه','09:00','11:00')),group('b2',session('دوشنبه','09:00','11:00'))]},
    ]);
    expect(r.status).toBe('impossible');
    expect(r.option).toBeNull();
  });
  it('هم‌پوشانی بازهٔ امتحان و شروع یکسان را رد می‌کند',()=>{
    const a={...group('a',session('شنبه','08:00','10:00')),exam:{date:'۱۴۰۵/۱۰/۱۲',start:'08:00',end:'10:00'}};
    const b={...group('b',session('شنبه','10:00','12:00')),exam:{date:'1405/10/12',start:'09:00',end:'11:00'}};
    expect(solveCohortPattern([{id:'a',groups:[a]},{id:'b',groups:[b]}]).status).toBe('impossible');
    expect(solveCohortPattern([{id:'a',groups:[a]},{id:'b',groups:[{...b,exam:{date:'1405/10/12',start:'08:00'}}]}]).status).toBe('impossible');
  });
  it('نبود اطلاعات امتحان را پنهان نمی‌کند و روز مجازی حضور نیست',()=>{
    const r=solveCohortPattern([{id:'a',groups:[{...group('a',session('شنبه','08:00','10:00','online')),exam:'unknown'}]}]);
    expect(r.option?.physicalDays).toBe(0);
    expect(r.option?.teachingDays).toBe(1);
    expect(r.option?.examInformationComplete).toBe(false);
    expect(r.issues).not.toHaveLength(0);
  });
  it('داده ناقص و تکراری را نامعتبر اعلام می‌کند',()=>{
    expect(solveCohortPattern([{id:'a',groups:[group('a',session('شنبه','25:00','10:00'))]}]).status).toBe('invalid');
    expect(solveCohortPattern([{id:'a',groups:[]},{id:'a',groups:[]}]).status).toBe('invalid');
    expect(solveCohortPattern([{id:'a',groups:[]}]).status).toBe('impossible');
  });
  it('توقف قبل از یافتن جواب با ناممکن بودن تفاوت دارد',()=>{
    const courses=[{id:'a',groups:[group('a1',session('شنبه','08:00','10:00')),group('a2',session('دوشنبه','08:00','10:00'))]}];
    expect(solveCohortPattern(courses,1).status).toBe('undetermined');
    const r=solveCohortPattern(courses,2);
    expect(r.status).toBe('approximate');
    expect(r.option).not.toBeNull();
  });
});
