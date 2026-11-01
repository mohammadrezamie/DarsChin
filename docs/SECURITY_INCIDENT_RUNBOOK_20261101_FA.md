# پیگیری سه‌گانهٔ امنیت مخزن عمومی درس‌چین — ۱ نوامبر ۲۰۲۶

> **طبقه‌بندی:** این سند عمومی است. هیچ رمز، بازیابی، شمارهٔ دانشجو، هش، توکن یا محتوای دیتابیس حساس نباید به آن، به Issues یا به PRها اضافه شود. مخزن Public است، اما پروندهٔ افشای تاریخی هنوز بسته نشده است.

## ۱) ارجاعات تاریخی GitHub و پاک‌سازی افشا

- در بازبینی امروز `main` در آغاز روی `8bec8d0` قرار داشت و دیتابیس runtime قبلی و اسکریپت‌های اجرایی `scripts/legacy` در Tree فعلی آن نبودند.
- ۲۲ شاخهٔ باقی‌ماندهٔ غیر از main از طریق Compare API با `main` بررسی شدند؛ همه از تاریخچهٔ بازسازی‌شدهٔ مشترک منشعب‌اند. **این فقط بررسی ancestry است** و جایگزین اسکن محتوای همهٔ Git objects یا GitHub PR refs نیست.
- GitHub metadata برای **۷ PR بسته و ادغام‌نشدهٔ قدیمی**: #27، #28، #29، #37، #42، #56 و #71 هنوز قابل دریافت است؛ وجود آن‌ها **اثبات حذف دادهٔ تاریخی نیست**. وضعیت cached diff و refهای داخلی باید توسط GitHub بررسی شود.
- تاریخچهٔ معمولِ شاخه‌ها قبلاً بازسازی شده، اما هنوز نمی‌توان گفت `refs/pull/*`، forkها، cacheها و cloneهای مستقل عاری از دادهٔ حساس هستند.

**اقدام مالک در GitHub Support** (فقط پس از بررسی وضعیت واقعی و تهیهٔ شواهد امن):
1. در [GitHub Support](https://support.github.com/) درخواست **Removing sensitive data from a repository / purge historical PR references and cached views** باز کنید؛ Repo: `mohammadrezamie/DarsChin`.
2. توضیح دهید فایل دیتابیس عملیاتی و اسکریپت‌های رمزدار، به‌طور ناخواسته در تاریخچهٔ عمومی قدیم وجود داشته‌اند؛ فقط نام مسیرها و شناسهٔ PRها را بدهید، **نه مقادیر یا عکس رکوردها**.
3. هفت PR فوق را به‌عنوان موارد شناخته‌شده معرفی کنید و درخواست بررسی PRهای دیگر، cache و آرشیوهای مرتبط را بدهید. تعداد واقعی affected PR را GitHub تأیید کند.
4. اگر Support درخواست **First Changed Commit(s)** یا گزارش `git-filter-repo` داد، تنها خروجی واقعی بازنویسی را از یک محیط امن فراهم کنید. **SHA یا گزارش ساختگی نسازید.**
5. صرفاً بعد از تأیید Support و ممیزی forkها/cloneها، وضعیت حادثه را بسته اعلام کنید. حذف PR cache ممکن است نمایش diffهای قدیمی را هم از بین ببرد.

مرجع: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository

## ۲) Credential و نشست‌های عملیاتی

وضعیت: **تعویض/ابطال روی سرور انجام نشده است**. این کار بدون دسترسی و تصمیم مالک نصب زنده قابل تأیید نیست.

- رمز Root و recovery verifier، کلید امضای JWT، کلید سرویس SMS/OTP، Turnstile و هر کلید دیگری که واقعاً افشا شده یا استفاده شده است باید در محیط اپراتور ارزیابی و در صورت لزوم rotate/revoke شود.
- Reset رمز تنها به‌تنهایی JWTهای قدیمی را باطل نمی‌کند، مگر `sessionVersion` افزایش یابد یا `JWT_SECRET` تعویض شود؛ طبق برنامهٔ استقرار تازه، DB، ENV و sessionهای جدید بسازید.
- قبل از اقدام روی VPS: بکاپ رمزنگاری‌شده و تأییدشدهٔ خارج از Git، بررسی وابستگی سرویس‌ها، و تصمیم برای نصب تازه. هیچ دستور حذف یا اتصال مجدد روی سرور فعلی خودکار اجرا نشده است.
- تغییر کد این مرحله: هنگام شکست ذخیرهٔ ثبت‌نام/تغییر رمز/OTP recovery، بازگردانی امن state در حافظه و بازگشت 500 بدون افشای error؛ تست‌های تخریبی فقط روی دیتای مصنوعی.

## ۳) تنظیمات حفاظتی GitHub

- `GET /rulesets` در زمان بررسی **آرایهٔ خالی** برگرداند. جزئیات branch protection به دلیل محدودیت دسترسی Integration قابل خواندن نبود؛ بنابراین وجود یا عدم وجود دیگر انواع protection قطعی تأیید نشده است.
- اتصال موجود اجازهٔ **نوشتن Settings/Ruleset و چرخش Secrets** نمی‌دهد. تغییرات لازم باید از حساب مالک GitHub اعمال شوند.
- از Repository → **Settings → Rules → Rulesets**، برای `main` محافظ فعال بسازید: الزام PR، الزام status check با نام دقیق **`Typecheck / Tests / Build`**، ممنوعیت force-push و deletion و منع bypass ناخواسته. در حالت کم‌مصرف CI، به اجبار `up-to-date` بودن هر شاخه فکر کنید چون rerun اضافی ایجاد می‌کند.
- از Settings → **Advanced Security**، امکان Secret scanning، Push protection و Private vulnerability reporting را طبق دسترسی حساب روشن/بازبینی کنید؛ فقط وجود فایل SECURITY.md این تنظیمات را فعال نمی‌کند.
- workflow فعلی از `permissions: contents: read` استفاده می‌کند و Checkout اعتبارنامه را persist نمی‌کند. حتماً تست روی SHA دقیق PR قبل از Merge و روی main پس از Merge بررسی شود.

مراجع:
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository
- https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository

## مرز پایان کار

**کد و تست سبز ≠ پاک‌شدن کامل افشای گذشته ≠ ایمن‌بودن استقرار زنده.** برای خاتمهٔ پروندهٔ Public، شواهد GitHub Support، وضعیت نهایی Credentialها و حفاظت شاخه‌ها را به‌صورت جداگانه ثبت کنید. اتصال سرور فعلی، دیتابیس تولید، داده‌های تکین، قوانین معارف و PRهای تاریخی را تغییر ندهید.
