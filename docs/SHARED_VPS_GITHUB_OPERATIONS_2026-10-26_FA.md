# قرارداد دائمی اتصال GitHub و استقرار مستقل درس‌چین کنار تکین — ۲۶ اکتبر ۲۰۲۶

**دستور مستقیم مالک / P0:** هر دو ریپوی `mohammadrezamie/tnacompany` و `mohammadrezamie/DarsChin` می‌توانند روی *همان* VPS باشند، اما کد، ریلیز، دیتابیس، کلید، مسیر، سرویس و عملیات انتشارشان باید تفکیک شود. اتصال GitHub به معنی استقرار خودکار نیست. مستند متناظر در [ریپوی تکین](https://github.com/mohammadrezamie/tnacompany/issues/386) و [Issue درس‌چین #40](https://github.com/mohammadrezamie/DarsChin/issues/40).

## وضعیت واقعی تأییدشده و محدودیت‌ها

- **تکین، سرویس فعلی:** `/var/www/tna`، Laravel/PHP 8.3-FPM، MariaDB، Nginx مالک 80/443 و Stalwart ایمیل. در خروجی نصب اخیر nginx/php8.3-fpm/mariadb/stalwart/ssh/fail2ban همگی active؛ `https://tnacompany.ir/` کد 200 و `https://mail.tnacompany.ir/` کد 302 دادند. صحت بلندمدت یا مستقل بودن کامل هنوز به آزمایش جداگانه نیاز دارد.
- **درس‌چین، ریلیز نصب‌شده:** `/opt/darschyn/releases/5a6c51fe5e5453057d664b96f70ce35bd15879b6`، symlink `/opt/darschyn/current`، کاربر `darschyn`، سرویس `darschyn.service`، تنظیمات `/etc/darschyn/darschyn.env`، دیتابیس مستقل `/var/lib/darschyn`، لوپ‌بک `127.0.0.1:3001`. از **بسته انتقال‌یافته** نصب شد، نه از `git pull`؛ clone/remote یا auto-deploy درس‌چین روی VPS مشاهده یا تأیید نشده است.
- **کیفیت محلی:** Windows + Bun 1.4.4، SHA `5a6c51fe5e5453057d664b96f70ce35bd15879b6`، TypeScript، ۱۹۷ از ۱۹۷ Vitest، build و API smoke ایزوله موفق. SHA256 بسته روی ویندوز/سرور: `de8e29aa5aee13b2f86dbeb0b269e32fde3c3bd1535376d6b1a8be370169da4b`. [PR #39](https://github.com/mohammadrezamie/DarsChin/pull/39) مرج‌شده.
- **حادثه باز P0:** بعد از نصب، وضعیت `NRestarts=55`، `activating / auto-restart`، بدون listener پورت 3001 و `curl: (7) connection refused`. بنابراین سرویس **راه‌اندازی سالم ندارد**. پیام «INSTALLED AND HEALTH CHECKED» اسکریپت قبلی اشتباه بود، چون آزمون سلامت فقط وقتی اجرا می‌شد که پورت شنود می‌کرد. علت Crash **بدون journal قطعی نیست**. وضعیت `systemctl disable --now darschyn` باید توسط اپراتور روی سرور اعمال/تأیید شود؛ هنوز تأیید آن دریافت نشده است.

## قواعد غیرقابل دورزدن استقرار هم‌سروری

1. GitHub دو پروژه مستقل بماند: هیچ hook، GitHub Action، cron یا `git pull` خودکار روی VPS بدون آزمون، بررسی SHA، تأیید مالک و قابلیت برگشت تنظیم نشود. ادغام PR مساوی Deploy نیست.
2. انتشار تکین **فقط از فرایند `tna-deploy` با مجوز مالک**، در محدوده خودش. انتشار درس‌چین **فقط از بسته SHA-ثابت** با کنترل هش و بازبینی مستقل. هیچ Deploy درس‌چین در `/var/www/tna` و هیچ Deploy تکین در `/opt/darschyn`.
3. `/etc/darschyn`، `/var/lib/darschyn`، کاربران و دسترسی‌ها از `.env` و MariaDB تکین کاملاً جدا؛ از JWT، SMTP، SMS و `APP_KEY` مشترک استفاده نشود. هیچ رمز/ENV/log حساس در GitHub یا خروجی عمومی قرار نگیرد.
4. سرویس Node فقط `127.0.0.1:3001`؛ Nginx تکین فعلاً بدون تغییر. پورت‌های 80/443 به Caddy/Docker دیگری داده نشود. دامنه عمومی درس‌چین بعداً فقط با vhost مستقل و آزمون `nginx -t` و TLS.
5. پشتیبان‌گیری، بازگردانی تست‌شده، health check قبل/بعد و محدودیت CPU/RAM/IO الزامی‌اند؛ VPS دوگیگابایتی نقطهٔ شکست مشترک دارد و ایزولاسیون فایل به معنی تضمین بدون‌تداخل منابع نیست.
6. قبل از موفق‌نامیدن نصب، `systemctl is-active darschyn` باید دقیقاً `active`، `SubState=running`، listener منحصراً `127.0.0.1:3001`، JSON سلامت `status=ok` و `releaseSha` برابر SHA مطلوب باشد. حداقل چند بازه بررسی پایداری/عدم افزایش restart لازم است. اگر موفق نشد، **Fail closed** و بدون فعال‌کردن وب عمومی.
7. لاگ خطا/وضعیت را بدون چاپ رمز جمع‌آوری کنید. تشخیص پیشنهادی روی VPS: `sudo journalctl -u darschyn -n 80 --no-pager -o cat` و `sudo systemctl show darschyn -p ActiveState -p SubState -p NRestarts -p ExecMainStatus`. لاگ را پیش از اشتراک، از لحاظ secret بررسی/پاک‌سازی کنید.
8. اولین نسخه installer به‌صورت فایل Bash خارج از Git به VPS منتقل و در همان سرور برای سازگاری npm11/Bun وصله شد. **اسکریپت اصلاح‌شده هنوز در GitHub version نشده**؛ قبل از استفاده مجدد باید به پوشه deploy انتقال و با fail-closed health gate و بازیابی معتبر تست شود. نصب‌کنندهٔ first-time را مجدد روی مسیرهای جاری اجرا نکنید.
9. برای کنترل اتصال GitHub هر ریپو، remote/commit سرویس را جدا و **read-only** بررسی کنید؛ برای درس‌چین فعلاً release manifest و SHA داریم و checkout گیت نداریم. تأیید نشده است که `/var/www/tna` واقعاً origin معادل `mohammadrezamie/tnacompany` دارد؛ صرف وجود checkout Git کافی نیست. از چاپ آدرس حاوی توکن در لاگ خودداری کنید.

## روند رفع حادثه و معیار بستن P0

- مهار: توقف و غیرفعال‌سازی موقت فقط `darschyn.service`؛ تکین/ایمیل نباید restart شوند. مسیر داده، تنظیمات خصوصی و ریلیز حفظ شوند.
- تشخیص: خروجی journal، status و path permissions بررسی شود؛ اصلاح در ریپوی درس‌چین (issue/PR/Local Gate)، نه با patch غیرقابل‌ردیابی در تکین.
- پذیرش: اجرای سالم Node در context سرویس محدودشده، status پایدار + localhost health + برابر بودن SHA، آزمون بقای داده در راه‌اندازی مجدد، و تست TNA web/mail. سپس اتصال GitHub به شیوه **کنترل‌شده و مستقل** مستندسازی و با مجوز مالک اجرا شود.
- موارد باز: خطای اصلی startup، وصله نسخه‌بندی‌شده installer، rollback/restore، اتصال remote سرور، کپچا/TLS/داده واقعی. **تا رفع‌شان ادعای Production ready ممنوع.**
