# دو محیط مستقل برای درس‌چین — آزمایشی / اصلی

**طرح ۲۰۲۶/۱۰/۲۶** · وضعیت: کد و نمونهٔ محیط‌ها در مخزن، **بدون نصب روی VPS یا انتشار production**.

این طرح پس از مطالعهٔ **فقط‌خواندنی** `mohammadrezamie/tnacompany` و روش‌های `inplace-deploy.sh`، `release-deploy.sh`، `smoke-check.sh` و `DEPLOY_CONTRACT.md` آن ساخته شد. از Dry-run پیش‌فرض، SHA مشخص، بکاپ، جداسازی دادهٔ پایدار، تست سلامت و مفهوم rollback استفاده می‌کنیم؛ اسکریپت‌های Laravel/PHP/MariaDB را مستقیماً به Node/Express و JSON کپی نمی‌کنیم. **هیچ فایلی در مخزن تکین نوشته نشده است.**

## محیط‌ها

| مورد | staging (آزمایشی) | production (اصلی) |
| --- | --- | --- |
| داده‌ها | فقط ساختگی و پاک‌شدنی | فقط بعد از تأیید رسمی راه‌اندازی |
| سرویس | `darschyn-staging.service` | `darschyn.service` |
| گوش‌دادن | `127.0.0.1:3002` | `127.0.0.1:3001` |
| Release | `/opt/darschyn-staging/releases` | `/opt/darschyn/releases` |
| Symlink | `/opt/darschyn-staging/current` | `/opt/darschyn/current` |
| دیتا | `/var/lib/darschyn-staging` | `/var/lib/darschyn` |
| Env مستقل | `/etc/darschyn/staging.env` | `/etc/darschyn/darschyn.env` |

فایل پیکربندی مرجع `deploy/targets.json`، نمونهٔ systemd در `deploy/darschyn-staging.service.example` و قالب متغیرها در `deploy/.env.staging.example` هستند. کاربر لینوکس staging باید جدا از production باشد. در staging مقدار `NODE_ENV=production` عمداً فعال است تا محافظ‌های production آزموده شوند، **ولی دیتا و همهٔ credentialها جدا باشند**. پیش از راه‌اندازی روی VPS اشتراکی کم‌حافظه، اندازهٔ منابع و پورت‌ها باید جداگانه توسط اپراتور تأیید شوند. سرویس Node مستقیم به اینترنت باز نمی‌شود.

## فرمان‌ها، مستقل از GitHub Actions

```bash
bun run qa:full
FULL_SHA=$(git rev-parse HEAD)
# صرفاً طرح / Dry-run، بدون اجرای درخواست شبکه و بدون تغییر سرور
bun run deploy:gate --target staging --sha "$FULL_SHA"
# فقط پس از نصب دستی و مجازِ staging، GETهای read-only روی همان ماشین
bun run deploy:gate --target staging --sha "$FULL_SHA" --check
# بعد از استقرار دستیِ production، پیش از اعلام موفقیت همان SHA را
# نخست روی staging و سپس روی production کنترل می‌کند
bun run deploy:gate --target production --sha "$FULL_SHA" --check
```

`deploy:gate` **ابزار دیپلوی نیست**. بدون `--check` فقط مسیرها، SHA و حالت Dry-run را گزارش می‌کند و گزینهٔ `--apply` ندارد. با `--check` تنها درخواست GET به `127.0.0.1` می‌زند و در چند نوبت همزمانی نسخه، JSON health و JSON 404 برای مسیر ناشناختهٔ API را بررسی می‌کند. اگر staging قطع باشد، SHA متفاوت بدهد، HTML به‌جای JSON تحویل دهد یا هر پورت مشترک باشد، gate با کد خطای غیرصفر متوقف می‌شود. اجرای `--check` باید روی **ماشینی باشد که سرویس‌ها در loopback آن نصب شده‌اند**؛ اجرای آن در Sandbox جدا فقط با شبیه‌سازی در همان Sandbox می‌تواند همان محیط ساختگی را بررسی کند.

## روند پیشنهادی عملیاتی

1. در Sandbox یا کامپیوتر توسعه، SHA دقیق را بررسی و `bun run qa:full` (TypeScript، Vitest، Build، API smoke) را اجرا کن. **تست‌ها هرگز روی فایل دیتابیس واقعی اجرا نشوند**.
2. release را با نام SHA کامل، مستقل از دیتای پایدار بساز. سه عامل مهم: نصب قفل‌شده، خروجی build معتبر، و credential اختصاصی همان محیط. داده‌های کپی‌شده از production را به staging انتقال نده.
3. قبل از تغییر production، از **داده‌های خود درس‌چین** بکاپ محدود تهیه و restore آن را روی کپی موقت آزمون کن؛ ثبت SHA جاری و بازگشت به نسخهٔ سالم الزامی است. تغییر لینک release تنها بعد از build و تست، با rollback مستند و تأیید مالک باشد؛ دیتابیسِ احتمالا جدید را هرگز با rollback کد خودکار حذف/برگردان نکن.
4. ابتدا staging را با SHA آزمایش‌شده منتشر و gate staging را پاس کن؛ سپس در صورت تأیید مالک production را با **همان SHA** ارتقا بده و gate production را پاس کن.
5. صرفاً check HTTP نشانهٔ ثبات سیستم نیست. برای مشکل واقعی crash-loop پروندهٔ [#40](https://github.com/mohammadrezamie/DarsChin/issues/40) مرجع است. PR تاریخی #42 به علت تبار قدیمی بسته شده و هرگز نباید ادغام شود.

## محدودیت‌ها و مرزبندی

- **بدون دسترسی به VPS، هیچ ادعایی دربارهٔ نصب/رفع crash-loop/فعال‌بودن staging یا production واقعی مطرح نیست.** این PR فقط ابزار کنترل و فایل‌های نمونه اضافه می‌کند. ایجاد systemd، Nginx، DNS، TLS و استقرار production به تصویب جداگانهٔ مالک نیاز دارند.
- سرویس staging روی پورت ۳۰۰۲ فقط پیشنهاد پیکربندی است؛ پورت production مورد انتظار ۳۰۰۱ مطابق طراحی P0 است. نمونهٔ پیشنهادی شاخهٔ یکپارچه با قرارداد ۳۰۰۱ هماهنگ شده؛ پورت داخلی کانتینر ۳۰۰۰ باقی می‌ماند. **قبل از هر استقرار باید با پورت واقعی و تنظیمات موجود تطبیق داده شود.**
- Vercel Preview در معماری فعلی فقط Vite/frontend است؛ جای محیط staging کامل Express را نمی‌گیرد.
- تا زمانی که ذخیره‌سازی JSON تک‌پردازه‌ای است، هیچ‌کدام از این دو محیط نباید با چند Node روی **یک مسیر دیتا** کار کنند؛ secretها هم هرگز نباید مشترک باشند.
- اسکریپت `deploy:gate` نه کد/DB/ENV/Nginx تکین را تغییر می‌دهد و نه حتی مسیرهای آن را برای نوشتن باز می‌کند. این محدودیت با تست رگرسیون بررسی می‌شود.

## تکمیل گیت داخلی برای نسخهٔ یک — ۶ آذر ۱۴۰۵

پیگیری #16 و #155: در هر نمونهٔ health و JSON 404، تنظیمات `/api/security/challenge` نیز با قرارداد صحیح و `Cache-Control: no-store` بررسی می‌شود. درخواست فقط GET بدون نشست و بدون دنبال‌کردن redirect است. پاسخ یا خطای خام چاپ نمی‌شود. تا قبولی همهٔ نمونه‌های staging روی SHA یکسان هیچ بررسی production انجام نمی‌شود. تست‌های مصنوعی و سرورهای موقت loopback رفتار خطا/redirect را می‌سنجند. این ابزار هنوز صدور/مصرف CAPTCHA و پیامک واقعی یا نصب staging را تأیید نمی‌کند؛ عملیات سرور همچنان نیازمند مجوز است.

## هماهنگی قرارداد استقرار — ۶ آذر ۱۴۰۵

پیگیری #40: نمونه‌های systemd، Nginx و پورت میزبان Docker با targets.json یکسان شدند: production=3001، staging=3002، پورت داخلی کانتینر=3000. هر دو واحد systemd محدودیت تلاش مجدد، بررسی فایل اجرایی و مسیر دیتا و UMask=0077 دارند. نمونهٔ Nginx در حالت یک reverse proxy مستقیم، X-Forwarded-For را از آدرس واقعی اتصال می‌سازد و health را cache نمی‌کند. پشت CDN یا proxy دیگر، اعتماد به IP باید جداگانه طراحی و آزموده شود. نمونهٔ HTTP به معنی مجوز ارائهٔ فرم ورود بدون TLS نیست. گیت‌های جدید فقط تطبیق فایل‌های نمونه و قرارداد را می‌سنجند؛ systemd/Nginx واقعی، پورت آزاد، مالکیت مسیر، DNS، TLS، پایداری زمانی و سلامت تکین روی VPS بررسی نشده‌اند. تغییر تنظیمات موجود بدون اجازه ممنوع.

## مشاهدهٔ سلامت systemd و تشخیص restart — ۶ آذر ۱۴۰۵

گیت اصلاح نمونه‌ها [46001064926](https://github.com/mohammadrezamie/DarsChin/actions/runs/46001064926) روی `6cb6245e1a5bd276190f3e4490db59bb83bcf69d` موفق: ۱۸ Job، ۱۴۲ فایل و ۷۴۹ تست. پیگیری #40: گزینهٔ صریح `--check --systemd` در ابزار deploy:gate، فقط دو واحد مجاز درس‌چین را با systemctl show و فیلدهای غیرمحرمانه بررسی می‌کند. باید loaded/active/running/success، PID معتبر، شناسه invocation و شمار restart معتبر داشته باشند؛ قبل و بعد هر probe HTTP، ثبات PID، invocation، زمان active و شمار restart بررسی می‌شود. بین نمونه‌ها پنج ثانیه فاصله است؛ سه نمونه حداقل ده ثانیه مشاهده ایجاد می‌کنند. شکست staging مانع probe production می‌شود. بدون گزینهٔ systemd گیت فقط HTTP است و خروجی آن صریحاً همین را می‌گوید. هیچ journal یا ENV خوانده نمی‌شود، هیچ سرویس restart نمی‌شود. چهار آزمون مصنوعی برای parser، خروجی معیوب، restart با HTTP سالم و مشاهدهٔ ثابت اضافه شد. اجرای واقعی روی VPS مجاز، مشاهدهٔ طولانی‌تر طبق ظرفیت و پایش تکین همچنان ضروری است؛ ثبات کوتاه به معنی اثبات ثبات دائمی نیست.

نمونهٔ فرمان پس از نصب مجاز روی همان VPS: `bun run deploy:gate --target staging --sha "$FULL_SHA" --check --systemd --samples 10`. در صورت خطا از انتشار جلوگیری کنید؛ هیچ تغییر خودکار سرویس یا rollback داده انجام نشود.
