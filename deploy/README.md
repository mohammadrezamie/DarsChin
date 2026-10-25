# درس‌چین — راهنمای ایمن استقرار مستقل روی VPS مشترک

> **P0 / ۲۰۲۶-۱۰-۲۶: حادثهٔ Crash-loop هنوز باز است.** این فایل یک راهنمای مرحله‌بندی است، نه اجازهٔ نصب/انتشار و نه گزارش سالم‌بودن سرور. پروندهٔ اصلی: [SHARED_VPS_GITHUB_OPERATIONS_2026-10-26_FA.md](../docs/SHARED_VPS_GITHUB_OPERATIONS_2026-10-26_FA.md) و [Issue #40](https://github.com/mohammadrezamie/DarsChin/issues/40).

## وضعیت آخرین نصب و مرزبندی

- طبق آخرین گزارش ثبت‌شده، نسخهٔ **`5a6c51fe5e5453057d664b96f70ce35bd15879b6`** با ۱۹۷ از ۱۹۷ تست، TypeScript، build و smoke روی **ماشین توسعهٔ ایزوله** پاس شد؛ **این شواهد سلامت سرویس واقعی نیستند**.
- `darschyn.service` پس از نصبِ همان بسته، ۵۵ بار restart شد، listener پورت `127.0.0.1:3001` نداشت و health fail شد. علت اصلی تا زمان دریافت journalِ پاک‌سازی‌شده مشخص نیست. طبق [کامنت جدید Issue #40](https://github.com/mohammadrezamie/DarsChin/issues/40)، مالک فرمان `sudo systemctl disable --now darschyn` را اجرا کرد و خروجی حذف لینک راه‌اندازی خودکار دریافت شد؛ **ولی هنوز خروجی مستقل `systemctl is-active` برای اثبات حالت inactive ارائه نشده است**.
- ریلیزها: `/opt/darschyn/releases/<full-commit-sha>`، لینک فعال `/opt/darschyn/current`، کاربر `darschyn`، ENV مستقل `/etc/darschyn/darschyn.env`، دادهٔ پایدار `/var/lib/darschyn`.
- وب و ایمیل تکین روی این VPS با Nginx/PHP/MariaDB/Stalwart فعال‌اند. به `/var/www/tna`، سرویس‌های آن، DNS، Nginx، ایمیل، دیتابیس، secretها و پورت‌های `80/443` دست نزنید. در VPS مشترک **Caddy یا Docker proxy دوم نصب/اجرا نکنید**.
- فایل `deploy/darschyn.service.example` و `deploy/nginx-darschyn.conf.example` فقط **نمونهٔ اصلاح‌شده برای بررسی** هستند؛ جایگزینی کورکورانهٔ فایل فعلی systemd/Nginx ممنوع است. Installer اولیه که خارج از Git ساخته و روی سرور وصله شده، هنوز در این ریپو موجود نیست؛ ادعای versioned شدن آن نکنید و آن را دوباره روی نصب موجود اجرا نکنید.

## ۱. بررسی وضعیت P0 فقط به‌صورت خواندنی

پس از دسترسی مجاز اپراتور به سرور، بدون چاپ فایل ENV یا لاگ حساس:

```bash
sudo systemctl show darschyn -p ActiveState -p SubState -p NRestarts -p MainPID -p ExecMainStatus
sudo journalctl -u darschyn -n 80 --no-pager -o cat
sudo ss -ltnp | grep -E ':3001\\b' || true
```

**قبل از انتشار خروجی journal، هر مقدار حساس، شمارهٔ موبایل، token، مسیر محرمانه یا گذرواژه را حذف کنید.** اجرای ابزار تشخیص روی سرور نباید موجب restart هیچ سرویس شود. پس از بررسی، خطا را در Issue #40 با خلاصهٔ غیرحساس ثبت کنید. بازگشت سرویس به حالت فعال فقط پس از رفع ریشه‌ای مشکل، آزمایش کاربرِ کم‌دسترسی و اجازهٔ مالک انجام شود.

## ۲. بررسی کیفیت نسخه روی ماشین توسعهٔ جدا

Node.js 22+ و Bun با `bun.lock` لازم است:

```bash
bun run verify
bun run smoke:api
node --test scripts/check-vps-readiness.test.cjs
```

تست‌ها دادهٔ مصنوعی و ایزوله دارند. `verify` شامل تست‌های read-only گیت VPS، TypeScript، Vitest و build است؛ `smoke:api` فقط API نمونهٔ محلی را تست می‌کند. هیچ‌کدام به‌تنهایی نبود Crash-loop در systemd واقعی را ثابت نمی‌کنند. تعداد ۱۹۷ آزمون فقط متعلق به SHA بالا بوده است؛ برای هر SHA جدید باید خروجی آزمون همان SHA ثبت شود.

## ۳. نمونهٔ سرویس، فقط پس از تشخیص و اجازهٔ تغییر

- مسیر واقعی باینری Node را با `command -v node` تطبیق دهید؛ نمونه `/usr/bin/node` فرض می‌کند.
- `HOST=127.0.0.1`، `PORT=3001` و `DARSCHYN_DATA_DIR=/var/lib/darschyn` لازم‌اند. ENV نمونه **دادهٔ محرمانه ندارد**؛ مقادیر واقعی فقط در فایل ریشه‌ای `/etc/darschyn/darschyn.env` با مجوز محدود قرار گیرند.
- باینری `dist/server.cjs`، وابستگی‌های runtime و دارایی‌های `dist` باید در بستهٔ SHA-ثابت وجود داشته باشند و برای کاربر `darschyn` **قابل خواندن** باشند. دایرکتوری داده باید با همین کاربر و `ProtectSystem=strict` قابل نوشتن باشد؛ مسیر release نباید مجوز نوشتن روی داده یا ENV تکین بدهد.
- تغییرات systemd و فعال‌کردن Nginx/TLS نیازمند rollout/rollback برنامه‌ریزی‌شده، سلامت تکین قبل و بعد، بررسی RAM/CPU و تأیید مالک هستند. `Restart` با محدودیت Burst تنظیم شده تا یک خطای startup منجر به restart بی‌پایان روی VPS دوگیگابایتی نشود.

## ۴. گیت سالم‌بودن نسخهٔ **واقعاً نصب‌شده**؛ شکست پیش‌فرض

پس از اینکه اپراتور مجاز سرویس را با **فرایند انتشار کنترل‌شدهٔ خودش** روشن کرد، روی همان VPS:

```bash
node scripts/check-vps-readiness.cjs --sha 5a6c51fe5e5453057d664b96f70ce35bd15879b6 --port 3001
```

SHA فقط **مثال نسخهٔ ثبت‌شدهٔ حادثه** است؛ برای نسخهٔ جدید، SHA کامل بستهٔ تأییدشدهٔ همان انتشار را جایگزین کنید. اسکریپت هیچ تغییر سرویس یا پیکربندی انجام نمی‌دهد و با هر یک از موارد زیر کد خروج غیرصفر می‌دهد:

- `systemd` در حالت `active/running` نباشد یا PID معتبر نداشته باشد؛
- هیچ listener روی پورت وجود نداشته باشد، listener عمومی باشد یا بیش از یک listener دیده شود؛
- `/api/health` به‌جای JSON معتبر، خطا یا `releaseSha` اشتباه برگرداند؛
- PID یا شمارندهٔ restart در چند نوبت بررسی تغییر کند.

**فقط خروجی PASS این گیت (و تداوم سلامت در بازهٔ عملیاتی طولانی‌تر)** برای ادامهٔ انتشار قابل بررسی است؛ پیام `INSTALLED AND HEALTH CHECKED` ابزار نصب قبلی فاقد اعتبار بوده است. تا PASS معتبر، وب عمومی درس‌چین نباید فعال شود.

## ۵. مواردی که هنوز باید انجام شوند

علت اصلی Crash-loop با journal؛ بررسی واقعی مسیر/مجوز فایل‌ها و وابستگی‌های runtime؛ نسخه‌بندی و تست installer اصلی، کنترل و تأیید remote دو ریپو **به‌صورت مستقل و فقط خواندنی**؛ بکاپ و restore مستقل درس‌چین، صحت release SHA و هش بسته، rollback، تست سلامت طولانی‌مدت و TLS/کپچا. هیچ یک با نوشتن این راهنما انجام‌شده محسوب نمی‌شود.

سند استقرار عمومی پیشین [DEPLOYMENT.md](../docs/DEPLOYMENT.md) برای اصول rollback مفید است، اما **در صورت تعارض دربارهٔ VPS مشترک، این سند و قرارداد حادثهٔ P0 اولویت دارند**.
