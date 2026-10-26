# DARSCHYN Master Development Prompt

> Canonical project brief and operating contract for any AI coding agent working on DARSCHYN (درس‌چین). Read this file before planning or changing code. If it conflicts with a more recent explicit instruction from the project owner, follow the newer instruction and update this document only when appropriate.

## 0. Mandatory GitHub record of **every** owner instruction

**The owner confirmed this as a permanent top-priority project rule on 2026-10-25.** Every owner request, feature idea or plan, changed priority, reported defect, decision, restriction, pending question and superseding instruction **must be committed into the DarsChin GitHub repository**, even if the actual implementation is postponed. Do not rely on chat history, agent memory or an unmerged branch as the canonical record. For each new instruction:

1. Read and append a dated, non-sensitive entry to [OWNER_DECISIONS_FA.md](OWNER_DECISIONS_FA.md), including a stable reference ID, priority, implementation/verification status, dependency and related PR/Issue; link to a more detailed document when appropriate.
2. Update the relevant product/architecture/testing/academic document, and [INDEX.md](INDEX.md) for new documents. Mark superseded decisions explicitly instead of quietly deleting history; apply the owner's newer explicit instruction.
3. Show what was **committed on a branch**, what was **merged into main**, and what was only **planned, untested or undeployed**. Test evidence must belong to the exact commit.
4. Never commit personal data, live student responses, secrets or private project material just to preserve an instruction.
5. Read [AGENTS.md](../AGENTS.md) as the stable agent contract. All other sections of this prompt remain subordinate to owner decisions recorded after them, within security and policy boundaries.

**Immediate owner priority:** a sale-ready, thoroughly verified **demand-survey workflow** (multi-entry-year surveys, per-student manager reports and self-reported final-term segmentation) before secondary features. Target is approximately 2–3 weeks after 2026-10-25, not an unverified production promise. Prefer clean code, local quality gates and safe authorization over rushed merges.

## 1. Mission and product boundary

Build DARSCHYN as a reliable, secure, maintainable web platform that helps Islamic Azad University (IAU) students understand course eligibility, plan course selection, compare offerings, build a weekly timetable, and helps authorized academic/department staff manage curriculum data and estimate course demand.

**The web application is the product. The Chrome extension is only one data-collection adapter for Educationalyar (آموزشیار).** Do not treat the extension as the main application or couple academic rules to a particular ingestion source.

The platform must explain why a course is eligible or blocked. It is an assistant/planning tool, not the official university registration system; a demand survey is not registration and does not promise that a course will be offered.

## 2. Autonomy and approval boundary

The project owner has delegated broad autonomy for product ideation and implementation. Work independently on non-academic implementation, architecture, UX, accessibility, security, testing, documentation, maintainability, and operational reliability.

**Explicit approval is mandatory before changing, inventing, broadening, narrowing, or reinterpreting any educational policy or eligibility rule.** When an implementation task exposes an ambiguous academic rule:
1. Preserve current behavior rather than silently changing it.
2. Document the exact ambiguity and affected behavior.
3. Ask the owner a focused question and wait for approval before changing the rule.
4. Continue independent work on unrelated, non-policy areas where possible.

Examples of academic-policy changes requiring approval include prerequisite/corequisite semantics, failed-prerequisite exceptions, final-semester exceptions, unit limits, GPA thresholds, curriculum/track eligibility, and course-specific exceptions.

## 2.1 Per-curriculum academic condition configuration (owner decision 2026-10-25)

**Owner decision [OWN-022–023](OWNER_DECISIONS_FA.md) overrides earlier hardcoded assumptions.** Course-specific requirements, including internship/project credit thresholds, are **admin-editable data scoped to an explicit university/campus/degree/major/entry-year/curriculum version**, not constants or universals. A course may have zero, one or multiple prerequisites/corequisites; support minimum passed-credit predicates and AND/OR relations. Never insert real numeric thresholds automatically into new chart conditions, and never ask the owner to enumerate per-course thresholds; the owner will maintain them in the panel. Prior sample course names/numbers are not official policy.

**Educational-policy semantics and overrides remain a separate approved layer.** Before asking the owner anything, review the applicable current regulation, issued by a verifiable official authority, including edition/date/entry-year scope. Ask only unresolved broad interpretation questions with a source reference. If the valid source cannot be verified, disclose the gap and never claim an officially approved eligibility result. See [academic source research](ACADEMIC_REGULATION_RESEARCH_FA.md).

## 3. Confirmed academic requirements

Treat these as owner-confirmed requirements, but inspect current code and tests before claiming they are implemented correctly:

- A prerequisite normally must have been passed.
- Example: Mathematics 2 has Mathematics 1 as its prerequisite; do not relabel this relationship as a co-requisite.
- Where a true co-requisite applies, the student must either have already passed the required course or select that course in the same target-term selection set.
- The owner has specified the same paired-selection behavior for an applicable IAU failed-prerequisite exception: if the student is permitted to take the failed prerequisite together with its dependent course, the required course must be selected alongside the dependent course in that same term.
- If the required course is neither passed nor included in the same selection set, block the dependent course and clearly identify the missing course. Enforce this on the server, not only in the UI.
- The failed-prerequisite exception is limited to the applicable approved IAU rule. Do not generalize it to every prerequisite relationship.
- Eligibility must be evaluated against the student's curriculum, entry-year, major, track where applicable, and academic history.
- Previously passed courses are not normally selectable for repeat study unless an explicitly approved rule allows it.
- Normal term load: 12–20 units.
- If the **previous term's GPA** is above 17, the maximum may rise to 24 units. Do not substitute cumulative GPA.
- Final semester: 2–24 units, subject to the approved policy configuration.
- Extra-unit courses must be configurable by an administrator (for example, an `isExtraUnit` property), not hardcoded by course name.
- These rules must be enforced by the canonical policy/eligibility engine. Do not create a second competing implementation in the demand survey, frontend, extension, or import code.

If existing code conflicts with a confirmed rule, first add a focused regression test or evidence report where feasible, then propose the smallest safe correction. Do not use the need for a code fix as permission to introduce additional academic policy.

## 4. Core product capabilities

### Student experience
- Student profile and academic history.
- Curriculum-aware eligible and blocked offerings with clear explanations.
- Course prioritization; copying a prioritized item copies only that course's code.
- A weekly timetable generated from selected offerings, with schedule collision detection.
- Eligibility recalculates when academic history, chosen offerings, or the target selection set changes.
- Accessible, responsive, understandable Persian-first experience; preserve English-language support where the app provides it.

### Course demand assessment
- An authorized department/group manager selects a term and applicable cohort context, then creates a survey using courses from the approved curriculum.
- Students see only surveys applicable to their academic profile.
- The student can select only courses allowed by the canonical eligibility engine.
- For dependencies that require paired selection, evaluate the proposed set as a whole: the required course must already be passed or be included in the same response.
- Revalidate every submission on the server; never trust client-side eligibility.
- One current response per student per survey; editing replaces the prior selection.
- Demand counts are derived from response records. Preserve survey history and audit events.
- Show aggregate results by default; do not expose individual student choices without an approved operational need.
- Clearly state that demand assessment is not official course registration and does not guarantee a course will be offered.

### Administration
- Manage courses, curricula, curriculum-to-course mappings, tracks, academic rules, offerings, users, roles/permissions, and applicable configuration.
- Validate on the server, apply least privilege, and audit sensitive changes.
- Do not bypass authorization in UI-only logic.

### Ingestion and synchronization
- Normalize incoming records into canonical offerings independent of source.
- Track ownership, provenance, term, source timestamps, sync jobs, snapshots, and reconciliation outcomes.
- Replaying the same complete snapshot should be idempotent.
- Partial, malformed, or failed syncs must never deactivate unseen active offerings.
- Sync history must survive process restarts.
- Validate chunk order, payload size/schema, ownership, job state, and finalization before processing.
- Prefer official authorized APIs where available; retain the extension as one adapter rather than hardcoding source behavior into the domain engine.

**Collector freeze:** While the Educationalyar offered-courses interface/source is unavailable or has not been made available for verification, do not live-debug, invent portal DOM/data, or perform speculative refactors to the collector. Work on isolated normalization, API contracts, sync reconciliation, and fixture-based tests is allowed when it does not assume unverified portal behavior. Clearly label fixture checks versus live verification.

## 5. Architecture principles

Expected layers:
1. React/Vite client UI.
2. Express API with authentication and server-side authorization.
3. Domain services for eligibility, academic limits, schedule conflicts, and recommendations.
4. Source-specific ingestion adapters.
5. Validation, normalization, deduplication, and complete-snapshot reconciliation.
6. Persistence for users, academic data, offerings, sync history, surveys/responses, and audit records.

Keep academic domain rules independent from external data sources. Avoid duplicate frontend/backend policy logic; the server and canonical domain engine are authoritative. Preserve existing capabilities unless a change is deliberate, documented, and regression-tested.

## 6. Security and privacy requirements

Treat security issues as high priority. Inspect and fix confirmed issues autonomously when the fix does not change academic policy:
- Never expose secrets, tokens, hashes, recovery material, personal data, or privileged bootstrap credentials in source control, public assets, logs, demo endpoints, or API responses.
- Keep privileged access server-enforced; no client-controlled role escalation or demo bypass in production.
- Enforce authorization and object ownership on every protected route to prevent IDORs.
- Validate and bound all request bodies, IDs, file imports, chunk counts, and payload sizes.
- Use redacted structured logging; avoid logging passwords, OTPs, tokens, or student academic details unnecessarily.
- Separate test/demo data from real development/production data.
- Validate environment configuration and fail safely in production when required secrets/configuration are missing.
- Do not print or reproduce live secrets while reporting an issue. Never commit credentials to the master prompt or documentation.

## 7. Required development workflow

For each meaningful task:
1. **Inspect** current branch, relevant code, tests, documentation, and repository status before editing.
2. **State evidence**: distinguish observed source behavior from assumptions, earlier claims, and unavailable external verification.
3. **Plan** the smallest coherent change and identify any academic-policy boundary.
4. **Implement** on a dedicated branch; do not commit directly to `main`.
5. **Test** targeted regression tests first, then typecheck, full tests, and production build where possible.
6. **Review** diffs for regressions, privacy/security issues, accidental generated files, and removed capabilities.
7. **Report** exact changed files, commit/branch/PR links, checks actually executed, failures, and remaining risks.

Do not claim a test, build, CI run, deployment, or live integration passed unless it was actually run and its result observed. If execution is unavailable, label the change code-reviewed but untested and give a reproducible next step. Do not merge PRs or change production state without an explicit request.

## 8. Testing expectations

Prefer regression tests for:
- Authentication success/failure, role redirects, token/session behavior, and server-side authorization.
- Cross-user object access and role escalation denial.
- Academic eligibility positive and negative cases, without changing policy unless approved.
- Prerequisite versus co-requisite distinction; paired selection; failed-prerequisite exception boundaries; final-semester and unit-limit boundaries.
- Dynamic eligibility recalculation and server revalidation of the complete selection set.
- Sync ownership, chunk order/duplicates, payload validation, interrupted/failed jobs, idempotent replay, persistence after restart, and reconciliation safety.
- Demand survey permissions, scope, opening/closing state, duplicate response prevention, tampered course IDs, aggregate counts, and privacy.
- Timetable conflicts and course/offering identity.
- Build packaging and extension release artifact correctness.

Use deterministic fixtures and isolated temporary/test persistence. Tests against fixtures do not prove that Educationalyar currently works.

## 9. Repository and delivery discipline

- Treat the current default branch as the stable baseline; work in focused feature/fix branches and pull requests.
- Never merge or deploy without explicit owner instruction.
- Do not add dependencies or change dependency versions without a clear need; document risk and verify compatibility.
- Do not delete duplicate-looking app/extension directories, generated artifacts, data files, migrations, or legacy code until the canonical source and runtime references have been verified.
- Avoid large unrelated refactors. Preserve functionality and explain any intentional behavior changes.
- Keep project status and architecture documentation accurate: distinguish implemented, partially implemented, proposed, tested, and live-verified capabilities.
- A green status badge or successful HTTP response is not proof of correctness.

## 10. Current known baseline / next priorities

The following were identified in prior source review and must be re-verified against the active branch before relying on them:
- React/Vite frontend and Express API exist; package scripts include `lint` (TypeScript), `test` (Vitest), and `build`.
- Authentication previously mishandled the object returned by `login()`; a fix exists on the current development branch and needs executed regression checks.
- Sync history persistence and accessors have been adjusted on the development branch; the current tests may not fully prove persistence across a real restart.
- `server/routes/sync.ts` previously accepted snapshots and marked jobs complete while explicitly leaving processing into canonical `courseOfferings` unimplemented. Audit and build this safely with fixture tests, without inventing Educationalyar behavior.
- Course demand is documented as a proposed feature; its full UI/API/persistence implementation remains outstanding.
- The academic eligibility engine has a same-term planned-course input, but verify complete-set semantics and edge cases before integrating demand selection.
- CI configuration and Actions execution have not been confirmed as working. Never claim CI passed without a real run.
- Production readiness and live Educationalyar verification are not established.

Recommended priority order:
1. Verify branch/PR state and run available checks.
2. Improve test isolation and persistence/security regression coverage.
3. Harden sync job/snapshot API validation and idempotent reconciliation using fixtures.
4. Complete and test authentication/authorization fixes.
5. Implement demand survey domain/API/persistence/UI using canonical eligibility, after inspecting policy behavior.
6. Improve admin UX, accessibility, error handling, observability, deployment/recovery, and documentation.
7. Verify collector only when the real supported Educationalyar source is available.

## 11. Definition of done

A task is complete only when:
- Its intended behavior is explicit and the change is scoped.
- Academic policy was not silently changed.
- Server-side validation/authorization exists where relevant.
- Regression tests cover the critical behavior.
- The change has been reviewed for security, privacy, and regressions.
- Actual verification status is reported honestly.
- Documentation and the PR explain remaining limitations.

**Working instruction:** Continue independently with the highest-value safe task. Do not stop after writing a plan or documentation. If a policy decision is required, isolate that decision, ask the owner, and continue unrelated safe engineering work.
