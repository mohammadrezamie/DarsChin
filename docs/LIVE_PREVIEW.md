# Live Vercel preview workflow

DarsChin remains a **demo**. The GitHub repository is linked to Vercel project `dars-chin`.

## Branch responsibilities

- `main` — reviewed stable source, connected to Vercel's production target. Do not push exploratory changes or unverified features directly.
- `develop` — ongoing integration and the stable, branch-based **Vercel Preview**. Changes here are for observation and feedback, **not** a public production release.
- `feat/*`, `fix/*`, `docs/*` — small focused work branches. Prefer draft PRs while testing.

For each feature: branch → review/test with `bun run verify` and targeted smoke tests → create/update a feature preview → integrate in `develop` → inspect Vercel Preview visually → promote only approved changes to `main` via a reviewed PR. Always record the exact commit used for testing.

## Where to view it

In Vercel, go to the **dars-chin** project → **Deployments** and filter by Git branch `develop`. The stable branch alias assigned by Vercel can be bookmarked; its destination advances as new successful previews are deployed. Individual deployments have immutable URLs for comparison and rollback.

**READY on Vercel is a frontend build result, not a passing test of the Express API or database.** The Vercel project currently uses the Vite framework; it does not host the long-lived Node/Express server. Account login, sync, user data and persistence need separate backend staging. Never use real student or university credentials in a frontend-only preview.

## Verification and release discipline

1. Make changes in a focused branch and complete source review.
2. Run `bun run verify` in an isolated environment. For server changes also run `bun run smoke:api`, and document any limits.
3. Check preview pages at mobile and desktop widths: Persian RTL, navigation, contrast, animations and console errors.
4. For persistence/auth changes verify a controlled server restart and a separate restore from a backed-up **synthetic** database before accepting real users.
5. Submit promotion PR to `main` with the reviewed SHA and clear rollback instructions.

Do not force GitHub Actions runs while the account's runner quota is exhausted, and do not require a status check that cannot execute. Keep private keys and runtime database files outside Git and outside frontend environment variables.

## Persistent limitation

A branch-based frontend preview is **not** a complete interactive demo of authenticated workflows. Preparing an isolated API staging URL with durable test-only data is a distinct deployment task and should be reviewed before provisioning public resources.
