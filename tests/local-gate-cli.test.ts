import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root=resolve(process.cwd());
const run=(...args:string[])=>spawnSync(process.execPath,['scripts/local-gate.cjs',...args],{
  cwd:root,encoding:'utf8',timeout:5000,env:{...process.env,NODE_ENV:'test',DARSCHYN_PRODUCTION:'false'},
});

describe('offline Local Gate argument and safety contracts',()=>{
  it('does not run commands for unknown or dangerous parameters',()=>{
    expect(run('--no-such-mode').status).toBe(2);
    expect(run('--spec','../../server/routes/demand.ts').status).toBe(2);
    expect(run('--quick','--spec','--browser').status).toBe(2);
    expect(run('--full','--spec','tests/course-demand-api.test.ts').status).toBe(2);
  });
  it('shows help without starting external processes or downloading dependencies',()=>{
    const result=run('--help');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--quick');
    expect(result.stdout).toContain('--browser');
  });
  it('refuses any production-like NODE_ENV before running Bun',()=>{
    const result=spawnSync(process.execPath,['scripts/local-gate.cjs','--quick'],{
      cwd:root,encoding:'utf8',timeout:5000,env:{...process.env,NODE_ENV:'production'},
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Refusing');
  });
});
