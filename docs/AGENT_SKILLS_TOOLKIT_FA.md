# جعبه‌ابزار مهارت‌های توسعهٔ درس‌چین — ۵ آذر ۱۴۰۵

## تصمیم مالک OWN-SKILLS-021

مالک اجازهٔ خواندن کل مخزن تکین به‌صورت فقط‌خواندنی و انتقال مهارت‌های موردنیاز به درس‌چین را صادر کرد. این مجوز شامل نوشتن در تکین، انتقال دادهٔ خصوصی، راز، زیرساخت، یا نصب ابزار اجرایی نیست. پیش‌فرض فارسی و قوانین امنیتی درس‌چین مقدم‌اند.

درخت `main` تکین در SHA `382891f72ed0c86fd8519a20f88feea553fe5113` بررسی شد: ۵۴ نام متمایز مهارت در سه مسیر `.agents/skills`، `.claude/skills` و `.github/skills` (۱۶۲ فایل SKILL). این شمارش فهرست است، نه ادعای بررسی کامل تک‌تک محتواها یا یکسان‌بودن تمام نسخه‌ها. نسخهٔ درس‌چین فقط در `.agents/skills` نگهداری می‌شود تا سه نسخهٔ مستقل ناسازگار ایجاد نشود.

## بستهٔ انتخاب‌شده

| مهارت درس‌چین | منشأ در تکین | کاربرد |
| --- | --- | --- |
| [طراحی بصری](../.agents/skills/darschin-visual-design/SKILL.md) | frontend-design، tna-theme-day-night، tna-ux-journeys | طراحی مینیمال دانشگاهی و تم |
| [موبایل و دسترس‌پذیری](../.agents/skills/darschin-mobile-accessibility/SKILL.md) | tna-accessibility-audit، tna-mobile-brand-app-shell، tna-persian-english-typography | ناوبری، RTL، کنتراست و فوکوس |
| [آزمون مرورگر](../.agents/skills/darschin-browser-qa/SKILL.md) | tna-e2e-browser-qa، tna-playwright-cli-exploration، tna-motion-gpu-performance-qa | مسیر واقعی نقش‌ها و شواهد موبایل |
| [امنیت](../.agents/skills/darschin-security-review/SKILL.md) | tna-static-security-audit، tna-safe-dependencies-update | کنترل مجوز، دادهٔ خصوصی، رگرسیون |
| [گیت کیفیت](../.agents/skills/darschin-quality-gate/SKILL.md) | tna-free-local-ci، tna-safe-dependencies-update | گیت SHA، وابستگی‌ها و محیط مصنوعی |
| [بارگذاری فونت](../.agents/skills/font-loading-and-performance/SKILL.md) | font-loading-and-performance | متن قابل مشاهده، WOFF2 و CLS |
| [تایپوگرافی بین‌المللی](../.agents/skills/international-typography/SKILL.md) | international-typography | فارسی، RTL و متن دوجهته |

پنج مهارت اختصاصی، راهنمای تازه و فارسی با اقتباس مفهومی از مهارت‌های تکین‌اند؛ دستورهای خاص Laravel، Filament، برند، زیرساخت و انگلیسی‌نویسی منتقل نشده‌اند. دو مهارت عمومی دارای مجوز MIT از [مخزن بالادستی typography-skills](https://github.com/jpoindexter/typography-skills) در نسخهٔ `615006a142464d1a5abfa16304fbafa5e2ffef20`، با متن اصلی بدون تغییر در UPSTREAM.md و فایل LICENSE همسایه منتقل شده‌اند. SKILL.md فارسی، نقطهٔ ورود محلی است؛ متن انگلیسی فقط مرجع بالادستی است. هیچ فایل فونت یا باینری منتقل نشده است.

## استفادهٔ عملی

برای کار طراحی هر دو مهارت بصری و دسترس‌پذیری، برای تغییر فارسی یا فونت مهارت‌های تایپوگرافی، برای تغییر رفتار مرورگر مهارت QA، و برای API/داده/وابستگی مهارت امنیت و گیت کیفیت را قبل از تغییر بخوانید. مهارت به معنی ابزار اجرایی نصب‌شده نیست. اگر محیط ابزار کشف خودکار مهارت‌ها ندارد، فایل SKILL.md به صورت دستی خوانده شود. برای پذیرش ظاهری، پیش‌نمایش SHA دقیق و مرور واقعی ضروری است.

مهارت‌های Laravel/Filament، SEO/تحلیل بازاریابی، سه‌بعدی و ابزارهای خاص تکین فعلاً منتقل نشده‌اند؛ فقط در صورت نیاز واقعی، سازگاری و مجوز مناسب بررسی می‌شوند. هیچ SDK یا پکیج جدید نصب نشده است.

## پذیرش و بازگشت

وجود هفت SKILL.md، فرادادهٔ یکتا، مجوز دو مرجع، ثبت در AGENTS و دفتر تصمیمات بررسی شود. گیت واقعی مخزن و کشف خودکار در محیط عامل پس از ادغام هنوز تأیید نشده‌اند. هیچ تغییر کد محصول، API، VPS، داده یا مخزن تکین در این PR وجود ندارد. بازگشت با Revert PR.
