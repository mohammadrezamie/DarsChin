import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertExistingDatabasePresent,
  readPersistedJson,
  writeDurableJson,
} from '../server/db/durable-json';

const created: string[] = [];
function isolatedFile(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'darschin-durable-'));
  created.push(directory);
  return path.join(directory, 'student-data.json');
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of created.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('durable JSON persistence for a single-process student pilot', () => {
  it('writes and updates valid data without leaving temporary files', () => {
    const file = isolatedFile();
    writeDurableJson(file, { users: [{ id: 'first' }], studentPlans: [{ id: 'plan-1' }] });
    expect(readPersistedJson(file)).toMatchObject({ studentPlans: [{ id: 'plan-1' }] });
    writeDurableJson(file, { users: [{ id: 'first' }], studentPlans: [{ id: 'plan-2' }] });
    expect(readPersistedJson(file)).toMatchObject({ studentPlans: [{ id: 'plan-2' }] });
    expect(fs.readdirSync(path.dirname(file))).toEqual(['student-data.json']);
    if (process.platform !== 'win32') {
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    }
  });

  it('keeps an existing database intact when serialization fails', () => {
    const file = isolatedFile();
    writeDurableJson(file, { users: [], studentPlans: [{ id: 'saved' }] });
    const original = fs.readFileSync(file);
    const recursive: { self?: unknown } = {};
    recursive.self = recursive;
    expect(() => writeDurableJson(file, recursive)).toThrow();
    expect(fs.readFileSync(file)).toEqual(original);
    expect(fs.readdirSync(path.dirname(file))).toEqual(['student-data.json']);
  });

  it('keeps the old file and clears the abandoned temporary file if rename fails', () => {
    const file = isolatedFile();
    writeDurableJson(file, { users: [], studentPlans: [{ id: 'saved' }] });
    const original = fs.readFileSync(file);
    const stub = vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw new Error('simulated disk/filesystem rename failure');
    });
    expect(() => writeDurableJson(file, { users: [], studentPlans: [{ id: 'lost' }] })).toThrow('rename failure');
    stub.mockRestore();
    expect(fs.readFileSync(file)).toEqual(original);
    expect(fs.readdirSync(path.dirname(file))).toEqual(['student-data.json']);
  });

  it('refuses to silently replace corrupted or structurally invalid databases', () => {
    const file = isolatedFile();
    fs.writeFileSync(file, '{"users": [broken-json]');
    expect(() => readPersistedJson(file)).toThrow(SyntaxError);
    expect(fs.readFileSync(file, 'utf8')).toBe('{"users": [broken-json]');

    for (const malformed of [{}, [], null, { users: null }, { users: {} }]) {
      fs.writeFileSync(file, JSON.stringify(malformed));
      expect(() => readPersistedJson(file)).toThrow();
    }
  });

  it('prevents accidental creation of an empty database if an existing one is required', () => {
    const file = isolatedFile();
    expect(() => assertExistingDatabasePresent(file, true)).toThrow(/required persisted database is missing/);
    expect(fs.existsSync(file)).toBe(false);
    expect(() => assertExistingDatabasePresent(file, false)).not.toThrow();
    writeDurableJson(file, { users: [] });
    expect(() => assertExistingDatabasePresent(file, true)).not.toThrow();
  });
});
