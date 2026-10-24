# Repository maintenance checklist

This repo is a demo intended for quick future launch **after one-time infrastructure preparation**. The goal is repeatable delivery, not implying production readiness.

## Weekly / before merging

- [ ] Confirm default branch, open PRs and overlapping changes
- [ ] Review CODEOWNERS-sensitive areas (`server/`, `src/domain/`, `extension/`, `data/`)
- [ ] Check TypeScript, tests, and build at the **exact PR SHA** using a disposable runner when Actions quota is unavailable
- [ ] Review credentials, user data, fixtures and binary artifacts in the diff
- [ ] Confirm academic rules were not silently changed
- [ ] Check lockfile/toolchain consistency; do not force-upgrade dependencies without compatibility review
- [ ] Update README and release notes for operational or product changes

## Release gate

Use [deployment runbook](DEPLOYMENT.md). Freeze the release commit, validate the Express API separately from frontend preview, smoke-test a restart and isolated backup restore, and document rollback.

## Backlog / retained risks

- [Issue #4](https://github.com/mohammadrezamie/DarsChin/issues/4): classify the tracked JSON database and migrate runtime storage safely; do not rewrite Git history based on guesses
- [PR #1](https://github.com/mohammadrezamie/DarsChin/pull/1): large sync and UX feature; verify live-source assumptions separately from fixtures
- [PR #5](https://github.com/mohammadrezamie/DarsChin/pull/5): administrative redaction, awaiting executed security regression checks
- Resolve source duplication and packaging artifacts only after import/build provenance checks

## GitHub configuration guidance

- CODEOWNERS and PR templates are versioned in this repository.
- `main` was unprotected during the October 24 review. Introduce branch protection when dependable checks and reviewer availability are established. Do not require an exhausted Actions check that nobody can satisfy.
- Keep deploy keys and environment secrets in provider secret stores, not repository files.
- Graphify's latest observed DarsChin index is `61837f9` from September 23; refresh it after major mergers before using change-impact results as current source context.
