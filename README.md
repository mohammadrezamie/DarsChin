# DarsChin (DARSCHYN)

> **Public open-source source, private-by-configuration instances.** See the [self-hosting guide](docs/SELF_HOSTING_OPEN_SOURCE_FA.md). A historical committed database contained sensitive material; the current HEAD no longer tracks it, but Git history/old PR references still require remediation. Do not reuse affected credentials.

DarsChin is a student-focused helper for course planning and workflows around Educationalyar. The web application includes a React/Vite frontend and a Node.js/Express backend, with an accompanying browser-extension codebase.

Project homepage (frontend demo only, subject to deployment status): https://dars-chin.vercel.app

## Pilot demo — no account needed

The first scope is **B.E. Electrical Engineering at Islamic Azad University, Science and Research Branch**. All demo courses, lecturers, capacity and eligibility results are **synthetic, not official**.

- `/demo/student` — full browser-only student workspace.
- `/demo/admin` — browser-only administrator workspace; no server authorization is granted.
- `/demo` — interactive course-planning playground.

Links are provided on the homepage and `/login`. Browser-only demo state lives in the visitor's own storage. The continuous timetable spans **07:00–20:00** with arbitrary start/end times and a separate list for unscheduled/out-of-range classes. Theme controls (day/system/night) and right-edge RTL hamburger menus are visible in demo screens. Read the [pilot and quick VPS launch guide](docs/PILOT_LAUNCH_FA.md).

## SMS, human verification and GitHub layout

- **Unified SMS center** for login/recovery codes and Niazpardaz: `/demo/admin?tab=sms-center` (browser-only fake settings) or the authorized real admin route. Private keys are set on the server only. See [Takin reference and DarsChin implementation](docs/TAKIN_REFERENCE_SMS_CAPTCHA_FA.md).
- **«من ربات نیستم»** on guest sign-in/sign-up/OTP forms uses server-verified Cloudflare Turnstile **only when configured**. With the integration disabled, guest login and registration now require the same **server-validated, single-use local SVG CAPTCHA** already used for OTP. Neither mode is a frontend-only checkbox; demo pages still use synthetic browser state. Test access from Iran before enabling on the public domain.
- **Clean repository:** 22 one-off root scripts were preserved under `scripts/legacy/`; run `bun run repo:check` and read [repository structure](docs/REPOSITORY_STRUCTURE_FA.md).
- **Separate domain on the same VPS as Takin:** use the existing Nginx and a different localhost port, without deploying a competing Caddy instance. See [shared-VPS/domain guide](docs/VPS_SHARED_DOMAIN_FA.md).

## Open-source license and independent server installations

Original project code is available under the [MIT License](LICENSE). Anyone may clone the public repository and run a **separate, privately configured** instance; that does not provide access to the maintainer's server or data. `package.json` sets `private: true` only to block accidental publication to the npm registry. To keep a personal deployment restricted to its operator, set `DARSCHYN_ACCESS_MODE=owner_only` in its **untracked** `deploy/.env.vps` and preserve its separate data volume. This controls backend APIs, not public static/demo pages; protect those at the reverse proxy if necessary. Existing deployments preserve the legacy `multiuser` mode until deliberately changed.

**[Complete clone, configure, update, offline root credential rotation and shared-Nginx self-hosting instructions](docs/SELF_HOSTING_OPEN_SOURCE_FA.md).**

**[راهنمای فارسی ENV و فیلدهای خالی امنیتی](docs/ENV_CONFIGURATION_FA.md):** The three committed example ENV files contain no operator credentials or contact values. Copy a template to a **private** untracked file on each server and fill it with that installation's own values. Never overwrite an existing server's working `.env` with a blank example during `git pull`.

## VPS quick start

An initial **single-process** Node.js + HTTPS Caddy Docker Compose stack lives in `Dockerfile`, `compose.yaml` and `deploy/`. This full stack is suitable for a **dedicated VPS only**. For a VPS **shared with Takin/Nginx**, do **not** start the bundled Caddy proxy: use the existing Nginx and run only the `darschin` container via the localhost-only compose overlay, as shown in [the shared server guide](docs/VPS_SHARED_DOMAIN_FA.md). Both configurations keep independent persistence and private secrets and avoid known-password demo users in production.

```bash
cp deploy/.env.vps.example deploy/.env.vps
chmod 600 deploy/.env.vps
# Set secrets and DNS/domain inside deploy/.env.vps before running:
docker compose --env-file deploy/.env.vps config -q
# DEDICATED VPS only; existing Nginx hosts should NOT start Caddy:
docker compose --env-file deploy/.env.vps up -d --build
```

Do not deploy publicly until tests, DNS/TLS, backups, official pilot policies and permissions have been reviewed. **These deployment files are committed but have not yet been tested on an actual VPS.**

## Development stack

- TypeScript and React
- Vite for the web frontend
- Node.js and Express for server routes
- Vitest for automated tests

Use Node.js 22+ and Bun. **bun.lock is the canonical dependency lockfile**; npm's stale lockfile has been removed.

## Getting started

1. Install [Bun](https://bun.sh) and run `bun install --frozen-lockfile` to use the committed dependency versions.
2. Copy `.env.example` to `.env` (on Windows, copy the file manually or use PowerShell).
3. Generate a unique development JWT secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and set `JWT_SECRET` in the **untracked** `.env` file. Never use this development secret in production.
4. Run `bun run dev`.

The authentication middleware requires a nonempty `JWT_SECRET` at startup. The `ROOT_OWNER_*` settings are used for privileged account bootstrap; configure them privately when needed, and do not reuse development credentials in production. This repository is not a ready-to-deploy production configuration. Do not commit real passwords, recovery keys, OTP-provider credentials, or tokens.

## Validation and build

```bash
bun run verify
```

- `bun run verify` calls a portable Node verification runner: frozen install, TypeScript check, Vitest suite and full build.
- Each verification run uses newly generated **test-only** secrets and an isolated temporary JSON database.
- `bun run build` packages the extension, verifies it, builds the frontend and bundles the Express server.
- After a successful build, `bun run smoke:api` can check an isolated production-mode Express listener, synthetic login and sync persistence across a service restart; no real account or university data is required.

## Repository layout

- `src/` — frontend source
- `server/` — server-side routes, validation, authentication, and data access
- `extension/` — browser extension source
- `public/` and `assets/` — static assets
- `scripts/` — development and build helpers
- `tests/` — automated tests

## Data and security

Use synthetic or explicitly approved test data during development. Do not commit real student information, exported university data, local databases, logs, or populated `.env` files. Treat sync input as untrusted and validate it before processing.

**Historical sensitive data is still exposed in old Git refs:** `data/darschyn-db.json` was removed from the current main tree, but older commits and PR references may retain account/contact and credential-related data. Treat affected credentials as compromised, rotate/revoke them, and plan a coordinated history/ref cleanup without breaking live server checkout.

**راهنمای توسعه و وضعیت محصول (فارسی):** [معرفی درس‌چین](docs/PRODUCT_GUIDE_FA.md)، [قوانین آموزشی در انتظار جلسه و تأیید](docs/ACADEMIC_RULES_INTAKE_FA.md)، [نقشه Vercel فول‌استک](docs/VERCEL_FULLSTACK_PLAN_FA.md)، [همکاری تیمی](docs/TEAM_WORKFLOW_FA.md).

Start with the [documentation index](docs/INDEX.md) for local development, security, deployment, rollback and the outstanding [repository audit](docs/REPOSITORY_AUDIT.md).

## Contribution workflow

For the current owner-directed demo/pilot work, use `main` as the integration branch and avoid unnecessary feature branches. Run the quality gate for each commit. Preexisting open Draft PRs must be reconciled file-by-file before merging or closing; never overwrite newer main fixes. Remove completed branches only after verifying their unique work is retained.


> **Public source security:** Obsolete one-off login scripts with historically hardcoded authentication values have been removed from current HEAD; never use their old credentials or restore old published data. This does **not** erase public Git history or old PR references. See [security incident](docs/PUBLIC_REPOSITORY_READINESS_20261101_FA.md) and [security policy](docs/SECURITY.md).
