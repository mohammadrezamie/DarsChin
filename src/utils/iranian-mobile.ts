/** Safe, display-friendly normalization for Iranian mobile inputs. */
export function normalizeIranianMobileInput(input: string): string {
  const ascii = input
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06F0))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\s\u200c\u200e\u200f\-()]/g, '');

  if (ascii.startsWith('+98')) return '0' + ascii.slice(3);
  if (ascii.startsWith('0098')) return '0' + ascii.slice(4);
  if (ascii.startsWith('98') && ascii.length === 12) return '0' + ascii.slice(2);
  return ascii;
}

export function isValidIranianMobileInput(input: string): boolean {
  return /^09\d{9}$/.test(normalizeIranianMobileInput(input));
}
