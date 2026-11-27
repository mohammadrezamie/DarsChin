// Portable verification script: does not require GitHub Actions or a production database.
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// CI stages are opt-in; the original local full gate stays unchanged.
const args = process.argv.slice(2);
const stage = args[0]?.match(/^--ci-stage=(source|typecheck|tests|build)$/)?.[1];
const shard = args[1]?.match(/^--shard=([1-9]\d*)\/([1-9]\d*)$/);
if (args.length && (!stage || (stage === 'tests'
  ? args.length !== 2 || !shard || Number(shard[1]) > Number(shard[2])
  : args.length !== 1))) {
  console.error('Usage: verify.cjs [--ci-stage=source|typecheck|build | --ci-stage=tests --shard=N/TOTAL]');
  process.exit(2);
}

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

const fullSteps = [
  ['Check official documentation language', ['run', 'docs:check']],
  ['Check tracked public-source safety', ['run', 'repo:public-check']],
  ['Install dependencies using the committed Bun lock', ['install', '--frozen-lockfile']],
  ['TypeScript check', ['run', 'lint']],
  ['Unit and regression tests', ['run', 'test']],
  ['Production build and extension verification', ['run', 'build']],
];

const steps = stage === 'source' ? fullSteps.slice(0, 2)
  : stage === 'typecheck' ? fullSteps.slice(2, 4)
  : stage === 'tests' ? [fullSteps[2], ['Unit and regression test shard', ['run', 'test', '--shard=' + shard[1] + '/' + shard[2]]]]
  : stage === 'build' ? [fullSteps[2], fullSteps[5]]
  : fullSteps;

try {
  for (const [title, args] of steps) {
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
    console.log(stage ? '\nPASS: CI stage ' + stage : '\nPASS: frozen Bun installation, typecheck, tests and production build.');
    console.log('Note: this does not verify live Educationalyar, SMTP/SMS, or production deployment.');
  }
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
