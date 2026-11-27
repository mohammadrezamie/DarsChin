import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const check = readFileSync('src/components/GuestHumanCheck.tsx','utf8');
const login = readFileSync('src/pages/auth/Login.tsx','utf8');

describe('حفاظت و شفافیت کپچا در رابط ورود',()=>{
  it('خطای دریافت تنظیمات را به عنوان عدم دسترسی واقعی نشان می‌دهد',()=>{
    expect(check).toContain('سرویس صدور کد امنیتی در دسترس نیست');
    expect(check).toContain('setConfigError(true)');
    expect(check).toContain('setSettings(null)');
    expect(check).toContain('از مسیر دمو استفاده کنید');
  });
  it('پیش از نمایش تصویر یا پس از شکست آن پاسخ قابل ارسال نیست',()=>{
    expect(check).toContain('disabled={!imageLoaded}');
    expect(check).toContain("onError={() => { onToken('')");
    expect(check).toContain('onLoad={() => { setImageLoaded(true)');
    expect(check).toContain("const refresh = () => { onToken('')");
  });
  it('درخواست ورود بدون پاسخ و تغییر شماره با پاسخ قبلی مسدود است',()=>{
    expect(login).toContain('if (!captchaToken)');
    expect(login).toContain('disabled={isLoading || !captchaToken}');
    expect(login).toContain("setCaptchaToken(''); setCaptchaAttempt(n => n + 1)");
  });
  it('بارگذاری سرویس بیرونی بدون توقف نامحدود و بدون عبور ساختگی است',()=>{
    expect(check).toContain('window.setTimeout(fail, 15000)');
    expect(check).toContain('script.remove()');
    expect(check).not.toContain('dangerouslySetInnerHTML');
  });
});
