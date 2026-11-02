import { describe, expect, it } from 'vitest';
import { preserveCoursePrioritiesAfterQueueReorder as preserve, promotePrimaryWithFallbacks as promote } from '../src/domain/student-flow-stage';
describe('صف یکپارچه و حفظ اولویت‌های ذخیره‌شده',()=>{
  it('با جابه‌جایی استاددارها، درس‌های بدون استاد را حذف نمی‌کند',()=>{
    expect(preserve(['math','physics','project'],['math','project','physics'],['physics','math']))
      .toEqual(['physics','math','project']);
  });
  it('اولویت قدیمی و درس جدید را نگه می‌دارد و تکرار را حذف می‌کند',()=>{
    expect(preserve(['math','project'],['previous','math'],['math','math']))
      .toEqual(['math','previous','project']);
  });
  it('بعد از ارتقای جایگزین، استاد قبلی اولویت دوم است و سایر گروه‌ها حفظ می‌شوند',()=>{
    expect(promote('g3','g1',['g1','g2','g3'])).toEqual(['g3','g1','g2']);
    expect(promote('g1','g1',['g1','g2','g2'])).toEqual(['g1','g2']);
  });
});
