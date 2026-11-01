# DARSCHYN VPS deployment

> **Shared-VPS 2026-10-25:** اگر تکین روی این VPS با Nginx روی پورت‌های ۸۰/۴۴۳ فعال است، نصب درس‌چین را با [راهنمای دامنهٔ مستقل](../docs/VPS_SHARED_DOMAIN_FA.md) و فقط کانتینر `darschin` پشت پورت محلی جدا انجام بده. نمونهٔ Caddy کامل برای سرور **اختصاصی/خالی** است، نه کنار Nginx تکین. [راهنمای پیامک و کپچا](../docs/TAKIN_REFERENCE_SMS_CAPTCHA_FA.md) را نیز قبل از فعال‌کردن فرم‌های عمومی بخوان.\n\n
This deployment recipe is intentionally isolated from TakinTech. It uses one Node.js process managed by systemd and the existing Nginx installation; it does not add a second database service or alter the TakinTech virtual host.

## Important constraints

- The app currently listens on port **3000** in `server.ts`. Do not start another service on that port. Before installing, check `sudo ss -ltnp | grep ':3000 '`; if occupied, stop and resolve the conflict deliberately rather than changing TakinTech.
- The application persists its database to `data/darschyn-db.json` relative to its working directory. Keep that data outside release code at `/var/lib/darschyn` and link `/opt/darschyn/current/data` to it.
- In production the server defaults to `127.0.0.1:3000`; the example systemd unit pins that setting. Keep Node private and let Nginx be the only public entry point. If you override `HOST`, ensure it remains loopback unless there is a deliberate, reviewed reason otherwise.
- Do not point DARSCHYN at TakinTech's database, environment file, release directory, or storage.
- This app's JSON database is suitable only while its write/concurrency and recovery limitations are acceptable. Take verified backups before accepting real student data; this guide does not claim JSON persistence is equivalent to MariaDB.
- The systemd unit uses hardening options. `ReadWritePaths` deliberately grants writes only to the persistent data directory. If the app later needs other runtime write paths, review them individually instead of disabling hardening wholesale.
- Do not put real credentials in GitHub or this repository.

## 1. Preflight (read-only)

Run these before making server changes:

```bash
free -h
df -h /
sudo ss -ltnp | grep -E ':(80|443|3000)\b' || true
systemctl --no-pager --type=service --state=running | grep -E 'nginx|mariadb|mysql|php.*fpm|darschyn' || true
node --version
npm --version
```

The existing VPS is small (2 vCPU / 2 GB RAM). Check current memory pressure and disk headroom before installing dependencies or building. Build on a separate machine if RAM is tight, then transfer a verified release artifact; don't risk TakinTech availability to force a build on the production host.

## 2. Create a dedicated account and persistent directory

Review each command before running it. These commands create DARSCHYN-only paths and do not touch TakinTech paths.

```bash
sudo adduser --system --group --home /opt/darschyn --no-create-home darschyn
sudo install -d -o root -g root -m 0755 /opt/darschyn
sudo install -d -o root -g root -m 0755 /opt/darschyn/releases
sudo install -d -o darschyn -g darschyn -m 0750 /var/lib/darschyn
sudo install -d -o root -g root -m 0750 /etc/darschyn
sudo install -d -o root -g root -m 0750 /var/backups/darschyn
```

Use a release directory under `/opt/darschyn/releases/<commit-sha>`, and point `/opt/darschyn/current` to the chosen release. In each release, create the data link:

```bash
ln -s /var/lib/darschyn /opt/darschyn/releases/<commit-sha>/data
```

Do not run `npm run demo:reset` against production data. Never replace `/var/lib/darschyn/darschyn-db.json` with a seed or sample database.

## 3. Build a release

Use the intended development branch/commit only after reviewing its PR. Do not deploy `main` or merge PR #1 as an implied part of this setup.

In a clean release checkout with the supported Node.js runtime installed:

```bash
npm ci
npm run lint
npm test
npm run build
```

Do not run a production start command with credentials embedded in shell arguments. First create `/etc/darschyn/darschyn.env` with an editor, then use systemd for the controlled startup. The app currently requires `JWT_SECRET`, `ROOT_OWNER_MOBILE`, and `ROOT_OWNER_PASSWORD`; keep the recovery key private too. Use a unique high-entropy JWT secret (for example, generate one locally with `openssl rand -hex 32`) and never commit it.

Build verification creates an extension ZIP in the repository root; keep the artifact in the release if the app's download endpoint is expected to serve it.

## 4. Environment file

Create `/etc/darschyn/darschyn.env` with an editor, not by committing it:

```dotenv
ROOT_OWNER_MOBILE=REPLACE_WITH_OWNER_MOBILE
ROOT_OWNER_PASSWORD=REPLACE_WITH_A_UNIQUE_LONG_PASSWORD
ROOT_OWNER_RECOVERY_KEY=REPLACE_WITH_A_UNIQUE_RANDOM_SECRET
JWT_SECRET=REPLACE_WITH_A_UNIQUE_HIGH_ENTROPY_SECRET
# Configure these only when enabling production OTP/SMS:
NIAZPARDAZ_API_KEY=
NIAZPARDAZ_SENDER_NUMBER=5000249
```

The server imports authentication middleware at startup, so `JWT_SECRET` must be present before the process starts. OTP/SMS endpoints will fail in production until `NIAZPARDAZ_API_KEY` is configured; don't advertise OTP login/recovery as available before that is verified.

Then restrict access:

```bash
sudo chown root:darschyn /etc/darschyn/darschyn.env
sudo chmod 0640 /etc/darschyn/darschyn.env
```

Important: the current database initializer returns early when a database file already exists. Therefore, setting these variables later does **not** automatically create the root account in an existing database. Verify the initial root account and recovery path before onboarding users; do not delete the database to force bootstrap.

## 5. Install the service

Copy `deploy/darschyn.service.example` to `/etc/systemd/system/darschyn.service`, then verify the paths, account, environment file, and data link. Confirm the actual Node binary path with `command -v node`; if it is not `/usr/bin/node`, update `ExecStart` to the verified absolute path before enabling the service.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now darschyn
sudo systemctl --no-pager --full status darschyn
sudo journalctl -u darschyn -n 100 --no-pager
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
sudo ss -ltnp | grep ':3000 '
```

Confirm the listener is bound to `127.0.0.1:3000`, not `0.0.0.0:3000`. The Nginx upstream should use the loopback address.

Do not proceed if the health check fails or logs show database/bootstrap errors.

## 6. Nginx and HTTPS

1. Buy/choose the independent DARSCHYN domain.
2. Add DNS A records for the apex and any `www` name you intend to serve, pointing to this VPS. Do not change TakinTech DNS.
3. Copy `deploy/nginx-darschyn.conf.example` into a new DARSCHYN-only Nginx site file and replace the example hostname.
4. Test and reload Nginx only after confirming the new config does not change existing sites:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

5. Once DNS resolves to the VPS, issue HTTPS for the new domain using the server's established certificate tooling. Verify both HTTPS and the existing TakinTech domain afterward.

Do not enable a catch-all server block or reuse TakinTech's certificate/configuration unless it explicitly covers the new domain.

## 7. Backup and recovery gate

Before real student data is accepted, establish and test a backup routine for `/var/lib/darschyn/darschyn-db.json` and any uploaded/imported data. A backup is not verified until a restore has been tested against a separate, non-production copy. Keep backups outside the web root, restrict permissions, and define retention. JSON writes are atomic at the file level, but this alone is not a backup or a recovery plan.

## 8. Acceptance checks

- `https://<domain>/` returns the DARSCHYN page.
- `https://<domain>/api/health` returns JSON status `ok`.
- Registration and login work; root account and admin permissions are verified.
- Course plan changes survive a controlled service restart.
- API routes return JSON errors instead of the SPA HTML on invalid API paths.
- Extension download returns the expected ZIP if this feature is in scope.
- Nginx routes the DARSCHYN hostname only to port 3000; TakinTech's site remains unchanged.
- A backup restore is tested before real student data is accepted.

## Current verification status

These files are deployment guidance/templates, not evidence that the server has been changed or the app deployed. Run the repository's lint, tests, and production build on a named commit before calling a release verified. Test against a staging copy before accepting real student data.

## P0 data-store survival guard — provision once, then fail closed

The JSON datastore is **one-process only**. All updates now use uniquely named,
private 0600 temporary files, flush their contents, atomically rename over the
old file, and flush the directory on POSIX. If serialization or rename fails
before replacement, the old database remains intact.

**First setup:** Keep `DARSCHYN_REQUIRE_EXISTING_DB=false` until the existing
`DARSCHYN_DATA_DIR/darschyn-db.json` is created by the **verified** release,
its permissions are restricted and a separate backup can actually be restored.
After proving that the real service points to the durable data volume, set
`DARSCHYN_REQUIRE_EXISTING_DB=true` in **DarsChin's own** private environment
and restart only that service under the approved deployment plan. Thereafter,
missing/unmounted/corrupt data **must** fail startup (nonzero) and keep all
original bytes, rather than silently replacing students with demo/empty data.

Do not use `rm`, `mv`, clearing the data directory, or resetting the
service to sample seed data as a repair strategy. Restore from a separately
verified backup. This guard does **not** verify Nginx, systemd restart stability,
real SMS, multi-instance atomicity or the earlier shared-VPS crash root cause.
See [durable storage gate](../docs/DURABLE_DATABASE_GATE_FA.md).
