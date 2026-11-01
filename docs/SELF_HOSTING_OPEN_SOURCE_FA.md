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

## Security incident — unresolved public history

The repository once tracked a JSON database with an identifiable non-demo account, a password verifier and a recovery key. Removing it from current HEAD **does not remove it from Git history, old PRs or caches**. Treat that credential material as disclosed: revoke/rotate any affected credentials and sessions, including active root/provider secrets if those were ever committed. In particular, modifying `ROOT_OWNER_PASSWORD` in the ENV **does not reset an existing root password hash in the persisted database**. Use an authenticated password-change flow or a reviewed offline repair, then check session invalidation.

GitHub's [sensitive-data removal instructions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) discuss first rotating credentials, then carefully rewriting history and coordinating with support if needed. No destructive rewrite or real-server rotation is claimed by this guide.

## Open-source license and contributions

Project-authored code is released under [MIT](../LICENSE), subject to any distinct license notices on bundled third-party assets/dependencies. You may run your own instance; that does **not** grant access to the author's private runtime data, server or credentials, or imply permission to impersonate the brand. `package.json` uses `"private": true` to prevent accidental npm registry publication; it does **not** make the GitHub repository private or block `git clone`.

See [security](SECURITY.md), [private-data incident](PUBLIC_REPOSITORY_READINESS_20261101_FA.md), [existing shared VPS](VPS_SHARED_DOMAIN_FA.md), and [quality gate](QA_WITHOUT_ACTIONS_FA.md).
