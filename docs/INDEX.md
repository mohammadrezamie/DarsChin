# DarsChin documentation index

**Status: DEMO.** Course and campus data are samples, not official university records. The Chrome extension is a data-collection adapter, not the core product.

| Topic | Reference |
| --- | --- |
| راهنمای کامل محصول و وضعیت قابلیت‌ها | [PRODUCT_GUIDE_FA.md](PRODUCT_GUIDE_FA.md) |
| ایمنی ورودی آموزشیار، صف بررسی مدیر و ممنوعیت انتشار خودکار | [EDUCATIONALYAR_IMPORT_REVIEW_FA.md](EDUCATIONALYAR_IMPORT_REVIEW_FA.md) |
| پرونده جمع‌آوری و تأیید قوانین دانشگاه آزاد (در انتظار) | [ACADEMIC_RULES_INTAKE_FA.md](ACADEMIC_RULES_INTAKE_FA.md) |
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
