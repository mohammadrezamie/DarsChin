# Course Demand Assessment (نیازسنجی دروس)

## Purpose

Allow an authorized department/group manager to ask students which curriculum courses they intend to take in a specified future term, so the department can estimate demand before deciding which offerings to arrange.

This is a demand signal, not course registration and not a promise that a course will be offered.

## Proposed workflow

1. An authorized manager selects the academic term and the target academic cohort/context (campus, major, entry-year curriculum, and track when applicable).
2. The manager creates a survey, chooses courses from the approved curriculum, sets opening/closing times, and publishes it.
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

## Approved academic-policy requirements

The implementation must call the existing eligibility/domain policy rather than create a second, divergent set of prerequisite rules.

- **Prerequisite example:** Mathematics 2 has Mathematics 1 as its prerequisite. The course relationship must be represented as a prerequisite, not mislabeled as a co-requisite.
- **General dependency rule:** For a course that requires another course, whether as a true co-requisite or under an applicable approved exception after the student failed a prerequisite, the student must either have already passed the required course or select it in the same target-term demand response alongside the dependent course.
- **Block incomplete selections:** If the required course has not been passed and has not been selected in the same response, the dependent course cannot be selected/submitted in the demand survey. The interface should explain which required course must be added. The server must enforce this too; client-side checks alone are insufficient.
- **Failed prerequisite exception:** Allow the prerequisite and dependent course to be taken together only when the approved IAU rule applies. Do not generalize this exception to unrelated prerequisite relationships or invent additional academic exceptions.
- **Dynamic validation:** When a student adds or removes a course from the response, recalculate dependent-course eligibility. On submission, validate the final set of selected courses as a whole, so valid course pairs can be submitted together and incomplete dependency sets are rejected.

The demand survey is still not course registration. The eligibility engine should explain why a dependent course is blocked and what course must be added, while respecting the student's curriculum, academic history, and applicable approved rule.

## Suggested implementation boundary

- Domain service: resolve the applicable curriculum and calculate eligible course IDs by reusing the canonical engine; support evaluating a proposed selection set together, not only each course in isolation.
- API: create/list/publish/close surveys, read eligible courses, submit/update a response, and return aggregate results.
- Persistence: surveys, response records, and audit events using the repository's existing data conventions initially; introduce schema migrations if persistence is moved to a relational database later.
- UI: manager survey builder/results view and student demand-selection view.
- Tests: authorization, survey scope, duplicate prevention, closed survey rejection, curriculum membership, tampered course IDs, prerequisite/co-requisite pair selection, failed-prerequisite exception boundaries, eligibility revalidation, aggregate counts, and privacy boundaries.

## Status

Policy requirements above are confirmed by the academic owner. Feature remains proposed and is not implemented yet. Before implementation, inspect the current eligibility engine and verify it can enforce the confirmed rules; if its behavior conflicts with these requirements, do not silently change academic policy—surface the exact conflict for approval.
