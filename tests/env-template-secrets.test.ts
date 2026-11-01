import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const gate: {
  findPopulatedEnvTemplateFields: (text: string) => string[];
  scanTrackedFiles: (root: string, files: string[]) => Array<{ path: string; type: string }>;
} = require('../scripts/check-public-source.cjs');

const repo = path.resolve(import.meta.dirname ?? '.', '..');
const templates = ['.env.example', 'deploy/.env.vps.example', 'deploy/.env.staging.example'];

describe('public ENV examples cannot expose real operator values', () => {
  it('keeps private fields, contact details, domain and deployed SHA empty', () => {
    for (const name of templates) {
      const content = fs.readFileSync(path.join(repo, name), 'utf8');
      expect(gate.findPopulatedEnvTemplateFields(content), name).toEqual([]);
      expect(content).toContain('JWT_SECRET=');
      expect(content).toContain('ROOT_OWNER_PASSWORD=');
      expect(content).toContain('ROOT_OWNER_RECOVERY_KEY=');
      expect(content).toContain('ROOT_OWNER_MOBILE=');
    }
  });

  it('blocks accidental values, including phone numbers which a token-pattern scanner would miss', () => {
    const unsafe = [
      'JWT_SECRET=' + 'fake-random-string-no-secret',
      'ROOT_OWNER_MOBILE=' + '09900000000',
      'TURNSTILE_SECRET_KEY=' + 'synthetic-private-value',
      'DARSCHYN_DOMAIN=' + 'sample.invalid',
      'SMS_PROVIDER=log',
    ].join('\n');
    expect(gate.findPopulatedEnvTemplateFields(unsafe).sort()).toEqual([
      'DARSCHYN_DOMAIN', 'JWT_SECRET', 'ROOT_OWNER_MOBILE', 'TURNSTILE_SECRET_KEY',
    ].sort());
    expect(gate.findPopulatedEnvTemplateFields('# JWT_SECRET=comment\nJWT_SECRET=\nSMS_PROVIDER=log')).toEqual([]);
  });

  it('integrates template detection with fail-fast tracked-source scanner without logging values', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'darschin-env-template-test-'));
    try {
      fs.mkdirSync(path.join(temp, 'deploy'));
      fs.writeFileSync(path.join(temp, 'deploy/.env.vps.example'), 'ROOT_OWNER_MOBILE=09900000000\n');
      const issues = gate.scanTrackedFiles(temp, ['deploy/.env.vps.example']);
      expect(issues).toEqual([{
        path: 'deploy/.env.vps.example', type: 'populated-example-ROOT_OWNER_MOBILE',
      }]);
      expect(JSON.stringify(issues)).not.toContain('09900000000');
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
});
