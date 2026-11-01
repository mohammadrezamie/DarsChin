// Lightweight, offline repository hygiene audit. Never deletes or modifies files.
// The preexisting tracked data/darschyn-db.json requires a deliberate safe migration.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const names = fs.readdirSync(root);
const unsafe = names.filter(name =>
  /^(?:fix_|test_|update_|mount_sync\.cjs$|generate_report\.py$)/.test(name)
);
const required = [
  'src/components/GuestHumanCheck.tsx',
  'src/components/AdminSmsCenter.tsx',
  'server/security/turnstile.ts',
  'server/sms/service.ts',
  'docs/REPOSITORY_STRUCTURE_FA.md',
  'scripts/legacy',
  'deploy/.env.vps.example',
];
const missing=required.filter(name=>!fs.existsSync(path.join(root,name)));
if (unsafe.length || missing.length) {
  if (unsafe.length) console.error('One-off files must be archived under scripts/legacy/:',unsafe.join(', '));
  if (missing.length) console.error('Required structure missing:',missing.join(', '));
  process.exitCode=1;
} else {
  console.log('PASS: repository layout conventions and legacy script archive.');
  console.log('WARNING: tracked JSON database requires planned migration before Git untracking.');
}
