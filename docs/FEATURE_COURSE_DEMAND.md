# Course Demand Assessment (نیازسنجی دروس)

## Purpose

Allow an authorized department/group manager to ask students which curriculum courses they intend to take in a specified future term, so the department can estimate demand before deciding which offerings to arrange.

This is a demand signal, not course registration and not a promise that a course will be offered.

## Proposed workflow

1. An authorized manager selects the academic term and the target academic cohort/context (campus, major, entry-year curriculum, and track when applicable).
2. The manager creates a survey, chooses eligible courses from the approved curriculum, sets opening/closing times, and publishes it.
3. A student sees only surveys applicable to their academic profile.
4. The server evaluates each candidate course against the student's current academic profile and the canonical eligibility engine. The UI must not be trusted to enforce eligibility.
5. The student selects one or more courses they are interested in. The system revalidates eligibility on submission and rejects ineligible course IDs.
6. The manager sees aggregate demand per course and can export a report. Individual student choices should not be exposed by default unless an explicit, approved operational need requires it.

## Required safeguards

- Demand responses are scoped to one survey and one student.
- A student can have at most one active response per survey; editing replaces their prior selection rather than adding duplicate votes.
- Counts are derived from current response records, not maintained as an independently mutable counter.
- Closing, archiving, and reopening a survey must preserve its history and audit trail.
- Survey creation and results access require server-side permissions.
- The server validates survey scope, term, curriculum membership, survey state, timestamps, student identity, and every submitted course ID.
- The survey must clearly say that submitting demand does not register the student in a course.
- Reports should show response counts and demand per course; disclose the number of eligible students in the target cohort only if that population can be computed reliably.
- Do not use stale client-side eligibility results as authority. Re-evaluate on submission and return clear explanations when a choice is no longer eligible.

## Academic policy gate — approval required

The implementation must call the existing eligibility/domain policy rather than create a second, divergent set of prerequisite rules.

**Open question requiring academic-owner approval:** For a co-requisite course that the student has not already passed, should it be selectable in a demand survey only when the student also selects its co-requisite course in the same survey response, or should the demand survey use strict standalone eligibility and hide it until the co-requisite has been passed?

This is a product-policy decision, not a technical default. Do not ship either interpretation until it is approved.

The existing IAU exception for a previously failed prerequisite must also be applied only as currently approved in the academic policy engine; do not broaden it during demand-survey work.

## Suggested implementation boundary

- Domain service: resolve the applicable curriculum and calculate eligible course IDs by reusing the canonical engine.
- API: create/list/publish/close surveys, read eligible courses, submit/update a response, and return aggregate results.
- Persistence: surveys, response records, and audit events using the repository's existing data conventions initially; introduce schema migrations if persistence is moved to a relational database later.
- UI: manager survey builder/results view and student demand-selection view.
- Tests: authorization, survey scope, duplicate prevention, closed survey rejection, curriculum membership, tampered course IDs, eligibility revalidation, aggregate counts, and privacy boundaries.

## Status

Proposed; not implemented. Academic-policy behavior remains blocked on explicit approval of the co-requisite interpretation above.
