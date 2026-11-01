import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { stagingPreflight } = require('../scripts/staging-preflight.cjs') as {
  stagingPreflight: (env: Record<string, string>, root: string, fs: unknown) => {
    ok: boolean; failures: string[]; warnings: string[];
  };
};

const safe = {
  NODE_ENV: 'production',
  JWT_SECRET: 'x'.repeat(64),
  ROOT_OWNER_MOBILE: 'synthetic',
  ROOT_OWNER_PASSWORD: 'synthetic',
  ROOT_OWNER_RECOVERY_KEY: 'synthetic',
  PORT: '3000',
  HOST: '127.0.0.1',
  DARSCHYN_DATA_DIR: '/var/lib/darschin-test',
};
const fakeFs = {
  statSync(path: string) {
    if (path.endsWith('.json')) return { isFile: () => true, mode: 0o100600 };
    return { isDirectory: () => true };
  },
  accessSync() {},
};

describe('read-only future staging safety gate', () => {
  it('accepts a properly isolated single-host configuration without inspecting secret contents', () => {
    expect(stagingPreflight(safe, '/workspaces/darschin', fakeFs))
      .toMatchObject({ ok: true, failures: [] });
  });

  it('rejects a database stored in the repository checkout', () => {
    const state = stagingPreflight(
      { ...safe, DARSCHYN_DATA_DIR: '/workspaces/darschin/data' },
      '/workspaces/darschin', fakeFs,
    );
    expect(state.ok).toBe(false);
    expect(state.failures.some(msg => msg.includes('outside the checked-out repository'))).toBe(true);
  });

  it('rejects permissive database permissions and invalid server configuration', () => {
    const state = stagingPreflight({ ...safe, PORT: '99999', JWT_SECRET: '' }, '/repo', {
      ...fakeFs,
      statSync(path: string) {
        if (path.endsWith('.json')) return { isFile: () => true, mode: 0o100644 };
        return { isDirectory: () => true };
      },
    });
    expect(state.ok).toBe(false);
    expect(state.failures.some(msg => msg.includes('JWT_SECRET'))).toBe(true);
    expect(state.failures.some(msg => msg.includes('PORT'))).toBe(true);
    expect(state.failures.some(msg => msg.includes('group/others'))).toBe(true);
    expect(state.failures.join(' ')).not.toContain(safe.ROOT_OWNER_PASSWORD);
  });
});
