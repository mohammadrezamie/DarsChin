import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const gate: {
  isSensitivePath: (file: string) => boolean;
  findSecretKinds: (contents: string) => string[];
  scanTrackedFiles: (root: string, names: string[]) => { path: string; type: string }[];
} = require('../scripts/check-public-source.cjs');

describe('public source safety gate', () => {
  it('blocks tracked private databases and credential file names, not safe examples', () => {
    expect(gate.isSensitivePath('data/darschyn-db.json')).toBe(true);
    expect(gate.isSensitivePath('deploy/.env.production')).toBe(true);
    expect(gate.isSensitivePath('keys/root.pem')).toBe(true);
    expect(gate.isSensitivePath('.env.example')).toBe(false);
    expect(gate.isSensitivePath('docs/SECURITY.md')).toBe(false);
  });

  it('detects common credential signatures without needing real secrets', () => {
    const fakeGitHub = 'gh' + 'p_' + 'A'.repeat(36);
    const fakeAWS = 'AK' + 'IA' + 'A'.repeat(16);
    const fakeKeyHeader = '-----BEGIN ' + 'PRIVATE KEY-----';
    expect(gate.findSecretKinds(fakeGitHub)).toContain('github-token');
    expect(gate.findSecretKinds(fakeAWS)).toContain('aws-access-key');
    expect(gate.findSecretKinds(fakeKeyHeader)).toContain('private-key');
    expect(gate.findSecretKinds('JWT_SECRET is read only from process.env')).toEqual([]);
  });

  it('returns only path and category, not the value of a found secret', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'darschin-public-gate-'));
    const token = 'gh' + 'p_' + 'B'.repeat(36);
    try {
      fs.mkdirSync(path.join(root, 'src'), { recursive: true });
      fs.writeFileSync(path.join(root, 'src', 'leak.ts'), 'export const token = "' + token + '";');
      const findings = gate.scanTrackedFiles(root, ['src/leak.ts']);
      expect(findings).toEqual([{ path: 'src/leak.ts', type: 'github-token' }]);
      expect(JSON.stringify(findings)).not.toContain(token);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
