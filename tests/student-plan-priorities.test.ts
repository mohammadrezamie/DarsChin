import { describe, expect, it } from 'vitest';
import { updatePlanSchema } from '../server/schemas/student';

describe('persisted student registration priority formats',()=>{
  it('accepts the ordered course ID list sent by current student planner',()=>{
    const value={selectedOfferingIds:['off-math2','off-diff'],
      coursePriorities:['diff','math2'],offeringPriorities:{diff:['off-diff']}};
    const parsed=updatePlanSchema.safeParse(value);
    expect(parsed.success).toBe(true);
    if(parsed.success)expect(parsed.data.coursePriorities).toEqual(['diff','math2']);
  });
  it('retains historical numeric course rank maps instead of silently losing them',()=>{
    const parsed=updatePlanSchema.safeParse({coursePriorities:{diff:1,math2:2}});
    expect(parsed.success).toBe(true);
  });
  it('marks optimizer saves for strict server validation without changing manual edits',()=>{
    const proposed=updatePlanSchema.safeParse({
      selectedOfferingIds:['off-1','off-2'],
      offeringPriorities:{A:['off-1'],B:['off-2']},
      qualitySuggestion:true,
    });
    expect(proposed.success).toBe(true);
    if(proposed.success)expect(proposed.data.qualitySuggestion).toBe(true);
    expect(updatePlanSchema.safeParse({qualitySuggestion:'yes'}).success).toBe(false);
    expect(updatePlanSchema.safeParse({qualitySuggestion:true}).success).toBe(false);
    expect(updatePlanSchema.safeParse({qualitySuggestion:true,selectedOfferingIds:[]}).success).toBe(false);
    expect(updatePlanSchema.safeParse({qualitySuggestion:true,selectedOfferingIds:['off-1']}).success).toBe(true);
    expect(updatePlanSchema.safeParse({selectedOfferingIds:Array(101).fill('off-1')}).success).toBe(false);
    expect(updatePlanSchema.safeParse({selectedOfferingIds:['off-1']}).success).toBe(true);
  });
  it('rejects malformed priority maps and arrays',()=>{
    expect(updatePlanSchema.safeParse({coursePriorities:{diff:['off-diff']}}).success).toBe(false);
    expect(updatePlanSchema.safeParse({coursePriorities:[42,null]}).success).toBe(false);
  });
});
