import { describe, expect, it } from 'vitest';
import { plannedUnitCount } from '../src/domain/plan-unit-limits';

const courses = [
  {id:'normal',units:3,isExtraUnit:false},
  {id:'explicit-extra',units:2,isExtraUnit:true},
  {id:'misleading-name',units:2}, // no official extra-unit marker
  {id:'zero',units:0,isExtraUnit:false},
];
describe('shared, explicitly configured unit counting',()=>{
  it('uses real metadata and never silently exempts courses by their names',()=>{
    expect(plannedUnitCount(['normal','misleading-name'],courses)).toBe(5);
    expect(plannedUnitCount(['normal','explicit-extra'],courses)).toBe(3);
  });
  it('does not double-count repeated course IDs',()=>{
    expect(plannedUnitCount(['normal','normal','misleading-name'],courses)).toBe(5);
  });
  it('keeps unknown or empty records from fabricating units',()=>{
    expect(plannedUnitCount(['missing','zero'],courses)).toBe(0);
  });
});
