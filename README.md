# DarsChin (DARSCHYN)

DarsChin is a student-focused helper for course planning and workflows around Educationalyar. The web application includes a React/Vite frontend and a Node.js/Express backend, with an accompanying browser-extension codebase.

Project homepage: https://dars-chin.vercel.app

## Development stack

- TypeScript and React
- Vite for the web frontend
- Node.js and Express for server routes
- Vitest for automated tests

Use a supported Node.js version and install dependencies from the committed lockfile.

## Getting started

1. Run `npm ci` to install dependencies using the committed npm lockfile.
2. Copy `.env.example` to `.env` (on Windows, copy the file manually or use PowerShell).
3. Generate a unique development JWT secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and set `JWT_SECRET` in the **untracked** `.env` file. Never use this development secret in production.
4. Run `npm run dev`.

The authentication middleware requires a nonempty `JWT_SECRET` at startup. The `ROOT_OWNER_*` settings are used for privileged account bootstrap; configure them privately when needed, and do not reuse development credentials in production. This repository is not a ready-to-deploy production configuration. Do not commit real passwords, recovery keys, OTP-provider credentials, or tokens.

## Validation and build

```bash
npm run lint
npm test
npm run build
```

- `npm run lint` runs the TypeScript check.
- `npm test` runs the Vitest suite.
- `npm run build` packages the extension, runs build verification, builds the frontend, and bundles the server.

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

See `docs/REPOSITORY_AUDIT.md` for the initial source-review findings and unresolved release blockers.

## Contribution workflow

Create a focused branch from an up-to-date `main`, run the relevant validation commands, and open a pull request. Keep work-in-progress changes in Draft until they are ready for review.
