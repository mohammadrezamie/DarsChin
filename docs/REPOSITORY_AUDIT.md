# DarsChin repository audit — 2026-10-24

This is a **source review** of the private GitHub repository. It is not a successful test run, an application runtime review, an audit of the live Educationalyar portal, or production approval.

## Confirmed findings

| Finding | Evidence | Current handling |
| --- | --- | --- |
| The default branch lacks a top-level README | `main` tree (2026-10-24) | Draft PR #3 adds setup, validation and contribution guidance |
| Local setup omits required `JWT_SECRET` | `server/middleware/auth.ts` throws without it, while `.env.example` omits it | Draft PR #3 supplies the name and secure-generation instructions; no secret is committed |
| Mutable local database is already versioned | `data/darschyn-db.json` contains account/contact and credential-related fields | [Issue #4](https://github.com/mohammadrezamie/DarsChin/issues/4) requests owner classification and a safe persistence migration. No records were published, modified, or removed by this audit |
| Two substantial development branches are open | PR #1 (web UX and sync reconciliation), PR #3 (repository hygiene) | PR #1 stays Draft until full verification; PR #3 is limited to safe documentation and repository setup |
| GitHub Actions verification for PR #1 has not succeeded | The latest PR #1 head reports two failed `verify` checks (2026-10-13) | Do not confuse Vercel preview success or feedback checks with passing tests. Follow the existing documented Actions quota constraint and verify locally/offline before merging |
| The default branch has no active branch protection | GitHub branch metadata for `main` | Recommend enabling review and passing check requirements **after** a reliable CI runner exists; no administrative change made |
| Multiple source/artifact paths need provenance checks | `src/pages/landing-sections`, `app/applet/src/pages/landing-sections`, extension ZIP archives, root-level fix/test helper scripts | Do not delete or deduplicate before import, packaging, and release references are verified |

## Priority order

1. Confirm whether the existing tracked database contains real or synthetic account data before changing or untracking it; follow [Issue #4](https://github.com/mohammadrezamie/DarsChin/issues/4).
2. Run the verification commands for PR #1 in a separate, disposable development environment with no production secrets or student data. Its GitHub Actions jobs currently do not provide passing evidence.
3. Review the sync adapter against explicitly approved source fixtures, and verify API authorization, persistence and rollback behavior before merge. Never claim fixture correctness proves current portal compatibility.
4. Agree on safe branch protection after verified CI is available; avoid breaking the contributor workflow with required checks that cannot run.
5. Trace build/release references before removing historical ZIP files, code copies or temporary helper scripts. Release artifacts and runtime data should not be conflated.

## Operational boundaries

- No production deployment, merge to `main`, source history rewrite, secret rotation, or user-data deletion was made during this audit.
- No academic-policy, eligibility, or collector behavior was changed.
- Tests, typechecking and build were **not executed** as part of the repository-hygiene updates.
- Do not post credential values, real phone numbers, or student-level details in issues, PR bodies, or logs.
