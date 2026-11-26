import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const hero = readFileSync(resolve(process.cwd(), 'src/pages/landing-sections/HeroSection.tsx'), 'utf8');
const managerSection = readFileSync(resolve(process.cwd(), 'src/pages/landing-sections/DashboardShowcaseSection.tsx'), 'utf8');

describe('پیام روشن صفحهٔ اول درس‌چین', () => {
  it('در چند ثانیه مسیر اصلی دانشجو را توضیح می‌دهد', () => {
    expect(hero).toContain('قبل از انتخاب واحد،');
    expect(hero).toContain('مسیر ترمت را روشن کن');
    expect(hero).toContain('چارت متناسب با رشته و ورودی‌ات را ببین');
    expect(hero).toContain('وضعیت و پیش‌نیاز درس‌ها را بفهم');
    expect(hero).toContain('از نظر تداخل مقایسه کن');
    expect(hero).toContain('دیدن نمونهٔ پنل دانشجو');
  });

  it('مسیر مدیر گروه را جدا و واضح معرفی می‌کند', () => {
    expect(hero).toContain('ویژهٔ مدیران گروه و مدیران آموزشی');
    expect(hero).toContain('href="#workspaces"');
    expect(managerSection).toContain('id="workspaces"');
  });

  it('هیچ ادعای اتصال/ثبت خودکار یا نام درگاه منسوخ در لندینگ ندارد', () => {
    expect(hero).not.toContain('آموزشیار');
    expect(hero).not.toContain('ثبت خودکار');
    expect(hero).toContain('درس‌چین جایگزین درگاه رسمی دانشگاه نیست');
    expect(hero).toContain('داده‌های آزمایشی');
  });
});
