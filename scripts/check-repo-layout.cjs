// Lightweight, offline repository hygiene audit. Never deletes or modifies files.
// Repository source safety is checked separately by check-public-source.cjs.
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
  'scripts/legacy/README.md',
  'deploy/.env.vps.example',
];
const missing=required.filter(name=>!fs.existsSync(path.join(root,name)));
if (unsafe.length || missing.length) {
  if (unsafe.length) console.error('One-off scripts must not be committed:',unsafe.join(', '));
  if (missing.length) console.error('Required structure missing:',missing.join(', '));
  process.exitCode=1;
} else {
  console.log('PASS: repository layout conventions and legacy deprecation notice.');
  console.log('Run bun run repo:public-check before source publication; review Git history separately.');
}
