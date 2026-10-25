# Deployment and rollback runbook

DarsChin's current stack includes a React/Vite frontend, Express API and JSON file persistence. A frontend-only Vercel deployment **does not host the Express API**. A fully functional release needs a persistent Node.js host, writable database storage and reverse proxy (or a separately implemented backend deployment). This is a repeatable checklist, not an automatic production launch.

## 1. Prepare (one-time infrastructure)

- Choose a domain, DNS, TLS certificates and a Node.js 22 host.
- Reserve an unused local service port (configure `PORT` and `HOST` in the service environment; production defaults to loopback). Prevent port conflicts with other services.
- Create a dedicated service account, private secrets file and separate persistent database path with restricted permissions.
- Restore **sanitized demo fixtures** or a separately verified backup; never ship hardcoded demo credentials as a live public service.
- Verify that `ROOT_OWNER_MOBILE`, `ROOT_OWNER_PASSWORD` and `JWT_SECRET` have been safely configured **before initial bootstrap**; changing root env variables after a database exists may not trigger bootstrap.
- Use the reviewed templates in `deploy/` and verify the actual host, domain, ports and writable data path before starting the service.

## 2. Validate the selected release commit (offline checks)

Before launching a real staging host, run `node scripts/staging-preflight.cjs` with the service's private environment configured. This read-only check rejects a missing JWT secret, repository-local persistence and unsafe database permissions. It **does not** start a server, migrate a database, validate actual secret entropy or replace a restore test. Details: [student workspace / staging readiness](STUDENT_WORKSPACE_STAGING_FA.md).


```bash
bun run verify
bun run smoke:api
```

Install Bun on the verification machine; the command uses synthetic credentials and an isolated temporary database. The smoke command uses only a temporary local JSON database and loopback listener. Use a separate synthetic test database, not the deployment database. Capture the exact SHA and test results. Check the extension version/ZIP and ensure no unreviewed generated artifact will be committed.

## 3. Release and smoke test

Build on an isolated machine with `bun install --frozen-lockfile` and `bun run build`. Install the release under a versioned directory; install only its runtime dependencies and required build outputs. Make the persistent data directory survive release swaps. Start the Node service through a process manager (systemd or equivalent), behind a TLS reverse proxy.

- `/api/health` must return JSON, not HTML. The current health endpoint has a legacy version field; do not use it alone as release evidence.
- Test login, admin authorization, course planning, and read/write behavior on a controlled fixture.
- Restart the service and verify state persists.
- Request an invalid `/api/*` route and verify JSON 404.
- Check logs for secrets and errors; audit the extension download only if enabled.
- Keep public release closed to real student data until privacy/security checks and a tested backup restore have passed.

## 4. Roll back

Stop writes, make a restricted backup of runtime state, switch the release symlink or service command back to the last known good SHA, and restart. Verify health, login and persistence. **Do not roll back the database file automatically**: it may contain newer user data and schema changes. Review compatibility and migrate only with a verified backup.

## Important limitations

- The JSON database is not multi-instance-safe by default. Use one controlled Node process; do not enable horizontal scaling without replacing/reviewing persistence.
- OTP/SMS requires separately configured production credentials, and the external university collector requires real-source verification. Neither follows from a green frontend preview.
- A minutes-long cutover is realistic **only after** the host, DNS/TLS, secrets, backups, and validated release have been prepared in advance.
- No production deployment, DNS, cloud resource or live database is changed by this document.
