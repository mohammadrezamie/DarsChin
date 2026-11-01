# DarsChin (DARSCHYN)

DarsChin is a student-focused helper for course planning and workflows around Educationalyar. The web application includes a React/Vite frontend and a Node.js/Express backend, with an accompanying browser-extension codebase.

Project homepage: https://dars-chin.vercel.app

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

**Existing tracked data requires review:** `data/darschyn-db.json` is already tracked and contains account/contact and credential-related fields. Adding an ignore rule does **not** remove a previously tracked file or erase Git history. Confirm whether it is synthetic or real before changing its storage and migration behavior. Do not use the checked-in data file as a production database.

**راهنمای توسعه و وضعیت محصول (فارسی):** [معرفی درس‌چین](docs/PRODUCT_GUIDE_FA.md)، [قوانین آموزشی در انتظار جلسه و تأیید](docs/ACADEMIC_RULES_INTAKE_FA.md)، [نقشه Vercel فول‌استک](docs/VERCEL_FULLSTACK_PLAN_FA.md)، [همکاری تیمی](docs/TEAM_WORKFLOW_FA.md).

Start with the [documentation index](docs/INDEX.md) for local development, security, deployment, rollback and the outstanding [repository audit](docs/REPOSITORY_AUDIT.md).

## Contribution workflow

Create a focused branch from an up-to-date `main`, run the relevant validation commands, and open a pull request. Keep work-in-progress changes in Draft until they are ready for review.
