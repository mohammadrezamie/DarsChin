#!/usr/bin/env node
// DarsChin Local Gate. Tests run on a disposable data directory, never production.
// Based on the workflow pattern reviewed READ-ONLY in tnacompany's local-gate.sh.
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function usage() {
  console.log('node scripts/local-gate.cjs [--quick | --full | --browser | --browser-only] [--spec <vitest-file>]');
  console.log('--quick: isolated TypeScript, repo hygiene and Vitest (or one selected test).');
  console.log('--full (default): frozen lock install, typecheck, full tests, build and isolated API smoke.');
  console.log('--browser: full gate plus local Chromium responsive smoke; --browser-only: browser only (requires build).');
}
let mode='full', spec='';
for (let i=2;i<process.argv.length;i++) {
  const flag=process.argv[i];
  if (flag==='--help' || flag==='-h') {usage();process.exit(0);}
  if (['--quick','--full','--browser','--browser-only'].includes(flag)) {mode=flag.slice(2);continue;}
  if (flag==='--spec') {
    const candidate=process.argv[++i];
    if (!candidate || candidate.startsWith('-') || !/^tests\/[a-z0-9-]+\.test\.tsx?$/.test(candidate)) {
      console.error('Invalid --spec; expected tests/name.test.ts[x] (no spaces/traversal).');
      process.exit(2);
    }
    spec=candidate;continue;
  }
  console.error('Unknown Local Gate argument:',flag);process.exit(2);
}
if (spec && mode!=='quick') {
  console.error('--spec only with --quick. The full gate always runs the whole suite.');
  process.exit(2);
}
if (process.env.NODE_ENV==='production' || process.env.DARSCHYN_PRODUCTION==='true' ||
  /^\/var\/www(?:\/|$)/.test(root)) {
  console.error('Refusing to run Local Gate on a production-like environment.');
  process.exit(2);
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'darschin-gate-'));
const env={...process.env,
  NODE_ENV:'test', DARSCHYN_DATA_DIR:path.join(temp,'data'),
  JWT_SECRET:randomBytes(32).toString('hex'),
  ROOT_OWNER_MOBILE:'09999999999',
  ROOT_OWNER_PASSWORD:randomBytes(24).toString('hex'),
  ROOT_OWNER_RECOVERY_KEY:randomBytes(24).toString('hex'),
  MOCK_OTP_CODE:'123456', TURNSTILE_ENABLED:'false',
};
for (const secret of ['NIAZPARDAZ_API_KEY','NIAZPARDAZ_USERNAME','NIAZPARDAZ_PASSWORD','DATABASE_URL']) delete env[secret];
let failed='';
function run(name,command,args,stepEnv=env) {
  console.log('\n=== '+name+' ===');
  const result=spawnSync(command,args,{cwd:root,env:stepEnv,stdio:'inherit',shell:false});
  if (result.error) { failed=name+': '+result.error.message;return false; }
  if (result.status!==0) {failed=name+' (exit '+String(result.status)+')';return false;}
  return true;
}
try {
  const result = mode==='browser-only' ? (
    run('Chromium viewport QA','node',['scripts/browser-mobile-qa.cjs'])
  ) : mode==='quick' ? (
    run('Repository hygiene','node',['scripts/check-repo-layout.cjs']) &&
    run('TypeScript','bun',['run','lint']) &&
    run('Vitest','bun',spec?['x','vitest','run',spec]:['run','test'])
  ) : (
    run('Frozen Bun install','bun',['install','--frozen-lockfile']) &&
    run('Repository hygiene','node',['scripts/check-repo-layout.cjs']) &&
    run('TypeScript','bun',['run','lint']) &&
    run('Full Vitest','bun',['run','test']) &&
    run('Production build','bun',['run','build']) &&
    run('Isolated API persistence smoke','node',['scripts/smoke-api.cjs']) &&
    (mode!=='browser' || run('Chromium viewport QA','node',['scripts/browser-mobile-qa.cjs']))
  );
  if (result) console.log('\nLOCAL GATE PASSED ('+mode+'). Record the exact commit SHA in the PR.');
  else {console.error('\nLOCAL GATE FAILED: '+failed);process.exitCode=1;}
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
