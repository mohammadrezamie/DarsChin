// Fast, offline, HEAD-only guard for tracked files in a public repository.
// Never prints secret values; scans tracked text and bounded ZIPs, not Git history or PR refs.
// This complements (does not replace) a professional secret scanner.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { scanZipArchive } = require('./scan-zip-archives.cjs');

const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const TEXT_EXTENSIONS = /\.(?:cjs|mjs|js|jsx|ts|tsx|json|jsonl|md|txt|html|css|scss|yaml|yml|toml|xml|sql|sh|ps1|py|example|webmanifest|conf)$/i;

function isSensitivePath(file) {
  const name = file.replace(/\\/g, '/');
  return /^scripts\/legacy\/.*\.(?:cjs|mjs|js|ts|tsx|py|sh)$/i.test(name) ||
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

// Committed examples must never contain an actual operator's identity or
// credential. Safe non-secret feature defaults may remain for compatibility.
const ENV_TEMPLATES = new Set([
  '.env.example', 'deploy/.env.vps.example', 'deploy/.env.staging.example',
]);
const EMPTY_TEMPLATE_FIELDS = new Set([
  'JWT_SECRET', 'ROOT_OWNER_MOBILE', 'ROOT_OWNER_PASSWORD',
  'ROOT_OWNER_RECOVERY_KEY', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY',
  'TURNSTILE_ALLOWED_HOSTNAMES', 'NIAZPARDAZ_API_KEY',
  'NIAZPARDAZ_SENDER_NUMBER', 'ACME_CONTACT_EMAIL', 'DARSCHYN_DOMAIN',
  'DARSCHYN_RELEASE_SHA',
]);

function findPopulatedEnvTemplateFields(contents) {
  const populated = [];
  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && EMPTY_TEMPLATE_FIELDS.has(match[1]) && match[2].trim()) {
      populated.push(match[1]);
    }
  }
  return populated;
}

function scanTrackedFiles(root, names) {
  const findings = [];
  for (const file of names) {
    if (isSensitivePath(file)) {
      findings.push({ path: file, type: 'sensitive-file-path' });
      continue;
    }
    const isZip = /\.zip$/i.test(file);
    if (!TEXT_EXTENSIONS.test(file) && !/(^|\/)Dockerfile$/i.test(file) && !isZip) continue;
    const full = path.resolve(root, file);
    // Do not follow tracked symlinks to arbitrary files outside checkout.
    const stat = fs.lstatSync(full, { throwIfNoEntry: false });
    if (!stat || stat.isSymbolicLink()) {
      findings.push({ path: file, type: 'unreadable-or-symlink' });
      continue;
    }
    if (!stat.isFile() || stat.size > (isZip ? 8 * 1024 * 1024 : MAX_TEXT_BYTES)) {
      findings.push({ path: file, type: 'unscanned-text' });
      continue;
    }
    if (isZip) {
      for (const result of scanZipArchive(fs.readFileSync(full), findSecretKinds, findPopulatedEnvTemplateFields)) {
        findings.push({ path: file, type: result.type });
      }
      continue;
    }
    const contents = fs.readFileSync(full, 'utf8');
    if (ENV_TEMPLATES.has(file.replace(/\\/g, '/'))) {
      for (const key of findPopulatedEnvTemplateFields(contents)) {
        findings.push({ path: file, type: 'populated-example-' + key });
      }
    }
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
  console.log('LIMITS: no Git history/PR refs, unknown secrets, generic entropy or production secret validation.');
}

if (require.main === module) main();
module.exports = { isSensitivePath, findSecretKinds, scanTrackedFiles, findPopulatedEnvTemplateFields };
