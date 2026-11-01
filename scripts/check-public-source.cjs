// Source-control hygiene gate for an intentionally public DarsChin repository.
// Checks ONLY tracked paths: untracked local databases are never opened or deleted.
// The Git history must be reviewed separately; this gate cannot erase old commits.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = spawnSync('git', ['ls-files', '--cached', '-z'], {
  cwd: root, encoding: 'utf8', shell: false,
});
if (output.error || output.status !== 0) {
  console.warn('SKIP: Git index unavailable. Public-source hygiene requires a full Git checkout.');
  process.exit(0);
}
const paths = output.stdout.split('\0').filter(Boolean);
const bad = paths.filter((file) => {
  const normalized = file.replace(/\\/g, '/');
  if (/^data\/.*\.(?:json|jsonl|sqlite3?|db|csv|xlsx?|log|bak)$/i.test(normalized)) return true;
  if (/(^|\/)\.env(?:\.|$)/i.test(normalized) && !/\.example$/i.test(normalized)) return true;
  if (/\.(?:pem|p12|pfx|jks|keystore)$/i.test(normalized)) return true;
  if (/(^|\/)(?:id_rsa|id_ed25519|credentials\.json|service-account(?:-.*)?\.json|secrets\.json)$/i.test(normalized)) return true;
  return false;
});
if (bad.length) {
  console.error('FAIL: potentially sensitive tracked files:');
  for (const file of bad) console.error('  ' + file);
  console.error('Remove these files from the Git index, review HISTORY and rotate exposed credentials before publishing.');
  process.exit(1);
}
console.log('PASS: no known local runtime data or secret-file paths in the Git index.');
console.log('NOTE: full Git history, pull requests, logs and content-based secret scanning remain separate gates.');
