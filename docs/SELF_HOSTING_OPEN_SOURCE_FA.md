# DarsChin — Self-hosted open-source deployment (2026-11-01)

**GitHub repo stays public. A public source repository does not expose a running server's private environment or make its accounts public by itself.** MIT permits others to clone, modify and run their **own** instances. The author's VPS, data, credentials, domain and brand identity are separate concerns.

## Goal: one upstream, independent installs

- The canonical source is `mohammadrezamie/DarsChin`, `main`. Existing deployments should continue tracking the **same repository**; do not fork or re-create a second server codebase just to keep a private instance.
- Separate installations configure different `JWT_SECRET`, `ROOT_OWNER_*`, domains, persisted volumes and SMS settings. Do **not** share those across installations, and do not keep mutable data in the Git checkout.
- Public code does not imply open account registration. `DARSCHYN_ACCESS_MODE=owner_only` restricts **backend APIs** to the configured and authenticated reserved root owner. `multiuser` keeps the existing student-facing platform behavior and is the compatibility default.
- **Static pages and browser-only demos remain publicly reachable** with `owner_only`. To make *everything* private, additionally use reverse-proxy authentication, IP allowlisting or a private VPN/tunnel. Do not rely on hidden frontend buttons for access control.

## Installation on a new dedicated server (Docker Compose + Caddy)

```bash
git clone https://github.com/mohammadrezamie/DarsChin.git
cd DarsChin
cp deploy/.env.vps.example deploy/.env.vps
chmod 600 deploy/.env.vps
```

Edit `deploy/.env.vps` **locally on your server**, setting at minimum:
- `DARSCHYN_DOMAIN` and `ACME_CONTACT_EMAIL` for the proxy, with DNS/HTTPS ready.
- Strong independent `JWT_SECRET`, `ROOT_OWNER_MOBILE`, `ROOT_OWNER_PASSWORD`, `ROOT_OWNER_RECOVERY_KEY`.
- `DARSCHYN_ACCESS_MODE=owner_only` for a private root-run site, or `multiuser` for a student-facing platform.
- On first **verified** provisioning only, `DARSCHYN_REQUIRE_EXISTING_DB=false`. In all later deployments, after checking the persisted database/backup/restore, set it to `true`.
- `DARSCHYN_REGISTRATION_OTP_REQUIRED=true` **before accepting public student registration**, only after real SMS provider readiness is verified. The default `false` is not proof of mobile ownership.

```bash
docker compose --env-file deploy/.env.vps config -q
docker compose --env-file deploy/.env.vps up -d --build
docker compose --env-file deploy/.env.vps ps
```

This starts a Caddy HTTPS proxy and Node container with a **named persistent volume** mounted at `/app/data`. It is only suitable if no other Nginx/Caddy owns ports 80/443 and the dedicated VPS setup is compatible. **No real-VPS smoke test is claimed here.**

## Existing shared VPS using Nginx (do not touch other sites)

Never run the bundled `proxy` service on a shared 80/443 host. Keep the existing Nginx untouched and run the same application image in the optional loopback port overlay:

```bash
# Choose a free localhost port in your private deploy/.env.vps (for example 3001).
docker compose -f compose.yaml -f compose.pilot-ssh.yaml \
  --env-file deploy/.env.vps config -q
docker compose -f compose.yaml -f compose.pilot-ssh.yaml \
  --env-file deploy/.env.vps up -d --build darschin
curl -fsS http://127.0.0.1:3001/api/health
```

Proxy configuration for the separate domain must be validated against the VPS's real upstream port and TLS. Never copy this sample over TakinTech's active virtual host. The mounted `darschin-data` volume is outside `git pull`, but its retention must be verified before any destructive Docker operation; do **not** use `docker compose down -v` on a real installation.

## Update without a second source tree

1. Back up the existing application data and verify a **test restore** to a separate location. Do not include private database snapshots in public CI.
2. Identify the last green integration SHA. Check that the server's `deploy/.env.vps` remains untracked and that its database volume is healthy.
3. In the existing DarsChin checkout, run `git pull --ff-only origin main` and rebuild **only** the `darschin` service with the existing Compose file combination.
4. Confirm `/api/health`, login, authorization, persistence after restart, and the surrounding site on the shared host. Revert using a separately preserved release plus data-safe restore procedures if required.
5. Keep `DARSCHYN_REQUIRE_EXISTING_DB=true` after initial verification; a missing or corrupt DB must fail the startup rather than silently regenerate sample accounts.

A server tracking `main` is **not compatible with an uncoordinated force-push history rewrite**; do not attempt this as a shortcut to scrub old secrets. Coordinate clones, PRs, tags and GitHub Support first.

## Emergency root credential rotation without a second codebase

If an old root credential may have been disclosed, **changing the private env file alone does not change the password hash stored in an existing database**. This repository includes an offline-only command in the normal Docker image. It is **not** an HTTP API or a recurring startup migration.

1. Confirm a verified, access-restricted copy of the real data and a test restore **outside Git**; verify the running service's DB volume and the root's configured phone match.
2. During a controlled maintenance window, **stop only DarsChin**, not the shared Nginx or other applications: `docker compose -f compose.yaml -f compose.pilot-ssh.yaml --env-file deploy/.env.vps stop darschin` (omit `-f compose.pilot-ssh.yaml` on a dedicated installation).
3. Update **both** `ROOT_OWNER_PASSWORD` and `ROOT_OWNER_RECOVERY_KEY` to **new, distinct** strong values in the server's private `deploy/.env.vps`. Preserve the configured root mobile and volume name. Ensure `DARSCHYN_REQUIRE_EXISTING_DB=true`.
4. Run a read-only identity check using the same Compose file combination and **without** starting the web server:

```bash
docker compose -f compose.yaml -f compose.pilot-ssh.yaml --env-file deploy/.env.vps \
  run --rm --no-deps --entrypoint node darschin scripts/rotate-root-credentials.cjs --check
```

5. Only after verifying the service is stopped, run the explicit apply (the confirmation is a boolean, **not** a password passed on the command line):

```bash
docker compose -f compose.yaml -f compose.pilot-ssh.yaml --env-file deploy/.env.vps \
  run --rm --no-deps -e DARSCHYN_OFFLINE_MAINTENANCE_CONFIRMED=true \
  --entrypoint node darschin scripts/rotate-root-credentials.cjs --apply
```

6. The command validates a single reserved root, saves a `0600` private backup of the **old, sensitive** database in the existing volume, atomically replaces the database with new bcrypt password/recovery verifiers and increments the root `sessionVersion`. It changes no student records. Keep the old backup restricted and remove it later only under a tested retention/restore policy.
7. Restart **only DarsChin** and test root login, denial of old tokens, persistence and health. Do not rerun with the same credentials; the tool intentionally refuses a same-password rotation.

**Critical:** The web process must be stopped for the **entire** offline operation. A second process using this JSON database can overwrite the rotated file with old in-memory data. The command cannot automatically prove all processes are stopped. This only rotates the reserved root; **any other affected account, provider API keys, JWT signing secrets, caches, backup copies and historical Git refs need separate review/rotation.** The root change does not remove an old personal phone number from public history.

For complete privacy of static pages and browser-only demo as well as the API, use a **VPN or carefully reviewed IP allowlist** on the existing Nginx vhost. This avoids conflicting with the Bearer Authorization header used by the app. Test access from the operator's devices before restricting an existing public hostname.

## Security incident — unresolved public history

The repository once tracked a JSON database with an identifiable non-demo account, a password verifier and a recovery key. Removing it from current HEAD **does not remove it from Git history, old PRs or caches**. Treat that credential material as disclosed: revoke/rotate any affected credentials and sessions, including active root/provider secrets if those were ever committed. In particular, modifying `ROOT_OWNER_PASSWORD` in the ENV **does not reset an existing root password hash in the persisted database**. Use an authenticated password-change flow or a reviewed offline repair, then check session invalidation.

GitHub's [sensitive-data removal instructions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) discuss first rotating credentials, then carefully rewriting history and coordinating with support if needed. No destructive rewrite or real-server rotation is claimed by this guide.

## Open-source license and contributions

Project-authored code is released under [MIT](../LICENSE), subject to any distinct license notices on bundled third-party assets/dependencies. You may run your own instance; that does **not** grant access to the author's private runtime data, server or credentials, or imply permission to impersonate the brand. `package.json` uses `"private": true` to prevent accidental npm registry publication; it does **not** make the GitHub repository private or block `git clone`.

See [security](SECURITY.md), [private-data incident](PUBLIC_REPOSITORY_READINESS_20261101_FA.md), [existing shared VPS](VPS_SHARED_DOMAIN_FA.md), and [quality gate](QA_WITHOUT_ACTIONS_FA.md).
