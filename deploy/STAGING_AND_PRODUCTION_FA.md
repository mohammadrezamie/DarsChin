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
5. صرفاً check HTTP نشانهٔ ثبات سیستم نیست. برای مشکل واقعی crash-loop و check systemd از P0 [PR #42](https://github.com/mohammadrezamie/DarsChin/pull/42) پس از بازبینی، تست و ادغام مستقل استفاده شود.

## محدودیت‌ها و مرزبندی

- **بدون دسترسی به VPS، هیچ ادعایی دربارهٔ نصب/رفع crash-loop/فعال‌بودن staging یا production واقعی مطرح نیست.** این PR فقط ابزار کنترل و فایل‌های نمونه اضافه می‌کند. ایجاد systemd، Nginx، DNS، TLS و استقرار production به تصویب جداگانهٔ مالک نیاز دارند.
- سرویس staging روی پورت ۳۰۰۲ فقط پیشنهاد پیکربندی است؛ پورت production مورد انتظار ۳۰۰۱ مطابق طراحی P0 است. نمونهٔ قدیمی `deploy/darschyn.service.example` روی `main` هنوز ۳۰۰۰ دارد و PR #42 آن را به‌روزرسانی می‌کند. **قبل از هر استقرار باید با پورت واقعی و تنظیمات موجود تطبیق داده شود.**
- Vercel Preview در معماری فعلی فقط Vite/frontend است؛ جای محیط staging کامل Express را نمی‌گیرد.
- تا زمانی که ذخیره‌سازی JSON تک‌پردازه‌ای است، هیچ‌کدام از این دو محیط نباید با چند Node روی **یک مسیر دیتا** کار کنند؛ secretها هم هرگز نباید مشترک باشند.
- اسکریپت `deploy:gate` نه کد/DB/ENV/Nginx تکین را تغییر می‌دهد و نه حتی مسیرهای آن را برای نوشتن باز می‌کند. این محدودیت با تست رگرسیون بررسی می‌شود.
