# Security policy / سیاست امنیتی درس‌چین

DarsChin is a public, self-hostable codebase. The maintainer's private deployment, passwords, access tokens, SMS service keys, students' data and other operators' deployments are **not** public development resources.

## Permanent security requirements

Every contributor and independent operator must follow the [permanent security contract (Persian)](docs/PERMANENT_SECURITY_POLICY_FA.md): source/data separation, server-side authorization, no unsafe production registration, durable writes, sensitive logging/cache protections, sanitized Git and reviewed dependencies, exact-SHA testing, backups, and incident response. The repository's historical exposure is **not closed** simply because these rules are documented.

## Private vulnerability reporting

Please **do not** disclose real secrets, student identifiers, account records, reproducible credential data, exploit details, or private database samples in public Issues, Discussions or Pull Requests.

If GitHub **Private vulnerability reporting** is enabled, open the repository's **Security → Advisories → Report a vulnerability** form to contact the maintainer privately. This file does not itself enable that feature. Maintainers should enable it under **Settings → Advanced Security → Private vulnerability reporting**. If the private form is not available, request a private disclosure channel from the repository maintainer without publishing the technical details.

For urgent exposed credentials: revoke/rotate them at the affected service immediately through its owner/operator, then follow GitHub's sensitive-data removal guidance. Do not commit credentials to prove the issue.

## Deployment and operational boundaries

- Public source is **not** proof that the service is ready to deploy with real students.
- Deploy a fresh, separately configured instance with private environment variables and persistent data outside source control; never reuse exposed credentials or a historical Git checkout.
- Do not attach an unrelated instance to the maintainer's server, data or authentication services.
- Keep public demo fixtures separate from real user data.

## Historical disclosure incident

The current main tree no longer tracks the previously exposed runtime database and retired executable scripts. This does **not** purge old pull request refs, cached diffs, forks, third-party clones or previously leaked credentials.

See [Security incident runbook](docs/SECURITY_INCIDENT_RUNBOOK_20261101_FA.md) and [technical safeguards](docs/SECURITY.md) for exact status and operator-only tasks.

## Supported versions

Security fixes are applied to the latest maintained `main` source. Old snapshots, stale branches and historical PR commits are **not** supported deployment releases.
