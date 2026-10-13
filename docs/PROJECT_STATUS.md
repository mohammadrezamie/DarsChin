# DARSCHYN Project Status

> Baseline: `main` at `61837f949d015e899c46a5be55e9070eafaf4667`. Latest reviewed development head: `fix/ci-regression-tests` at `d0895c5ebfc307f02fe68dbb14af410295be6780` (2026-10-13). This is a repository-level assessment, not a claim that production has been tested.

## Current state

DARSCHYN is a web application for IAU course planning. The Chrome extension is one possible data-ingestion source; it is not the product itself.

| Area | State | Evidence / next step |
| --- | --- | --- |
| React/Vite frontend | Build-verified on preview commit | Vercel preview returns HTTP 200; route-level lazy loading reduced the initial JS chunk from 699.41 kB to 271.06 kB (gzip 188.64 kB to 85.17 kB). This does not verify API behavior. |
| Express API | Source-reviewed; runtime not deployed on Vercel | Vercel is serving the frontend only; `/api/health` is not a valid backend check on that preview. Run API tests and a production-like Node staging instance separately. |
| Authentication and roles | Partially regression-covered; execution pending | Login role routing and recovery-challenge replay protection are in source. Password recovery still needs challenge-expiry enforcement and route-level malformed-input tests; run the full suite before calling it verified. |
| Academic policy engine | Implemented, partially tested | Expand tests for prerequisite exceptions, co-requisites, term limits, and final-semester rules. |
| Local JSON persistence | Present; operational risks remain | Test persistence across restart and isolate test data from development data. |
| Educationalyar extension | Present | Verify against current real portal DOM; fixture tests alone are not end-to-end verification. |
| Sync/reconciliation | Implemented in source; not executed | A strict adapter now understands the checked-in nested extension record shape, resolves course codes/names only when unique, validates explicit schedule and capacity fields, deduplicates by stable source identity, and atomically upserts only after every record validates. Test/typecheck/build execution and live-source verification remain outstanding. |
| CI | Not verified | No successful GitHub Actions run is available for the current head. Vercel's successful deployment runs the production build but does not run `npm test` or `npm run lint`. |
| Production readiness | Not verified | No production-readiness claim until security, persistence, backup, deployment, and real-source sync tests pass. |

## Known risks identified during review

- Login code previously treated the object returned by `login()` as a boolean and always navigated on a truthy object.
- The extension currently exports nested `schemaVersion: 2.0` records (`course`, `courseClass`, `_meta`) while older import types describe a flat `1.0` shape. The sync adapter handles the checked-in nested shape, but the collector's current live output still needs a verified fixture.
- The extension schedule parser appears to contain a malformed time-range regex. The collector was intentionally left untouched; the server adapter accepts only explicit parseable schedule strings and rejects unresolved records.
- The current extension payload does not provide a trustworthy enrolled count. The sync adapter documents that limitation in the offering notes rather than claiming the count came from Educationalyar.
- Database sync history and test isolation need dedicated persistence regression tests.
- `.env.example` may still omit `JWT_SECRET`; the deployment guide documents it, but the checked-in environment example should be reconciled before release.
- The last Vercel build reported 11 npm audit findings (3 moderate, 7 high, 1 critical). The exact advisory-to-package mapping has not yet been captured, so no blanket or force dependency upgrade should be applied without a fresh `npm audit --json` report.
- Repository contains old helper scripts and a checked-in extension ZIP; do not delete or regenerate artifacts without verifying the canonical build path.

## Verification language

Use these labels in reports:

- **Code-reviewed:** inspected source; not executed.
- **Unit-tested:** automated test passed on a named commit.
- **Build-verified:** production build completed on a named commit.
- **Fixture-verified:** tested against a controlled fixture.
- **Live-verified:** tested against the actual external service or deployed environment.

Never describe code review or fixture verification as live verification.


## Development branch update

The following work has been committed to `fix/ci-regression-tests` after the baseline review above:

- Added `docs/MASTER_PROMPT.md` as the canonical operating brief for coding agents, including the explicit academic-policy approval boundary.
- Recorded the owner-confirmed course-demand dependency behavior in `docs/FEATURE_COURSE_DEMAND.md`.
- Added transport-level sync chunk validation in `server/sync/validation.ts`: index bounds, object-record shape, record-count and byte-size limits, boolean final-marker validation, and complete chunk-sequence checking.
- Updated `server/routes/sync.ts` to validate chunk payloads, reject conflicting reuse of an index, acknowledge identical retries without duplicate snapshots, and reject incomplete final chunk sequences.
- Added `server/sync/reconciliation.ts` to normalize the checked-in nested extension record shape, reject ambiguous/malformed records, derive stable source identities, and avoid guessed schedule defaults.
- Updated sync job states to distinguish `RUNNING`, `RECEIVED`, `RECONCILED`, and `FAILED`; a failed reconciliation leaves existing offerings untouched.
- Added `tests/sync-validation.test.ts` and `tests/sync-reconciliation.test.ts` for transport validation, idempotency, duplicate identity, and incomplete/ambiguous data cases.

**Verification:** source has been reviewed through GitHub, but the tests, typecheck, and production build have not been executed in this environment. This is not yet unit-tested, build-verified, or live-verified. No GitHub Actions workflow has been added.


## Visible website improvements on the current development branch

- Redesigned the landing hero into a responsive, interactive product preview. Selecting/removing illustrative courses updates the demo course count and unit total; the preview explicitly labels itself as sample data and does not claim to use a student's real profile.
- Rebuilt the dashboard showcase around existing student/admin workflows instead of fabricated numeric dashboard statistics.
- Rewrote the ingestion explainer to avoid claims of live, real-time Educationalyar sync and removed fabricated ingestion counts.
- Extended the ingestion section to explain the difference between received, reconciled, and failed sync outcomes without presenting mock states as live data.
- Replaced the unused admin sync-history placeholder with a server-backed monitor showing real job states, chunk progress, reconciled offering counts, and error details; the endpoint is permission-protected and never returns raw snapshots.
- Added Persian-first navigation and anchor links to the landing page sections, clearer branding, and distinct sign-in/sign-up actions.
- Split route-level page components into lazy-loaded chunks. On the latest successful Vercel build, the initial JS chunk decreased from 699.41 kB to 271.06 kB; gzip size decreased from 188.64 kB to 85.17 kB.
- Latest preview: https://dars-chin-git-fix-ci-regression-tests-tna12.vercel.app/ (HTTP 200 for the frontend). This preview does not host the Express API; no API, authentication, persistence, or Educationalyar live behavior should be inferred from the page response.
- Added isolated systemd/Nginx deployment templates and an operational guide. These are templates only: the VPS, DNS, HTTPS, backup process, and production service have not been changed or verified.

## Current verification gate

- Latest branch head: `d0895c5ebfc307f02fe68dbb14af410295be6780`; PR #1 remains Draft and unmerged.
- Vercel build/deployment: successful for the latest head.
- Unit tests and TypeScript typecheck: not yet executed; treat newly added tests as unverified until a test runner reports success.
- Dependency audit: the build reported 11 findings (3 moderate, 7 high, 1 critical); a fresh JSON audit report is required before mapping them to specific packages and choosing compatible fixes.
- Password recovery: successful challenge replay is blocked, but expiry validation remains a known gap in the helper and must be fixed and tested before production.
- The Educationalyar collector remains frozen. Do not change its source, parser, dependencies, or version as part of these follow-ups.
- Do not merge PR #1, deploy to production, or alter the VPS/TakinTech setup without explicit approval.
