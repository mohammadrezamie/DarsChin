import { describe, expect, it } from 'vitest';
import { validatePlanPriorities, type PriorityOffering } from '../src/domain/plan-priority-integrity';

const offers:PriorityOffering[]=[
  {id:'a-1',courseId:'a',campusId:'campus-1',termId:'fall',active:true},
  {id:'a-2',courseId:'a',campusId:'campus-1',termId:'fall',active:true},
  {id:'b-1',courseId:'b',campusId:'campus-1',termId:'fall',active:true},
  {id:'a-foreign',courseId:'a',campusId:'campus-2',termId:'fall',active:true},
  {id:'a-old',courseId:'a',campusId:'campus-1',termId:'spring',active:true},
  {id:'a-inactive',courseId:'a',campusId:'campus-1',termId:'fall',active:false},
];
const check=(courses:string[]|Record<string,number>|undefined,
  priorities:Record<string,string[]>|undefined)=>
  validatePlanPriorities(courses,priorities,offers,'campus-1','fall');

describe('student course/group priorities never cross academic scope',()=>{
  it('accepts properly scoped reordering and alternatives of the same course',()=>{
    expect(check(['b','a'],{a:['a-2','a-1'],b:['b-1']})).toBeNull();
    expect(check({a:2,b:1},{a:['a-1']})).toBeNull();
    expect(check(undefined,undefined)).toBeNull();
  });
  it('rejects another course masquerading as a fallback for course a',()=>{
    expect(check(['a'],{a:['b-1']})).toMatch(/درس/);
  });
  it('rejects another campus, term and inactive offerings',()=>{
    expect(check(['a'],{a:['a-foreign']})).not.toBeNull();
    expect(check(['a'],{a:['a-old']})).not.toBeNull();
    expect(check(['a'],{a:['a-inactive']})).not.toBeNull();
  });
  it('rejects unknown or duplicate course and offering priorities',()=>{
    expect(check(['foreign'],undefined)).not.toBeNull();
    expect(check(['a','a'],undefined)).not.toBeNull();
    expect(check(['a'],{a:['a-1','a-1']})).not.toBeNull();
    expect(check(['a'],{'foreign':['a-1']})).not.toBeNull();
  });
  it('limits unbounded priority payloads',()=>{
    expect(check(['a'],{a:Array(51).fill('a-1')})).not.toBeNull();
  });
});
