import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import bcrypt from 'bcryptjs';

const root = path.resolve(import.meta.dirname ?? '.', '..');
const tool = path.join(root, 'scripts/rotate-root-credentials.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'darschin-root-rotation-'));
const dbPath = path.join(dir, 'darschyn-db.json');
const mobile = '09999999999';
const oldPassword = 'old-test-password-value';
const newPassword = 'brand-new-test-password-value';
const newRecovery = 'brand-new-test-recovery-value';
const oldDb = {
  users: [
    { id: 'usr-super', mobile, name: 'Synthetic root', roles: ['super-admin','admin','student'],
      password: bcrypt.hashSync(oldPassword, 4), recoveryKey: 'old-plain-demo-recovery', sessionVersion: 0 },
    { id: 'synthetic-student', mobile: '09900001111', name: 'Synthetic student', roles: ['student'],
      password: bcrypt.hashSync('synthetic-student-password', 4) },
  ],
  studentPlans: [{ id: 'synthetic-plan', userId: 'synthetic-student', courseIds: ['c1'] }],
};
const original = JSON.stringify(oldDb);

function invoke(mode: string, extra: Record<string,string> = {}) {
  return spawnSync(process.execPath, [tool, mode], {
    encoding: 'utf8', cwd: root, env: {
      ...process.env, NODE_ENV: 'production', DARSCHYN_DATA_DIR: dir,
      DARSCHYN_REQUIRE_EXISTING_DB: 'true', ROOT_OWNER_MOBILE: mobile,
      ROOT_OWNER_PASSWORD: newPassword, ROOT_OWNER_RECOVERY_KEY: newRecovery,
      ...extra,
    },
  });
}

afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('offline self-host root credential rotation', () => {
  it('does not touch data unless online processes were explicitly stopped and confirmed', () => {
    fs.writeFileSync(dbPath, original, { mode: 0o600 });
    expect(invoke('--check').status).toBe(0);
    expect(fs.readFileSync(dbPath, 'utf8')).toBe(original);
    expect(invoke('--apply').status).not.toBe(0);
    expect(invoke('--apply', { DARSCHYN_OFFLINE_MAINTENANCE_CONFIRMED: 'true',
      DARSCHYN_REQUIRE_EXISTING_DB: 'false' }).status).not.toBe(0);
    expect(fs.readFileSync(dbPath, 'utf8')).toBe(original);
  });

  it('preserves unrelated student data, stores private rollback and revokes old root tokens', () => {
    const result = invoke('--apply', { DARSCHYN_OFFLINE_MAINTENANCE_CONFIRMED: 'true' });
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain(newPassword);
    expect(result.stdout + result.stderr).not.toContain(newRecovery);
    const updated = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    expect(updated.users[0].sessionVersion).toBe(1);
    expect(bcrypt.compareSync(newPassword, updated.users[0].password)).toBe(true);
    expect(bcrypt.compareSync(newRecovery, updated.users[0].recoveryKey)).toBe(true);
    expect(updated.users[1]).toEqual(oldDb.users[1]);
    expect(updated.studentPlans).toEqual(oldDb.studentPlans);
    const backups = fs.readdirSync(dir).filter(x => x.endsWith('.backup'));
    expect(backups).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(dir, backups[0]), 'utf8'))).toEqual(oldDb);
    expect(fs.statSync(path.join(dir, backups[0])).mode & 0o077).toBe(0);
    expect(fs.statSync(dbPath).mode & 0o077).toBe(0);
    expect(invoke('--apply', { DARSCHYN_OFFLINE_MAINTENANCE_CONFIRMED: 'true' }).status).not.toBe(0);
    expect(JSON.parse(fs.readFileSync(dbPath, 'utf8')).users[0].sessionVersion).toBe(1);
  });

  it('does not create a new database if an expected data volume is missing', () => {
    const wrong = invoke('--apply', {
      DARSCHYN_DATA_DIR: path.join(dir, 'not-mounted'),
      DARSCHYN_OFFLINE_MAINTENANCE_CONFIRMED: 'true',
    });
    expect(wrong.status).not.toBe(0);
    expect(fs.existsSync(path.join(dir, 'not-mounted'))).toBe(false);
  });
});
