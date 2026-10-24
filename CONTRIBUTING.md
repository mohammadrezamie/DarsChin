# Contributing to DarsChin

Thanks for contributing to the DarsChin demo platform. For full procedures, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Branch and PR process

1. Create a short-lived branch from current `main` using `feat/`, `fix/`, `docs/`, or `chore/`.
2. Keep each change focused and document its intended observable behavior.
3. Run a clean dependency install, TypeScript check, relevant tests, and build **when possible**. If a check is unavailable, mark it as not run; never claim that GitHub Actions or static inspection passed it.
4. Do not commit `.env` files, real user or university exports, password/OTP/recovery materials, mutable database state, build archives, or debug logs.
5. Open a PR using the repository template. Link the related issue and explain rollback and test boundaries.

### Academic rules

Changes to prerequisites, co-requisites, failed-prerequisite exceptions, eligibility criteria, grade thresholds, curriculum rules or semester limits **require explicit project-owner approval**, even when a change appears corrective. See the owner-approved brief on development PR #1.

### Code review

Review data ownership, authorization, migration risks, and student privacy first. A frontend preview is not proof that the Express API works; Graphify is useful for impact analysis but is not a test runner. Do not merge runtime, security or persistence changes based only on source review.
