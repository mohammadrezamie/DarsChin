# Development workflow (without GitHub Actions minutes)

This is currently a demo. Preserve a clean `main` and use short-lived branches and PRs for changes. Development is not blocked by GitHub Actions quota, but **missing automated test evidence must be disclosed**.

## Local work

Install Node.js 22+ and Bun. Run:

```bash
bun run verify
bun run smoke:api
```

Run the suite against a **disposable** database, never a live or committed database. To isolate the application tests, set `DARSCHYN_DATA_DIR` to a writable temporary directory **before importing the database module**. Set a unique `JWT_SECRET` in a local `.env` file; use synthetic root account settings for test runs. Do not copy operational credentials into commands, logs or issues.

The standalone API smoke script requires the built `dist/server.cjs` and checks JSON health/404, synthetic root login and sync history after process restart. It must still be executed and observed before considering the check passing.

The verification runner generates disposable test credentials and configures `DARSCHYN_DATA_DIR` so test persistence does not affect the checked-in JSON database. It checks the committed `bun.lock` without modifying dependency versions. The `bun run build` command packages the extension ZIP in the repository root; check the working tree and do not accidentally commit its output.

On Windows, use `bun run verify` rather than requiring Bash. `npm ci` is intentionally not supported because the npm lockfile was stale and Bun is the canonical package manager.

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
