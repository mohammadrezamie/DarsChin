import { describe, expect, it } from 'vitest';
import { isValidIranianMobileInput, normalizeIranianMobileInput } from '../src/utils/iranian-mobile';

describe('Iranian mobile number entry in two-step registration', () => {
  it('accepts 11-digit Iranian mobile numbers in both OTP and account steps', () => {
    expect(isValidIranianMobileInput('09123456789')).toBe(true);
    expect(normalizeIranianMobileInput('09123456789')).toBe('09123456789');
  });

  it('normalizes Persian and Arabic numerals and common international formats', () => {
    for (const formatted of [
      '۰۹۱۲۳۴۵۶۷۸۹',
      '٠٩١٢٣٤٥٦٧٨٩',
      '+989123456789',
      '00989123456789',
      '989123456789',
      '۰۹۱۲ ۳۴۵ ۶۷۸۹',
      '0912-345-6789',
    ]) {
      expect(normalizeIranianMobileInput(formatted)).toBe('09123456789');
      expect(isValidIranianMobileInput(formatted)).toBe(true);
    }
  });

  it('rejects short numbers, landlines and excess characters', () => {
    for (const bad of ['', '0912345678', '091234567890', '02112345678', '0912345678x', '+9909123456789']) {
      expect(isValidIranianMobileInput(bad)).toBe(false);
    }
  });
});
