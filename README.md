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

```bash
npm ci
npm run dev
```

The development server uses the configuration in `.env`. Copy the required variable names from `.env.example` and fill them with local development values. Do not put real passwords, recovery keys, OTP provider credentials, or production tokens in source control.

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

## Contribution workflow

Create a focused branch from an up-to-date `main`, run the relevant validation commands, and open a pull request. Keep work-in-progress changes in Draft until they are ready for review.
