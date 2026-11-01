# Security and demo-data policy

**Demo-only today is not production-safe by default.** This guide documents present limits, not a security certification.

## Credentials and source control

- `JWT_SECRET` is required before the API can start. Use a unique high-entropy value, kept in a private runtime environment file.
- Never commit configured `.env` files, SMS-provider keys, JWTs, passwords, password hashes, recovery keys, OTPs, raw exported student data or logs.
- Older Git history and PR refs (not the current main tree) contain the once-tracked `data/darschyn-db.json` with account identifiers and authentication-related fields. See [issue #4](https://github.com/mohammadrezamie/DarsChin/issues/4). `.gitignore` alone does **not** remove tracked content or Git history.
- `server/db/seed.ts` contains **sample accounts with fixed demo passwords**. These must never be mistaken for production credentials. Before public launch, remove or disable public demo account access and independently review bootstrap behavior; do not migrate demo accounts to live accounts.
- Do not quote identifiers or credentials from committed data in public docs, PR descriptions or logs.

## Administrative responses

Review all authenticated API responses for secrets, including backup downloads and the administrator users listing. [Merged PR #8](https://github.com/mohammadrezamie/DarsChin/pull/8) redacts recovery fields and transient OTP/CAPTCHA data in admin exports. The isolated Bun verification suite passed; production API authorization remains subject to deployment smoke tests.

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


## Guest CAPTCHA (login, registration, OTP)

- `TURNSTILE_ENABLED=true`: verify every submitted token on the Express server against Cloudflare Siteverify, expected action and permitted hostname. Missing token/provider error is denied.
- `TURNSTILE_ENABLED=false`: the sign-in and sign-up UI uses the existing local SVG CAPTCHA service. The server validates a time-limited challenge ID and answer, increments failed attempts, and consumes a successful answer so replay is denied. SMS-OTP initiation already uses its own local image check in this mode.
- A returned SVG/image is **not** proof that a human was verified. The server must verify the solution on every guest account-creation or login request. Fake checkboxes, unverified frontend flags and fail-open fallbacks are forbidden.
- Limitations: the JSON database and public CAPTCHA generation endpoint remain single-process pilot infrastructure, not a production anti-abuse platform. Verify rate limits, bot resistance, storage scaling, visual accessibility and Iran connectivity before inviting real students; OTP verification itself remains a separate factor.
- Current change is code-reviewed only until TypeScript/Vitest, live browser checks and a named preview build have completed; do not treat documentation as release approval.


## Guest CAPTCHA acceptance — 2026-10-26

Public login and registration must never rely on a decorative checkbox or a browser-only flag. The server checks a one-use, action-scoped first-party image CAPTCHA when Turnstile is disabled; when enabled, it checks the real provider's Siteverify token, action and exact allowed hostname. The OTP request keeps its own scoped challenge. Challenge images are rendered using `img`, not inserted as raw SVG markup. A failed challenge/configuration must not authenticate a user.

Full deployment, Iranian connectivity, shared-store atomicity, proxy-level rate limits, accessible non-image fallback and real SMS must still be verified before inviting real students. See [CAPTCHA_PRODUCTION_ACCEPTANCE_FA.md](CAPTCHA_PRODUCTION_ACCEPTANCE_FA.md) for the detailed checklist. No real secrets or other repositories were modified.

## Password reset session revocation (2026-10-28)

Every server-issued JWT is bound to the persisted per-account `sessionVersion`; an OTP recovery or authenticated password change increments it. JWTs issued beforehand must be rejected even before their original expiry. The password-change response supplies a fresh token for that same browser. Legacy JWTs without the version claim are accepted only for accounts that have not yet rotated their session version. Details, constraints and exact-source automated QA: [AUTH_SESSION_REVOCATION_FA.md](AUTH_SESSION_REVOCATION_FA.md). This change does not claim live VPS, multi-server or iPhone acceptance.

## Public-source / private-instance deployment (2026-11-01)

The source is published for independent self-hosting; no code contribution or clone is authorized to access the maintainer's live service. Optional `DARSCHYN_ACCESS_MODE=owner_only` requires a verified reserved root token on protected APIs and forbids new registrations, while `multiuser` remains available to other self-hosters. API-only gating is insufficient to hide static SPA/demo content; use a reverse-proxy access rule for complete site privacy. The Docker Compose service now explicitly forwards `DARSCHYN_REQUIRE_EXISTING_DB` and `DARSCHYN_REGISTRATION_OTP_REQUIRED`. Set them deliberately in the per-server private environment. See [self-hosting](SELF_HOSTING_OPEN_SOURCE_FA.md) and [public Git incident](PUBLIC_REPOSITORY_READINESS_20261101_FA.md).

## Offline repair of an exposed root account

If the root credentials of an existing installation may be exposed, update the private runtime ENV **and** the stored database password/recovery verifiers using the [offline repair steps](SELF_HOSTING_OPEN_SOURCE_FA.md#emergency-root-credential-rotation-without-a-second-codebase). The tool requires an existing persisted database, unique reserved root identity, stopped Node process and explicit operator confirmation; it backs up privately and increments sessionVersion. This is not proof that any live VPS has been rotated. Account/provider credentials beyond the root must be handled separately.

## Repository ENV template scrub and archived extension check — 2026-11-01

The three tracked *.env.example templates are placeholders only: no passwords, root mobiles, recovery materials, SMS/Turnstile credentials, real hostnames, deployment SHA or contact email. The operator's already populated runtime `.env` remains untracked and unchanged. CI now rejects accidentally filled private fields in examples and examines tracked ZIP extension contents using bounded archive scanning. This is a HEAD check, **not** assurance that historic Git objects or PR snapshots are clean. See [Persian field reference](ENV_CONFIGURATION_FA.md). No VPS config or credential has been modified.

## Delegated administrator identity integrity (2026-11-01)

Root-only administrator creation and editing now validate accepted fields, normalize Iranian phone numbers before enforcing global uniqueness, reject malformed or duplicate permission strings and weak new delegated passwords, and invalidate pre-update session tokens. Importantly, a failed update must not partially change a persisted record. This protects identity binding for SMS login and permission checks without changing existing accounts. Deployed servers are not auto-migrated or modified until operators update their own running instance; historic Git objects remain a separate incident.


## API error redaction and evaluation input guard — 2026-11-01

Internal 500 responses in administration and student eligibility must never reflect raw exception messages, stack traces, filesystem paths, secrets or mutable student records. Catch handlers return stable generic errors, including failed backup serialization. Student evaluation requires bounded arrays of valid course/offering identifiers before the engine runs. Regression tests intentionally throw synthetic path-bearing exceptions and ensure the response excludes their values. Neither these patches nor source-tree cleanup revokes credentials exposed in old Git history.

## Failed-login memory exhaustion guard (2026-11-01)

The per-mobile brute-force lockout now has a bounded, time-expiring in-memory tracker. Unknown-number login attempts can no longer add unlimited entries over months. Existing CAPTCHA and guest IP throttles still apply, failed attempts still lock a mobile for five minutes, and counters reset after completed lockouts or inactivity. This single-node pilot design is not a substitute for shared persistent rate limiting on a multi-instance production installation.
