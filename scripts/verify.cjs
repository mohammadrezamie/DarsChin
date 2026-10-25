// Portable verification script: does not require GitHub Actions or a production database.
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'darschin-verify-'));
const environment = {
  ...process.env,
  NODE_ENV: 'test',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  DARSCHYN_DATA_DIR: path.join(temporary, 'data'),
  MOCK_OTP_CODE: '123456',
  ROOT_OWNER_MOBILE: '09999999999',
  ROOT_OWNER_PASSWORD: crypto.randomBytes(24).toString('hex'),
  ROOT_OWNER_RECOVERY_KEY: crypto.randomBytes(24).toString('hex'),
};

const steps = [
  ['Install dependencies using the committed Bun lock', ['install', '--frozen-lockfile']],
  ['TypeScript check', ['run', 'lint']],
  ['Unit and regression tests', ['run', 'test']],
  ['Production build and extension verification', ['run', 'build']],
];

try {
  // Dependency-free tests for the shared-VPS readiness gate, before any Bun
  // installation or mutable application fixtures. Never touches systemd.
  const readiness=spawnSync(process.execPath,
    ['--test','scripts/check-vps-readiness.test.cjs'],{
      cwd:root,env:environment,stdio:'inherit',shell:false,
    });
  if(readiness.error || readiness.status!==0){
    console.error('P0 readiness gate unit tests failed');
    process.exitCode=readiness.status || 1;
  }
  for (const [title, args] of steps) {
    if(process.exitCode)break;
    console.log(`\n=== ${title} ===`);
    const outcome = spawnSync('bun', args, {
      cwd: root,
      env: environment,
      stdio: 'inherit',
      shell: false,
    });

    if (outcome.error) {
      console.error(`Unable to run Bun: ${outcome.error.message}`);
      console.error('Install Bun (https://bun.sh) and retry: npm run verify');
      process.exitCode = 2;
      break;
    }

    if (outcome.status !== 0) {
      console.error(`Verification failed at: ${title}`);
      process.exitCode = outcome.status || 1;
      break;
    }
  }

  if (!process.exitCode) {
    console.log('\nPASS: frozen Bun installation, typecheck, tests and production build.');
    console.log('Note: this does not verify live Educationalyar, SMTP/SMS, or production deployment.');
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
