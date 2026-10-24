# Changelog

Notable user-facing and operational changes. This file supplements commit history; it does not replace it.

## Unreleased — integrity and development workflow
- Fixed login handling to inspect the `success` property and route administrators separately from students.
- Preserved sync job/snapshot arrays in the persisted database schema instead of replacing them during initialization.
- Added the canonical master development prompt, project status, development levels, architecture notes, and course-demand specification.
- Added bounded sync chunk validation, duplicate-chunk conflict detection, retry idempotency for identical chunks, and final chunk-sequence validation.
- Added a strict reconciliation adapter for the checked-in nested extension payload, including exact/unique course matching, schedule and capacity validation, stable source identities, and duplicate handling.
- Sync jobs now distinguish data receipt from successful reconciliation; invalid or incomplete final datasets fail atomically without changing existing offerings.
- Updated the landing-page ingestion section to explain received/reconciled/failed outcomes and why a received extract is not automatically trusted.
- Added a permission-protected admin endpoint and live sync-monitoring table for job status, chunk progress, successful reconciliation counts, and failure reasons.
- Added reconciliation tests for nested payloads, malformed schedules, ambiguous matches, empty extracts, duplicate records, and stable identities. Tests/typecheck/build remain unexecuted in this environment.
- No GitHub Actions workflow has been added; automated CI is not yet verified.
- Live Educationalyar verification, a deployable preview, broader persistence tests, and demand-survey implementation remain follow-up work.
