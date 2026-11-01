import { describe, expect, it } from 'vitest';
import { db } from '../server/db/database';

describe('VPS data preservation', () => {
  it('never permits demo seed reset when NODE_ENV is production', () => {
    const mode = process.env.NODE_ENV;
    const before = db.data;
    try {
      process.env.NODE_ENV = 'production';
      expect(() => db.resetToSeed()).toThrow(/disabled in production/);
      expect(db.data).toBe(before);
    } finally {
      if (mode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = mode;
    }
  });
});
