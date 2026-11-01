import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { checkPersianDocs, readableProse } = require('../scripts/check-persian-docs.cjs') as {
  checkPersianDocs: (value: string) => boolean;
  readableProse: (value: string) => string;
};

describe('استاندارد اجباری مستندات فارسی درس‌چین', () => {
  it('متن راهنمای فارسی همراه با نام API، کد و لینک انگلیسی را می‌پذیرد', () => {
    expect(checkPersianDocs([
      '# راهنمای اصلی فارسی درس‌چین',
      'این سند برای توسعه‌دهندهٔ ایرانی نوشته شده و مراحل آزمون و امنیت را توضیح می‌دهد.',
      '`bun run verify` و `DARSCHYN_DATA_DIR` باید به صورت معتبر حفظ شوند.',
      '[راهنمای توسعه](https://example.com/development)',
      '```bash',
      'npm run build',
      '```',
    ].join('\n'))).toBe(true);
  });
  it('اجازهٔ بازگشت یک مستند کامل به متن صرفاً انگلیسی را نمی‌دهد', () => {
    expect(checkPersianDocs('# Getting started\nAll official project documentation should be written in English.')).toBe(false);
  });
  it('فقط داشتن یک واژهٔ فارسی کنار بدنهٔ انگلیسی را کافی نمی‌داند', () => {
    expect(checkPersianDocs('# درس‌چین\nThis is a comprehensive English-only long developer guide '.repeat(15))).toBe(false);
  });
  it('کدهای فنی و آدرس‌های لینک را به عنوان متن انسانی برای سنجش زبان نمی‌شمارد', () => {
    const result = readableProse('توضیح فارسی [راهنما](https://example.com/english) و `someEnglishVariable`');
    expect(result).toContain('توضیح فارسی');
    expect(result).not.toContain('someEnglishVariable');
    expect(result).not.toContain('example.com');
  });
});
