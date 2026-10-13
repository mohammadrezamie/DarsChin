# DARSCHYN Project Status

> Baseline: `main` at `61837f949d015e899c46a5be55e9070eafaf4667`. Latest reviewed development head: `fix/ci-regression-tests` at `055db1a9231e8f415f5e7ab9f03406110fd0a02f` (2026-10-13). This is a repository-level assessment, not a claim that production has been tested.

## Current state

DARSCHYN is a web application for IAU course planning. The Chrome extension is one possible data-ingestion source; it is not the product itself.

| Area | State | Evidence / next step |
| --- | --- | --- |
| React/Vite frontend | Build-verified on preview commit | Vercel preview returns HTTP 200; route-level lazy loading reduced the initial JS chunk from 699.41 kB to 271.06 kB (gzip 188.64 kB to 85.17 kB). This does not verify API behavior. |
| Express API | Source-reviewed; runtime not deployed on Vercel | Vercel is serving the frontend only; `/api/health` is not a valid backend check on that preview. Run API tests and a production-like Node staging instance separately. |
| Authentication and roles | Partially regression-covered; execution pending | Login role routing and recovery-challenge replay protection are in source. Password recovery challenge expiry and replay prevention now have regression tests in source; the test suite has not yet been executed. The route still needs malformed-body handling and route-level tests before release. |
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

**Verification at the time of this branch update:** tests and typecheck had not been executed in the working environment. A later Vercel preview build succeeded for the frontend and bundled server entry point, but Vercel does not execute the test or typecheck scripts. Therefore, tests/typecheck remain unverified, and no live Educationalyar verification has been performed. No GitHub Actions workflow has been verified.


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

- Latest application-code baseline: `d0895c5ebfc307f02fe68dbb14af410295be6780`; password-recovery expiry and request-schema tests were subsequently added in commits `66138da8832a2cb11c2a894ea7909d1877002747`, `508923ba63f6132df892aa151495ef0ce4cf2d24`, `8a8b8bc16189a72889f98e37e849734e3e5b3ded`, and `cd822bff89bc88fdd66b89946c36bd36c834450d`. Vercel status for the latest code commit is successful. PR #1 remains Draft and unmerged.
- Vercel build/deployment: successful for the application-code commit above. A docs-only follow-up may trigger a separate preview build; it does not change runtime behavior.
- Unit tests and TypeScript typecheck: not yet executed; treat newly added tests as unverified until a test runner reports success.
- Dependency audit: the build reported 11 findings (3 moderate, 7 high, 1 critical); a fresh JSON audit report is required before mapping them to specific packages and choosing compatible fixes.
- Password recovery: helper now rejects expired/malformed-expiry challenges and prevents replay after a successful reset; regression cases were added. Tests have not been executed. The HTTP route still uses manual body checks, so malformed non-string fields may produce a server error and should be covered with route-level validation/tests.
- The Educationalyar collector remains frozen. Do not change its source, parser, dependencies, or version as part of these follow-ups.
- Do not merge PR #1, deploy to production, or alter the VPS/TakinTech setup without explicit approval.

## Authentication validation and reproducible verification (2026-10-13)

- Centralized Iranian mobile normalization in `server/auth/normalize-mobile.ts`; the auth schemas now normalize supported Persian/Arabic digits and Iranian international prefixes, then validate the canonical `09xxxxxxxxx` shape. This removes the previous permissive `.or(z.string())` fallback that made the mobile regex ineffective.
- The OTP password-recovery payload now has an explicit Zod schema and is wired into `POST /api/auth/recover-password`, so malformed body fields are rejected before route logic calls string methods.
- Expanded `tests/password-recovery.test.ts` to cover canonicalization, malformed mobile values, missing credentials, and the OTP recovery payload shape.
- Added `scripts/verify.sh` and `npm run verify`. The command requires Bun, performs `bun install --frozen-lockfile`, then runs TypeScript check, the full Vitest suite, and production build/package verification in that order.
- **Execution status:** these latest changes have not yet been run in a Node environment. The verification script is committed but not yet executed; do not treat the new tests as passing until actual output is captured. This environment could not resolve GitHub from a local shell, and the isolated remote test sandbox could not be created. No merge or production deployment has occurred.

## OTP hardening and verification status (2026-10-13)

- OTP send/verify endpoints reject malformed payload fields, normalize Iranian mobile formats through the shared normalizer, validate the canonical mobile format, and allow only `login` and `password_recovery` purposes.
- A source review found an incorrectly escaped digit matcher in the OTP route that would reject otherwise valid mobile numbers and OTP codes. The matcher is corrected, expiry checks now reject challenges at the exact expiry instant, and route-level regression cases cover valid versus malformed input paths.
- The newest Vercel preview for commit `055db1a9231e8f415f5e7ab9f03406110fd0a02f` is `READY`. Its build log confirms the extension packaging verification, Vite production build, and server bundle completed. This is **build verification only**, not a test-suite or typecheck result.
- A small local Node smoke check passed for the corrected mobile/OTP digit patterns. Full Vitest and TypeScript execution remain unverified in this assistant environment because the repository checkout and project dependencies are not available here; the verification script also requires Bun, which is not installed in this environment.
- GitHub Actions is intentionally excluded from verification because the user's Actions quota is exhausted. Do not trigger or inspect Actions runs. Do not claim the suite passed, and do not merge PR #1 until a real internal test/typecheck run is available and green.


## Latest OTP maintenance note (2026-10-13)

Expired and consumed CAPTCHA/OTP challenge records are pruned during OTP/CAPTCHA requests to keep transient verification state bounded. A regression test was added for expired-record cleanup. The source and build are reviewed, but the Vitest suite and TypeScript check have not yet been executed in this environment. GitHub Actions is excluded because its quota is exhausted.


## Follow-up security review (2026-10-13)

- Fixed a password-recovery lifecycle regression in challenge pruning: a successfully verified `password_recovery` OTP must remain available until the reset endpoint marks the challenge as recovered. Consumed login OTPs and expired challenges can still be pruned. Added a regression test for preserving the verified recovery challenge.
- Updated the request-validation middleware to use Zod 4's `ZodError.issues` API instead of the legacy `errors` alias, and added a route-level regression test for malformed registration payloads returning structured HTTP 400 validation details.
- These are source changes and regression tests only. Vitest and TypeScript have **not** been executed in this environment. Do not merge until an actual test/typecheck/build run is green; GitHub Actions remains intentionally excluded because its quota is exhausted.


## Sync scope hardening (2026-10-13)

Student sync requests can no longer choose a different campus from the campus assigned to their own student profile. A student without a campus assignment cannot submit an arbitrary campus override. Explicit campus overrides remain available to accounts with administrative access, while the existing extension flow (which omits `campusId`) continues to resolve the campus from the profile. Regression coverage was added to the security test suite. Runtime tests and TypeScript checks remain unexecuted in this environment.

## Root privilege escalation guard (2026-10-13)

- Removed automatic super-admin promotion based solely on a successful login or `/api/auth/me` request whose mobile number matches `ROOT_OWNER_MOBILE`. Those paths now require the trusted bootstrap identity `usr-super` as well as the configured mobile.
- Public registration always assigns the student role; root privileges must come from trusted database bootstrap, not possession of a reserved phone number.
- This closes a privilege-escalation path if an existing JSON database lacks the configured root user and someone registers that mobile number. Existing-database root provisioning still needs a separate migration/bootstrap review; no credentials or production data were changed.
- Runtime tests and typecheck remain unexecuted here. Do not merge until verification is genuinely green.
