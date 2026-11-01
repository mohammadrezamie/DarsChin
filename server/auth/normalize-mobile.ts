/**
 * Normalize Iranian mobile numbers accepted by the authentication API.
 * This is formatting normalization only; the schema still validates the final shape.
 */
export function normalizeIranianMobile(value: string): string {
  let cleaned = value.trim();
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

  cleaned = cleaned.replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)));
  cleaned = cleaned.replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)));
  cleaned = cleaned.replace(/[\s\-_]/g, '');

  if (cleaned.startsWith('+98')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.startsWith('0098')) cleaned = '0' + cleaned.slice(4);
  else if (cleaned.startsWith('98') && cleaned.length === 12) cleaned = '0' + cleaned.slice(2);
  else if (cleaned.startsWith('9') && cleaned.length === 10) cleaned = '0' + cleaned;

  return cleaned;
}
