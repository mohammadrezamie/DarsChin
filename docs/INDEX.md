# DarsChin documentation index

**Status: DEMO.** Course and campus data are samples, not official university records. The Chrome extension is a data-collection adapter, not the core product.

| Topic | Reference |
| --- | --- |
| Local setup | [README](../README.md) |
| Contribution & verification | [DEVELOPMENT.md](DEVELOPMENT.md) |
| Safe deployment & rollback | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Security and privacy | [SECURITY.md](SECURITY.md) |
| Architecture and risks | [Repository audit](REPOSITORY_AUDIT.md) |
| Sync implementation (in-progress) | [PR #1](https://github.com/mohammadrezamie/DarsChin/pull/1) |
| Sensitive export remediation | [PR #5](https://github.com/mohammadrezamie/DarsChin/pull/5) |

For a release, validate one named commit: dependency installation, TypeScript, tests, build, API smoke check, persistence across restart, backup restore, and HTTPS. A successful Vercel preview of the frontend is **not** a verified backend deployment.

No changes to academic eligibility rules without the owner's explicit confirmation.
