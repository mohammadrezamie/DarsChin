# DARSCHYN Development Levels

Levels are capability milestones, not claims that the code is already complete. Preserve existing features unless a change is explicitly documented and tested.

## Level 0 — Repository integrity and reproducible checks
**Goal:** establish a reliable baseline.
- One canonical frontend and extension source.
- Reproducible dependency installation.
- CI runs typecheck, tests, and production build.
- Test data is isolated; no real secrets or user data in fixtures.
**Done when:** clean checkout passes all required checks, or every failure is documented with a reproducible issue.

## Level 1 — Academic policy engine
**Goal:** make eligibility and unit limits policy-driven.
- Prerequisites normally require a passed course.
- Co-requisites can be taken in the same term where rules permit.
- Applicable IAU failed-prerequisite exception can allow the failed course and dependent course together in a later term.
- Normal term: 12–20 units.
- Previous-term GPA above 17 can raise the cap to 24; cumulative GPA must not be substituted.
- Final term: 2–24 units and configured final-term exceptions.
- Extra-unit courses are admin-configurable, not hardcoded by course name.
**Done when:** every rule has positive and negative regression tests.

## Level 2 — Authentication and authorization
**Goal:** reliable sessions and least privilege.
- Correct login result handling and role-aware navigation.
- Server-side authorization for every protected route.
- No public privilege escalation or demo-role bypass in production.
- Recovery/OTP flows use one consistent contract.
**Done when:** negative and positive route-level security tests pass.

## Level 3 — Student workspace
**Goal:** a coherent student workflow.
- Profile and academic history.
- Eligible offerings and blocked-course explanations.
- Ranked course list; copying a prioritized item copies only that course code.
- Selected offerings drive the weekly timetable and collision checks.
**Done when:** key workflows have UI/API tests and preserve course-to-offering identity after reordering.

## Level 4 — Administration
**Goal:** safe, auditable configuration.
- Manage courses, curricula, prerequisites/co-requisites, offerings, academic policy, users, and permissions.
- Validate input on the server.
- Audit sensitive administrative changes.
**Done when:** permissions are enforced by the API and CRUD flows have regression tests.

## Level 5 — Product and landing experience
**Goal:** communicate real product capabilities without misleading mock data.
- Responsive landing page and clear login/registration actions.
- Animated sections remain accessible with reduced-motion preferences.
- Download CTA points to a built, versioned extension package.
**Done when:** responsive and accessibility checks pass and all claims match shipped features.

## Level 6 — Educationalyar extension
**Goal:** collect offerings robustly from the supported portal.
- Search Classes detection, pagination, batching, normalization, deduplication, and diagnostics.
- Minimal host permissions.
- No hardcoded localhost API endpoint in the release build.
**Done when:** fixture tests pass and a separate live verification is recorded for the current portal.

## Level 7 — Sync and reconciliation
**Goal:** turn collected snapshots into trustworthy canonical offerings.
- Validate ownership, chunk order, schema, and payload size.
- Idempotent processing and retry-safe finalization.
- Normalize stable offering identity.
- Reconcile missing records without deactivating offerings when a sync is incomplete.
- Preserve history across server restarts.
**Done when:** repeated uploads produce no duplicates and incomplete/failed jobs cannot corrupt active offerings.

## Level 8 — Automated data ingestion
**Goal:** support multiple authorized ingestion sources.
- Source adapters feed a shared normalized ingestion pipeline.
- Record provenance, timestamps, and reconciliation results.
- Avoid requiring repeated manual uploads when a reliable authorized source is available.
**Done when:** each source adapter has contract tests and observable failure handling.

## Level 9 — Production hardening
**Goal:** safe operation.
- Strict environment validation; production never uses development secrets.
- Rate limiting, structured redacted logs, backups, restore drills, and migration strategy.
- Health/readiness checks and documented deployment/rollback.
**Done when:** security and recovery procedures are exercised, not merely documented.

## Level 10 — External APIs and scale
**Goal:** add official APIs and larger deployments without changing core academic rules.
- Keep source-specific parsing out of the domain engine.
- Add database-backed persistence when operational requirements justify it.
- Monitor performance, sync freshness, and source failures.
**Done when:** external integrations have versioned contracts, observability, and migration-safe rollout plans.
