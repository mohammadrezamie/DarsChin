# SEO فنی، محتوای عمومی و تجربهٔ ورود به درس‌چین

**تاریخ:** ۲۰۲۶/۱۰/۲۸  
**دامنهٔ تغییر:** فقط `mohammadrezamie/DarsChin` و QA ایزوله. **هیچ ریپوی دیگری، VPS، DNS یا اکانت واقعی تغییر نمی‌کند.**  
**وضعیت:** تغییر کد در PR اختصاصی؛ ادعای ایندکس‌شدن یا رتبه‌گرفتن بدون Search Console مطرح نمی‌شود.

## مسئلهٔ واقعی و هدف

قبل از این تغییر، برنامهٔ React/Vite برای همهٔ صفحه‌ها HTML اولیه با عنوان/توضیح یکسان می‌فرستاد؛ داشبورد، صفحهٔ مدیر، حساب‌ها و دموی ساختگی در پاسخ HTTP اولیه سیاست `noindex` مشخص نداشتند. صفحهٔ اصلی نیز راهنمای متنی مستقل از JavaScript برای جست‌وجوگرهای فارسی نداشت.

هدف: **کاربر اول بتواند بفهمد درس‌چین چه می‌کند، دمو را بدون حساب امتحان کند و بعد انتخاب آگاهانه داشته باشد**؛ موتور جست‌وجو هم باید فقط محتوای عمومی مرتبط با این تجربه را ببیند.

## قابلیت‌های اعمال‌شده

| بخش | نتیجه |
| --- | --- |
| صفحهٔ اصلی | بخش سه‌مرحله‌ایِ RTL و mobile-first، کارت‌های عملیاتی، چهار سؤال بازشونده با `details/summary` استاندارد و دکمه‌های رفتن به دمو و راهنمای کامل؛ بدون ادعای انتخاب واحد خودکار |
| راهنمای انتخاب واحد | `/guide/` یک HTML مستقل، قابل‌خواندن **بدون اجرای React/JS**، با H1/H2، چک‌لیست شش‌موردی، مثال ساختگی، FAQ و فونت فارسی محلی؛ فاقد اطلاعات ساختگی‌نمایانده‌شده به‌عنوان قوانین رسمی |
| React SPA | `RouteHead` عنوان، توضیح، OG و robots را با هر تغییر مسیر همگام می‌کند؛ بدون ساخت canonical از Host یا Preview؛ اطلاعات خصوصی/دمو `noindex` |
| Express production | خروجی HTML هر مسیر title/description/OG/robots دقیق و مسیر ناشناخته HTTP 404 است؛ dashboard/admin/login/register/demo هدر `X-Robots-Tag: noindex, nofollow, noarchive` و عدم cache دارند |
| Vercel static | مسیرهای خصوصی و دمو از طریق `vercel.json` هدر `noindex` می‌گیرند، حتی اگر JS مرورگر اجرا نشود؛ مسیرهای تکراری راهنما/HTML به مقصد اصلی redirect می‌شوند |
| Sitemap/robots | `robots.txt` عمومی بدون لو دادن API و `sitemap.xml` **تنها با دامنهٔ عمومی معتبر** شامل `/` و `/guide/` (بدون حساب/دمو/پنل) |
| Metadata | `WebSite` JSON-LD فقط روی صفحهٔ اصلیِ Express، با Site URL معتبر؛ از `FAQPage` ساختگی و ادعای Rich Result پرهیز شده |

## اتصال دامنهٔ واقعی: قبل از ایندکس

- کلید محیط مستقل درس‌چین: `DARSCHYN_PUBLIC_SITE_URL=https://<actual-domain>`، **صرفاً HTTPS و origin بدون path/query**. مقدار واقعی باید پس از مشخص‌شدن دامنه توسط مالک تنظیم شود. هیچ دامنه‌ای اینجا حدس زده نشده است.
- روی Express: `GET /robots.txt` لینک Sitemap و `GET /sitemap.xml` تنها با این تنظیم معتبر خواهد بود؛ بدون آن، Sitemap با 404 قابل‌مشاهده است تا دامنهٔ نادرست معرفی نشود.
- روی Vercel صرفاً استاتیک: `/guide/` و سربرگ‌های `noindex` کار می‌کنند، اما **Express backend، sitemap پویا و route-specific server-head تضمین‌شده نیستند**. برای نسخهٔ Production باید در یک سرویس واحد/Rewrite کنترل‌شده تأیید شوند.
- پس از راه‌اندازی HTTPS و Search Console برای همان origin: ابتدا `/guide/` و `/` را در URL Inspection آزمایش کنید، sitemap را ثبت کنید و نتیجهٔ indexed/non-indexed را پایش کنید؛ دیده‌شدن واقعی در نتایج قابل تضمین نیست.
- `robots.txt` برای جلوگیری از ایندکس صفحات خصوصی کافی نیست؛ باید header/meta `noindex` و **کنترل دسترسی API** برقرار باشد. از `Disallow: /admin` همراه با توقع خوانده‌شدن `noindex` استفاده نمی‌کنیم.

## برنامهٔ اجرایی محتوا (بدون محتوای تکراری)

1. گسترش راهنما به مقاله‌های واقعاً مستقل فقط بعد از تأیید محتوای علمی/منبع: «چطور تداخل کلاس را پیدا کنیم؟»، «تفاوت پیش‌نیاز و هم‌نیاز»، «چک‌لیست روز انتخاب واحد». این‌ها باید پاسخ کاربردی داشته باشند، نه صفحه‌های تقریباً همسانِ کلمات کلیدی.
2. هیچ مجوز قطعی ترم آخر، کارآموزی، پروژه، شرط حداقل واحد، سقف ترم یا قوانین خاص واحد علوم و تحقیقات بدون تأیید مالک و منبع معتبر در مقاله نوشته نشود.
3. لینک‌سازی داخلی به دمو دانشجو و اصل محتوای همان سؤال؛ دموها برای استفاده و تبدیل هستند و عمداً در Sitemap وارد نمی‌شوند.
4. از جعل نقد کاربران، ستاره، شمار ثبت‌نام، وابستگی دانشگاهی، پشتیبانی رسمی آموزشیار و نشان `FAQPage` برای rich result پرهیز شود.

## معیارهای UX، دسترس‌پذیری و عملکرد

- عرض‌های ۳۲۰، ۳۶۰، ۳۹۰، ۴۳۰، ۷۶۸ و ۱۴۴۰ پیکسل: نبود overflow کلی، CTAهای قابل لمس و فوکوس، ترتیب RTL صحیح، `details` با کیبورد، مسیر دمو و راهنمای standalone.
- LCP هدف ≤۲٫۵ ثانیه، INP ≤۲۰۰ میلی‌ثانیه، CLS ≤۰٫۱ در صدک ۷۵ کاربران واقعی (موبایل و دسکتاپ جدا). این‌ها **هدف پایش** هستند، نه اعداد اندازه‌گیری‌شدهٔ پروژه. بدون دادهٔ Search Console/CrUX نباید ادعای عبور کنیم.
- تیتر H1 واحد در guide، خوانایی موبایل با فونت محلی، `prefers-reduced-motion`، skip-link و لینک‌های واقعی `<a href>` برای crawl.
- تست دقیق API و بیلد React در `bun run qa:full` + smoke واقعی SEO با HTTP قبل از مرج؛ Green بودن Vercel frontend معیار آماده‌بودن Express نیست.

## منابع مرجع (خواندنی)

- Google Search Central — JavaScript SEO: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Google Search Central — Canonical: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google Search Central — Technical SEO and sitemap: https://developers.google.com/search/docs/fundamentals/get-started-developers
- Google Search Central — FAQ rich-result limitation for general sites: https://developers.google.com/search/blog/2023/08/howto-faq-changes
- Google / web.dev — Core Web Vitals: https://web.dev/articles/vitals

## صراحت در مرز انتشار

تغییرات فقط در GitHub است تا پس از QA ادغام شود. **هیچ اتصال زندهٔ Search Console، پیامک واقعی، رتبه، ایندکس گوگل، Safari واقعی یا deploy به VPS در این PR ادعا نشده است.** همچنین SSR کامل React برای صفحهٔ اصلی هنوز جایگزین رندر سمت کاربر نشده؛ صفحهٔ عمومی `/guide/` مستقل از JS است و می‌تواند نقطهٔ شروع محتوای crawlable باشد.

## گزارش اجرای QA روی پیاده‌سازی — ۲۰۲۶/۱۰/۲۸

- **گیت اول:** آزمون هدفمند SEO و TypeScript موفق، سپس گیت اولیهٔ ۳۴۲ تست/بیلد موفق بود اما API smoke خطای fetch گرفت. علت واقعی: Express 4 مسیر `/guide` را با اسلش اختیاری روی `/guide/` هم match می‌کرد و redirect دائم به خودش می‌ساخت. مسیر با شرط exact `req.path === '/guide'` اصلاح و regression در API smoke نگه داشته شد.
- **پس از اصلاح:** `bun run qa:full` شامل `bun install --frozen-lockfile`، TypeScript، **۳۴۲/۳۴۲ تست Vitest در ۶۳ فایل**، بسته‌بندی افزونه، بیلد Vite و Express و API smoke تولیدی با پایگاه‌دادهٔ مصنوعی، همگی **exit 0**. در smoke درخواست‌های واقعی `/`، `/guide/`، `/robots.txt`، `/sitemap.xml`، `/admin`، `/dashboard`، ورود/ثبت‌نام، مسیر ناشناخته (404) و redirect `/index.html` آزمایش شدند.
- **مرورگر واقعی Chromium:** مسیر عمومی و راهنمای مستقل در **۳۲۰، ۳۶۰، ۳۹۰، ۴۳۰، ۷۶۸ و ۱۴۴۰px** (۱۲ بار باز شدن صفحه). در همهٔ موارد status=200، `html[lang=fa][dir=rtl]`، عنوان درست، ۳ مرحله، ۴ FAQ قابل بازکردن با Enter، لینک دمو و فونت محلی راهنما درست؛ **صفر overflow کلی و صفر `pageerror`**. این شواهد تست مرورگر واقعی در Vercel Sandbox هستند، نه Safari فیزیکی یا پایش Web Vitals کاربران.
- **ممیزی فایل:** پیش از آخرین اصلاح route، **۳۲۲ فایل non-ZIP از ۳۲۲ فایل** با Git blob hash شاخه برابر بودند؛ بعد از اصلاح نیز `server.ts` به همان SHA آخرین GitHub به‌روزرسانی و گیت کامل مجدد اجرا شد. ZIPهای افزونه خروجی تولیدی/باینری‌اند و از این ممیزی کد کنار گذاشته شدند.
- **شرط انتشار:** تنظیم دامنهٔ درست، Search Console، بررسی نحوهٔ اعمال headerهای Vercel در محیط واقعی، محدودیت‌های بک‌اند Express و تست Safari/iPhone هنوز نیازمند تأیید عملی هستند.
