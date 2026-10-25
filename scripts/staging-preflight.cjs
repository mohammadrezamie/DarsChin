// Read-only, secret-safe preflight for a future single-process staging host.
// This never creates files, deploys, touches the database or prints secret values.
const fs = require('node:fs');
const path = require('node:path');

function stagingPreflight(env, repoRoot = path.resolve(__dirname, '..'), filesystem = fs) {
  const failures = [];
  const warn = [];
  if (env.NODE_ENV !== 'production') failures.push('NODE_ENV must be production');
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) failures.push('JWT_SECRET must be configured with at least 32 characters');
  if (!env.ROOT_OWNER_MOBILE || !env.ROOT_OWNER_PASSWORD || !env.ROOT_OWNER_RECOVERY_KEY) {
    failures.push('Private root bootstrap credentials must be configured');
  }
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) failures.push('PORT must be a valid TCP port');
  if (env.HOST && !['127.0.0.1', '::1', 'localhost'].includes(env.HOST)) {
    warn.push('HOST is not loopback; verify container isolation and firewall before exposure');
  }
  if (!env.DARSCHYN_DATA_DIR) {
    failures.push('DARSCHYN_DATA_DIR must be an explicit persistent path outside the repository');
  } else {
    const dataPath = path.resolve(env.DARSCHYN_DATA_DIR);
    const relative = path.relative(repoRoot, dataPath);
    if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
      failures.push('Persistent data must not live inside the checked-out repository');
    }
    try {
      const info = filesystem.statSync(dataPath);
      if (!info.isDirectory()) failures.push('Persistent data path must be a directory');
      else filesystem.accessSync(dataPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      failures.push('Persistent data directory must exist and be readable/writable by the service user');
    }
    const dbFile = path.join(dataPath, 'darschyn-db.json');
    try {
      const stat = filesystem.statSync(dbFile);
      if (!stat.isFile()) failures.push('Existing database path must be a regular file');
      if ((stat.mode & 0o077) !== 0) failures.push('Existing database file must not be readable or writable by group/others');
    } catch (error) {
      if (error && error.code !== 'ENOENT') failures.push('Unable to inspect the current database file permissions');
      else warn.push('No database exists yet; bootstrap must use synthetic staging users only');
    }
  }
  if (Number(process.versions.node.split('.')[0]) < 22) failures.push('Node.js 22 or newer is required');
  return { ok: failures.length === 0, failures, warnings: warn };
}

if (require.main === module) {
  const result = stagingPreflight(process.env);
  for (const item of result.failures) console.error('FAIL: ' + item);
  for (const item of result.warnings) console.warn('WARN: ' + item);
  if (result.ok) console.log('PASS: staging host configuration passed static checks (not a deployment or DB restore test).');
  else process.exitCode = 1;
}

module.exports = { stagingPreflight };
