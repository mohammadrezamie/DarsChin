# DarsChin documentation index

**Status: DEMO.** Course and campus data are samples, not official university records. The Chrome extension is a data-collection adapter, not the core product.

| Topic | Reference |
| --- | --- |
| **قرارداد دائمی دستیارها و توسعه‌دهنده‌ها: ثبت همهٔ دستورهای مالک در GitHub** | [AGENTS.md](../AGENTS.md) |
| **دفتر تاریخ‌دار همهٔ درخواست‌ها، برنامه‌ها، اولویت‌ها و تغییر تصمیم مالک** | [OWNER_DECISIONS_FA.md](OWNER_DECISIONS_FA.md) |
| راهنمای کامل محصول و وضعیت قابلیت‌ها | [PRODUCT_GUIDE_FA.md](PRODUCT_GUIDE_FA.md) |
| طراحی جدید پنل مدیریت: رشته ← مقطع ← گرایش/ورودی ← چارت، بدون شناسه‌های فنی | [ADMIN_MAJOR_WORKSPACE_FA.md](ADMIN_MAJOR_WORKSPACE_FA.md) |
| اقتباس صرفاً خواندنی از تکین: نیازپرداز، مرکز پیامک و «من ربات نیستم» | [TAKIN_REFERENCE_SMS_CAPTCHA_FA.md](TAKIN_REFERENCE_SMS_CAPTCHA_FA.md) |
| دامنهٔ مستقل درس‌چین روی همان VPS تکین با Nginx مشترک | [VPS_SHARED_DOMAIN_FA.md](VPS_SHARED_DOMAIN_FA.md) |
| راهنمای ساختار پوشه‌ها، آرشیو ابزارهای قدیمی و نظافت GitHub | [REPOSITORY_STRUCTURE_FA.md](REPOSITORY_STRUCTURE_FA.md) |
| استاندارد RTL فارسی، سیستم ظاهری، فونت محلی و چک‌لیست دیباگ موبایل/دسکتاپ | [RTL_VISUAL_QA_FA.md](RTL_VISUAL_QA_FA.md) |
| بازخورد دموی زنده: صف ثبت فشرده، فعال‌سازی نیازسنجی و ساخت چارت توسط مدیر | [UX_LIVE_DEMO_FEEDBACK_FA.md](UX_LIVE_DEMO_FEEDBACK_FA.md) |
| ورود بدون حساب به دمو، محدوده پایلوت برق علوم‌وتحقیقات و راه‌اندازی سریع VPS | [PILOT_LAUNCH_FA.md](PILOT_LAUNCH_FA.md) |
| روند بررسی و تأیید فایل‌های استخراج‌شده از آموزشیار | [EDUCATIONALYAR_IMPORT_REVIEW_FA.md](EDUCATIONALYAR_IMPORT_REVIEW_FA.md) |
| آماده‌باش انتخاب واحد: صف کپی سریع کدهای آموزشیار، اولویت‌ها و تقدم همنیاز | [EDUCATIONALYAR_REGISTRATION_FA.md](EDUCATIONALYAR_REGISTRATION_FA.md) |
| ایمنی ورودی آموزشیار، صف بررسی مدیر و ممنوعیت انتشار خودکار | [EDUCATIONALYAR_IMPORT_REVIEW_FA.md](EDUCATIONALYAR_IMPORT_REVIEW_FA.md) |
| نیازسنجی درس‌های ترم آینده، گزارش مدیر گروه، حریم خصوصی و برنامهٔ توسعه | [FEATURE_COURSE_DEMAND.md](FEATURE_COURSE_DEMAND.md) |
| قوانین حوزه‌ایِ دانشگاه/واحد/مقطع/رشته/گرایش و طرح کپی پیش‌نویس | [FEATURE_COURSE_DEMAND.md §۵](FEATURE_COURSE_DEMAND.md) |
| پرونده جمع‌آوری و تأیید قوانین دانشگاه آزاد (در انتظار) | [ACADEMIC_RULES_INTAKE_FA.md](ACADEMIC_RULES_INTAKE_FA.md) |
| منابع بررسی‌شدهٔ آیین‌نامه، اعتبارسنجی منبع و مرزبندی قوانین عمومی/شرط‌های قابل تنظیم | [ACADEMIC_REGULATION_RESEARCH_FA.md](ACADEMIC_REGULATION_RESEARCH_FA.md) |
| نقشه عملیاتی‌کردن کامل Vercel | [VERCEL_FULLSTACK_PLAN_FA.md](VERCEL_FULLSTACK_PLAN_FA.md) |
| روند همکاری چندنفره و استقرار خودکار | [TEAM_WORKFLOW_FA.md](TEAM_WORKFLOW_FA.md) |
| Local setup | [README](../README.md) |
| Contribution | [CONTRIBUTING](../CONTRIBUTING.md) |
| Maintenance checklist | [REPOSITORY_MAINTENANCE.md](REPOSITORY_MAINTENANCE.md) |
| Contribution & verification | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Safe deployment & rollback | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Security and privacy | [SECURITY.md](SECURITY.md) |
| Architecture and risks | [Repository audit](REPOSITORY_AUDIT.md) |
| Sync ingestion and reconciliation | [Architecture](ARCHITECTURE.md) and [project status](PROJECT_STATUS.md) |
| Sensitive export remediation | [Merged PR #8](https://github.com/mohammadrezamie/DarsChin/pull/8) |

For a release, validate one named commit: dependency installation, TypeScript, tests, build, API smoke check, persistence across restart, backup restore, and HTTPS. A successful Vercel preview of the frontend is **not** a verified backend deployment.

No changes to academic eligibility rules without the owner's explicit confirmation.
