# Changelog

Notable user-facing and operational changes. This file supplements commit history; it does not replace it.

## Unreleased — integrity and development workflow
- Fixed login handling to inspect the `success` property and route administrators separately from students.
- Preserved sync job/snapshot arrays in the persisted database schema instead of replacing them during initialization.
- Added the canonical master development prompt, project status, development levels, architecture notes, and course-demand specification.
- Added bounded sync chunk validation, duplicate-chunk conflict detection, retry idempotency for identical chunks, and final chunk-sequence validation.
- Added unit tests for sync payload validation and chunk sequence checks; these tests have not yet been executed in this environment.
- No GitHub Actions workflow has been added; automated CI is not yet verified.
- Snapshot reconciliation into canonical `courseOfferings`, broader persistence tests, external-portal live verification, and demand-survey implementation remain follow-up work.
