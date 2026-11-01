import { describe, expect, it } from 'vitest';
import { adminColumnDisplay, type Column } from '../src/components/AdminCrudTable';

describe('human-readable administrative relationships', () => {
  const province: Column = {
    key: 'provinceId', label: 'استان', type: 'select', lookupEndpoint: '/api/academic/provinces', required: true,
  };
  const options = [
    { value: 'internal-uuid-tehran', label: 'تهران' },
    { value: 'internal-uuid-yazd', label: 'یزد' },
  ];

  it('renders names instead of opaque foreign-key IDs', () => {
    expect(adminColumnDisplay(province, 'internal-uuid-tehran', options)).toBe('تهران');
    expect(adminColumnDisplay(province, 'internal-uuid-yazd', options)).toBe('یزد');
  });

  it('does not reveal raw IDs when referenced records are absent', () => {
    expect(adminColumnDisplay(province, 'unresolved-internal-uuid', options)).toBe('مرجع موجود نیست');
    expect(adminColumnDisplay(province, 'unresolved-internal-uuid', [], true)).toBe('در حال دریافت عنوان…');
  });

  it('handles absent references with a consistent placeholder', () => {
    expect(adminColumnDisplay(province, null, options)).toBe('—');
    expect(adminColumnDisplay(province, '', options)).toBe('—');
  });

  it('uses readable labels for select enums without changing their stored value', () => {
    const campusType: Column = { key: 'type', label: 'نوع واحد', type: 'select',
      options: [{ value: 'PROVINCE_UNIT', label: 'واحد استانی' }] };
    expect(adminColumnDisplay(campusType, 'PROVINCE_UNIT', campusType.options!)).toBe('واحد استانی');
  });

  it('preserves human-readable text and numeric values', () => {
    expect(adminColumnDisplay({ key: 'name', label: 'نام' }, 'مهندسی برق', [])).toBe('مهندسی برق');
    expect(adminColumnDisplay({ key: 'year', label: 'سال', type: 'number' }, 1404, [])).toBe('1404');
  });
});
