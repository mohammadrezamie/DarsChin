// Fast, offline, HEAD-only guard for tracked files in a public repository.
// Never prints secret values; does not scan Git history, PR refs or binary ZIPs.
// This complements (does not replace) a professional secret scanner.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const TEXT_EXTENSIONS = /\.(?:cjs|mjs|js|jsx|ts|tsx|json|jsonl|md|txt|html|css|scss|yaml|yml|toml|xml|sql|sh|ps1|py|example|webmanifest|conf)$/i;

function isSensitivePath(file) {
  const name = file.replace(/\\/g, '/');
  return /^data\/.*\.(?:json|jsonl|sqlite3?|db|csv|xlsx?|log|bak)$/i.test(name) ||
    (/(^|\/)\.env(?:\.|$)/i.test(name) && !/\.example$/i.test(name)) ||
    /\.(?:pem|p12|pfx|jks|keystore)$/i.test(name) ||
    /(^|\/)(?:id_rsa|id_ed25519|credentials\.json|service-account(?:-.*)?\.json|secrets\.json)$/i.test(name);
}

const signatures = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{30,}\b/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['gitlab-token', /\bglpat-[A-Za-z0-9_-]{20,}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['stripe-secret', /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/],
  ['jwt-value', /\beyJ[A-Za-z0-9_-]{18,}\.eyJ[A-Za-z0-9_-]{18,}\.[A-Za-z0-9_-]{18,}\b/],
];

function findSecretKinds(contents) {
  return signatures.filter(([, pattern]) => pattern.test(contents)).map(([name]) => name);
}

function scanTrackedFiles(root, names) {
  const findings = [];
  for (const file of names) {
    if (isSensitivePath(file)) {
      findings.push({ path: file, type: 'sensitive-file-path' });
      continue;
    }
    if (!TEXT_EXTENSIONS.test(file) && !/(^|\/)Dockerfile$/i.test(file)) continue;
    const full = path.resolve(root, file);
    // Do not follow tracked symlinks to arbitrary files outside checkout.
    const stat = fs.lstatSync(full, { throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink()) {
      findings.push({ path: file, type: 'unreadable-or-symlink' });
      continue;
    }
    if (!stat.isFile() || stat.size > MAX_TEXT_BYTES) {
      findings.push({ path: file, type: 'unscanned-text' });
      continue;
    }
    const contents = fs.readFileSync(full, 'utf8');
    for (const kind of findSecretKinds(contents)) {
      findings.push({ path: file, type: kind });
    }
  }
  return findings;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const listed = spawnSync('git', ['ls-files', '--cached', '-z'], {
    cwd: root, encoding: 'utf8', shell: false,
  });
  if (listed.error || listed.status !== 0) {
    if (process.env.CI === 'true' || process.env.DARSCHYN_PUBLIC_SOURCE_GATE_REQUIRED === 'true') {
      console.error('FAIL: Git index unavailable; cannot verify tracked public source.');
      process.exitCode = 1;
    } else {
      console.warn('SKIP: no complete Git checkout; public-source verification has NOT passed.');
    }
    return;
  }
  const findings = scanTrackedFiles(root, listed.stdout.split('\0').filter(Boolean));
  if (findings.length) {
    console.error('FAIL: potential secret or sensitive file detected (values are never printed):');
    for (const item of findings) console.error('  ' + item.path + ' [' + item.type + ']');
    console.error('Review source and historical refs, then rotate any exposed credentials.');
    process.exitCode = 1;
    return;
  }
  console.log('PASS: tracked text paths and known secret signatures checked at current HEAD.');
  console.log('LIMITS: no Git history, PR refs, ZIP contents, generic entropy or production secret validation.');
}

if (require.main === module) main();
module.exports = { isSensitivePath, findSecretKinds, scanTrackedFiles };
