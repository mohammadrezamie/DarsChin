# Security and demo-data policy

**Demo-only today is not production-safe by default.** This guide documents present limits, not a security certification.

## Credentials and source control

- `JWT_SECRET` is required before the API can start. Use a unique high-entropy value, kept in a private runtime environment file.
- Never commit configured `.env` files, SMS-provider keys, JWTs, passwords, password hashes, recovery keys, OTPs, raw exported student data or logs.
- The currently tracked `data/darschyn-db.json` includes account identifiers and authentication-related fields. See [issue #4](https://github.com/mohammadrezamie/DarsChin/issues/4). `.gitignore` alone does **not** remove tracked content or Git history.
- `server/db/seed.ts` contains **sample accounts with fixed demo passwords**. These must never be mistaken for production credentials. Before public launch, remove or disable public demo account access and independently review bootstrap behavior; do not migrate demo accounts to live accounts.
- Do not quote identifiers or credentials from committed data in public docs, PR descriptions or logs.

## Administrative responses

Review all authenticated API responses for secrets, including backup downloads and the administrator users listing. [Draft PR #5](https://github.com/mohammadrezamie/DarsChin/pull/5) addresses existing recovery-field disclosure and transient OTP/CAPTCHA backup data. It has tests in source but has **not** passed executed validation.

## Live launch gate

1. Deploy with a separate service user and environment secrets, HTTPS and reverse proxy.
2. Ensure a persistent data directory that is not tracked by Git and not overwritten by releases.
3. Validate account bootstrap, permissions and role boundaries; prevent privileged bypasses.
4. Disable production debug/test endpoints, demo defaults and mock OTP behavior.
5. Set up SMS/OTP provider credentials only if needed; test failure paths and request throttling.
6. Verify backups by restoring to an isolated non-production directory.
7. Perform security and dependency audit, update libraries deliberately rather than force-upgrading.
8. Test authorization, cross-user access, state persistence and rollback at a named commit.

**Responsible reporting:** keep vulnerability details and real data in private project channels, redact samples, and do not publish exploits or identifiers in issues.
