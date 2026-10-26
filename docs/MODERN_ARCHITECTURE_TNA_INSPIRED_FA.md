# معماری مدرن درس‌چین با الگوگیری امن از تکین — ۲۰۲۶/۱۰/۲۶

**درخواست مالک / OWN-041:** از معماری تکین در طراحی سامانه، جداسازی لایه‌ها، امنیت، دیپلوی و کنترل کیفیت الگو بگیریم، اما درس‌چین از نظر ظاهری **مستقل، مدرن‌تر، سریع و mobile-first** باشد. مطالعهٔ مخزن `mohammadrezamie/tnacompany` فقط **read-only** است؛ هیچ تغییری در آن مجاز نیست.

## تصمیم فنی

**React 19 + TypeScript + Vite + Tailwind CSS 4 + Bun/Vitest + Express** را فعلاً حفظ می‌کنیم. زبان/فریم‌ورک «جدیدتر» به‌تنهایی ارزش مهاجرت، اختلال در پنل مدیریت، سوابق تحصیلی و قوانین انتخاب واحد را ندارد. React و CSS فعلی امکان lazy routes، Suspense، Motion با reduced-motion، tokenized dark/light themes و responsive container queries را دارند. معماری تکین مبتنی بر Laravel را به‌صورت **الگوهای مستقل** قرض می‌گیریم، نه ماژول یا PHP آن را.

آنچه صرفاً در تکین **خواندیم**: تفکیک controllers/services/middleware، هدرهای امنیتی، توکن‌های UI، حرکت‌های بصری با رعایت حالت روشن/تاریک، دسترس‌پذیری، local gates، تفکیک staging/production، release SHA، rollback و smoke. **از کپی افکت‌های سنگین، انیمیشن دائمی و فریم‌ورک Laravel در درس‌چین خودداری می‌کنیم.**

## لایه‌های هدف

| لایه | مسئولیت و قرارداد |
| --- | --- |
| تجربه/طراحی | توکن‌های CSS مستقل درس‌چین، تایپوگرافی محلی فارسی، mobile-first، container queries، skeletonهای محترم به reduced-motion، دمو قابل‌استفاده در ۳۲۰px |
| کلاینت | route-level React Suspense + ErrorBoundary و بازیابی بدون پاک‌کردن دادهٔ دانشجو؛ UI بر مبنای دسترس‌پذیری و حالت‌های خطای قابل‌بازیابی |
| API | Express routes → middleware مرکزی (احراز هویت، مجوز، امنیت HTTP) → schema validation → service/contract؛ هیچ کد خصوصی به مرورگر نرود |
| دامنه | موتور واحد قوانین آموزشی، تداخل، تقاضا و برنامه‌ریزی مستقل از افزونه/پورتال؛ از بازنویسی قوانین تأییدنشده پرهیز شود |
| داده | در کوتاه‌مدت یک Node + JSON file با backup/restore آزمایشی؛ برای مقیاس و عملیات چندکاربره، اول benchmark و طرح مهاجرت تدریجی به پایگاه‌دادهٔ transactional، بدون وعدهٔ جابه‌جایی زودهنگام |
| دیپلوی | `qa:full` مستقل از Actions، staging و production جدا، تطبیق SHA، health و بازگشت؛ بدون دست‌زدن به سرور مشترک پیش از رفع P0 crash-loop |

## فاز اجرا

**فاز A — اکنون (این PR):** محافظ مرکزی HTTP مثل `nosniff`، policy محافظه‌کار CSP، رد ذخیرهٔ cache دادهٔ خصوصی، ErrorBoundary قابل‌بازیابی و landmark اصلی، Suspense skeleton، توکن‌های جدید رنگ و design، container-query برای دمو، تست‌های رگرسیون. تغییر در مسیرها/حساب‌ها/قوانین آموزشی ندارد.

**فاز B — اولویت محصول پیش از لانچ:** شکستن componentهای بزرگ دانشجو/مدیر به feature modules، استفاده از typed API contract و validation یکدست، loading/error/empty states، تمرکز روی **نیازسنجی قابل‌اعتماد** و گزارش تفکیکیِ ورودی‌ها. افزودن ابزار مدیریت خطا و دادهٔ عملیاتی بدون افشای PII؛ strict authorization در سمت سرور.

**فاز C — پس از پایدارشدن MVP:** تست واقعی Playwright در ۳۲۰/۳۶۰/۳۹۰/۴۳۰/۷۶۸/۱۰۲۴/۱۴۴۰؛ performance budget برای LCP/INP/CLS، ارزیابی React Compiler پس از پروفایل واقعی، کیفیت انیمیشن‌های کوتاه و قابل‌لغو، امکان PWA/Offline **فقط برای داده‌های غیرحساس و بدون cache توکن/سوابق**؛ معماری shared persistence و transactional DB پس از اندازه‌گیری concurrency.

**ممنوعیت:** ثبت اطلاعات رسمی دانشگاه بدون منبع معتبر، تغییر موتور قوانین آموزشی با حدس، تغییر تکین/TNA، انتقال اسرار واقعی به Sandbox، انتشار production یا نشان‌دادن Vercel frontend به‌عنوان بک‌اند کامل. React/ErrorBoundary رویدادهای async را خودکار نمی‌گیرد؛ API error handling جدا حفظ می‌شود. CSP فقط بخش‌های کم‌ریسک را محدود می‌کند و «CSP کامل» هنوز نیازمند ممیزی افزونه و مسیرهای خارجی است.

## پذیرش و شواهد

- `bun run qa:full` با خروجی واقعی و SHA دقیق، یا در صورت محدودیت ماشین حداقل Vitest/TypeScript ایزوله با افشای شکاف تأیید.
- آزمون Request/Response واقعی برای HTTP headers و عدم cache API؛ تست UI برای وجود ErrorBoundary، skeleton و container CSS.
- در اجراهای بصری باید تطبیق رنگ، کنتراست، keyboard navigation، reduced-motion و عدم اسکرول افقی بررسی شوند.
- وضعیت این سند: **طراحی و کد فاز A روی PR شاخهٔ توسعه، انتشار production انجام نشده**. گیت و SHA در متن PR به‌روز شوند.

## منابع رسمی برای الگوها

- React Error Boundary: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- CSS container queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_size_and_style_queries
- Motion accessibility: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion
