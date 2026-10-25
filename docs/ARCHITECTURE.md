# DARSCHYN Architecture

## Product boundary

DARSCHYN is the student course-planning application. The Chrome extension is an ingestion adapter, not the application itself.

## Main layers

1. **Client UI** — React pages, student/admin workspaces, forms, timetable, and course prioritization.
2. **API** — Express routes; authentication and authorization must be enforced server-side.
3. **Domain** — academic policy, eligibility, schedule conflicts, and recommendations. Domain rules should not depend on the source from which course data arrived.
4. **Ingestion adapters** — extension, future official APIs, or explicitly supported imports.
5. **Normalization and reconciliation** — validate raw source records, normalize identifiers and times, deduplicate, track provenance, and reconcile complete snapshots.
6. **Persistence** — users, academic data, offerings, sync jobs/snapshots, and audit history.

## Intended data flow

```text
Educationalyar / authorized source
             |
             v
      Source adapter
             |
             v
 Validate -> Normalize -> Deduplicate
             |
             v
       Sync job + chunks
             |
             v
 Complete-snapshot reconciliation
             |
             v
 ImportBatch + manager review records
             |
             v
 Checked source/course/class permissions
             |
             v
 Audited publication flow (NOT YET AVAILABLE)
             |
             v
 Canonical course offerings
             |
       +-----+------+
       |            |
       v            v
 Eligibility   Timetable/conflicts
       |            |
       +-----+------+
             v
      Student recommendations
```

## Invariants

- **Student extension snapshots must never write canonical offerings.** Completed sync jobs queue normalized candidates for human review; independent audited publication is intentionally disabled.
- A source adapter must not directly implement academic policy.
- A partial or failed sync must never mark unseen offerings inactive.
- Replaying the same completed snapshot must be idempotent.
- Every sync job and snapshot must be scoped to its owner and validated server-side.
- Sync history must survive a process restart.
- Secrets belong in environment configuration, never in source code, fixtures, logs, or API responses.
- A successful HTTP response is not proof that the external source was parsed correctly.

## Current implementation caveat

The earlier sync route directly applied matched student-provided snapshots to campus-wide offerings. The Draft PR changes this to **review staging only**: validated candidates become import-review records, job status becomes `AWAITING_REVIEW`, submitted raw snapshots are cleared after finalization, and no class is published. Historical `RECONCILED` jobs may predate this boundary and cannot be treated as proof of review. **New sync tests, TypeScript, build and actual browser QA have not been verified in this session.** The Vercel preview still lacks a connected persistent API. See [the Educationalyar review policy](EDUCATIONALYAR_IMPORT_REVIEW_FA.md) and [fullstack deployment plan](VERCEL_FULLSTACK_PLAN_FA.md).
