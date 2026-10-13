# DARSCHYN Project Status

> Last reviewed against repository branch `main` at commit `61837f949d015e899c46a5be55e9070eafaf4667`. This is a repository-level assessment, not a claim that production has been tested.

## Current state

DARSCHYN is a web application for IAU course planning. The Chrome extension is one possible data-ingestion source; it is not the product itself.

| Area | State | Evidence / next step |
| --- | --- | --- |
| React/Vite frontend | Present | Run lint, tests, and production build in CI. |
| Express API | Present | Add route-level regression tests and health-check coverage. |
| Authentication and roles | Implemented, needs regression coverage | Verify login failure, role redirects, token expiry, and authorization boundaries. |
| Academic policy engine | Implemented, partially tested | Expand tests for prerequisite exceptions, co-requisites, term limits, and final-semester rules. |
| Local JSON persistence | Present; operational risks remain | Test persistence across restart and isolate test data from development data. |
| Educationalyar extension | Present | Verify against current real portal DOM; fixture tests alone are not end-to-end verification. |
| Sync/reconciliation | Incomplete until proven otherwise | The current `server/routes/sync.ts` stores snapshots but does not process them into course offerings. Implement and test an idempotent processor before claiming completion. |
| CI | Being established | GitHub Actions workflow checks install, typecheck, tests, and build. Execution depends on available Actions quota. |
| Production readiness | Not verified | No production-readiness claim until security, persistence, backup, deployment, and real-source sync tests pass. |

## Known risks identified during review

- Login code previously treated the object returned by `login()` as a boolean and always navigated on a truthy object.
- Sync route currently contains a placeholder comment where snapshot processing should occur.
- Database sync history and test isolation need dedicated persistence regression tests.
- `.env.example` currently documents only Root-owner values; the complete runtime configuration must be documented when the environment configuration is centralized.
- Repository contains old helper scripts and a checked-in extension ZIP; do not delete or regenerate artifacts without verifying the canonical build path.

## Verification language

Use these labels in reports:

- **Code-reviewed:** inspected source; not executed.
- **Unit-tested:** automated test passed on a named commit.
- **Build-verified:** production build completed on a named commit.
- **Fixture-verified:** tested against a controlled fixture.
- **Live-verified:** tested against the actual external service or deployed environment.

Never describe code review or fixture verification as live verification.
