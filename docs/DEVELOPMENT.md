# Development workflow (without GitHub Actions minutes)

This is currently a demo. Preserve a clean `main` and use short-lived branches and PRs for changes. Development is not blocked by GitHub Actions quota, but **missing automated test evidence must be disclosed**.

## Local work

Install Node.js 22 and npm. Run:

```bash
npm ci
npm run lint
npm test
npm run build
```

Run the suite against a **disposable** database, never a live or committed database. To isolate the application tests, set `DARSCHYN_DATA_DIR` to a writable temporary directory **before importing the database module**. Set a unique `JWT_SECRET` in a local `.env` file; use synthetic root account settings for test runs. Do not copy operational credentials into commands, logs or issues.

Some historical tests seed demo data and mutate singleton state. Until independently verified, run tests with a clean workspace and review all test/database side effects. The `npm run build` command currently packages the extension ZIP in the repository root. Check the working tree and do not accidentally commit its output.

The in-progress development branch `fix/ci-regression-tests` also supplies a Bun-based `npm run verify` shortcut. Verify the actual installed tooling and branch before using it.

## PR checklist

- [ ] Scope and expected behavior documented; academic-rule changes separately approved
- [ ] Diff reviewed for personal data, credentials, generated binaries, unrelated changes
- [ ] Commands executed and **actual** pass/fail output captured for the exact commit
- [ ] Risky database or authentication changes covered by targeted tests
- [ ] Frontend and Express API verified separately
- [ ] Unverified integrations and trade-offs clearly identified
- [ ] README, docs and changelog updated if behavior or operations change

## Merging without Actions

GitHub Actions may be unavailable due to account quota. Instead, execute checks in an isolated local machine or disposable sandbox, record the **commit SHA**, command, environment and outcome in the PR, and merge using `squash` only after the change is adequately verified. No passing status is inferred from Vercel's frontend build, comments checks, static review, or Graphify.

A docs-only PR may be merged after a careful source and Markdown-link review without application build execution, provided the validation gap is stated. Security/authentication/data changes demand runtime tests first.

**Graphify:** the indexed `mohammadrezamie/DarsChin` workspace is currently based on commit `61837f9` (indexed 2026-09-23). It supports dependency/impact analysis, but does not see later PR commits until refreshed and never replaces tests.
