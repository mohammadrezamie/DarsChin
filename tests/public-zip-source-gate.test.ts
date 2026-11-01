import { describe, expect, it } from 'vitest';
import AdmZip from 'adm-zip';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { scanZipArchive } = require('../scripts/scan-zip-archives.cjs') as {
  scanZipArchive: (data: Buffer, find: (s: string) => string[], env: (s: string) => string[]) => Array<{type:string}>;
};
const gate = require('../scripts/check-public-source.cjs') as {
  findSecretKinds: (s: string) => string[];
  findPopulatedEnvTemplateFields: (s: string) => string[];
  scanTrackedFiles: (root: string, paths: string[]) => Array<{path:string;type:string}>;
};
const scan = (archive: Buffer) =>
  scanZipArchive(archive, gate.findSecretKinds, gate.findPopulatedEnvTemplateFields);
const makeZip = (name: string, contents: string) => {
  const zip = new AdmZip();
  zip.addFile(name, Buffer.from(contents));
  return zip.toBuffer();
};

describe('public extension archive safety', () => {
  it('scans text inside compressed ZIP without showing credential values', () => {
    const token = 'gh' + 'p_' + 'A'.repeat(38);
    const findings = scan(makeZip('extension/popup.js', 'export const token = "' + token + '";'));
    expect(findings).toEqual([{ type: 'archive-github-token' }]);
    expect(JSON.stringify(findings)).not.toContain(token);
  });

  it('rejects an embedded real environment file or a populated example', () => {
    expect(scan(makeZip('.env', 'JWT_SECRET=not-a-real-secret'))).toEqual([{type:'embedded-private-env'}]);
    expect(scan(makeZip('.env.example', 'JWT_SECRET=synthetic-filled-value'))).toEqual([
      {type:'archive-populated-example-JWT_SECRET'},
    ]);
    expect(scan(makeZip('secrets/private.key', 'synthetic'))).toEqual([{type:'embedded-sensitive-file'}]);
  });

  it('rejects malformed ZIP and cannot silently skip it', () => {
    expect(scan(Buffer.from('not an archive'))).toEqual([{type:'invalid-archive'}]);
  });

  it('does not find known secrets in committed extension bundles on this SHA', () => {
    const cwd = path.resolve(import.meta.dirname ?? '.', '..');
    const issues = gate.scanTrackedFiles(cwd, [
      'darschyn-chrome-extension-v3.3.6.zip', 'public/darschyn-extension-v1.zip',
    ]);
    expect(issues).toEqual([]);
  });
});
