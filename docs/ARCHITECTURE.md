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

- A source adapter must not directly implement academic policy.
- A partial or failed sync must never mark unseen offerings inactive.
- Replaying the same completed snapshot must be idempotent.
- Every sync job and snapshot must be scoped to its owner and validated server-side.
- Sync history must survive a process restart.
- Secrets belong in environment configuration, never in source code, fixtures, logs, or API responses.
- A successful HTTP response is not proof that the external source was parsed correctly.

## Current implementation caveat

The earlier baseline did not finalize imported offerings. The current source has a reconciliation implementation and regression tests in `server/sync/reconciliation.ts` and `tests/sync-*.test.ts`; those tests passed in an isolated runner. **This is not an end-to-end verification against live Educationalyar, and the Vercel frontend preview still has no connected production-grade API and durable database.** For current scope and rollout gates see [the fullstack Vercel plan](VERCEL_FULLSTACK_PLAN_FA.md).
