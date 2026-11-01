import { describe, expect, it } from 'vitest';
import {
  MAX_SYNC_CHUNK_BYTES,
  MAX_SYNC_RECORDS_PER_CHUNK,
  hasCompleteChunkSequence,
  validateSyncChunk,
} from '../server/sync/validation';

describe('sync chunk validation', () => {
  it('accepts a bounded chunk of object records', () => {
    const result = validateSyncChunk({
      chunkIndex: 0,
      data: [{ courseCode: 'EE-101' }, { courseCode: 'EE-102' }],
      isFinal: true,
    });

    expect(result.valid).toBe(true);
  });

  it.each([-1, 1.5, Number.NaN, '0', 10_000])('rejects invalid chunk index %s', (chunkIndex) => {
    expect(validateSyncChunk({ chunkIndex, data: [] }).valid).toBe(false);
  });

  it('rejects non-array data and non-object records', () => {
    expect(validateSyncChunk({ chunkIndex: 0, data: {} }).valid).toBe(false);
    expect(validateSyncChunk({ chunkIndex: 0, data: [null] }).valid).toBe(false);
    expect(validateSyncChunk({ chunkIndex: 0, data: ['course'] }).valid).toBe(false);
    expect(validateSyncChunk({ chunkIndex: 0, data: [[1, 2]] }).valid).toBe(false);
  });

  it('rejects excessive record counts and payload size', () => {
    expect(
      validateSyncChunk({
        chunkIndex: 0,
        data: Array.from({ length: MAX_SYNC_RECORDS_PER_CHUNK + 1 }, () => ({})),
      }).valid,
    ).toBe(false);

    const oversized = [{ payload: 'x'.repeat(MAX_SYNC_CHUNK_BYTES) }];
    expect(validateSyncChunk({ chunkIndex: 0, data: oversized }).valid).toBe(false);
  });

  it('requires an explicit boolean when isFinal is provided', () => {
    expect(validateSyncChunk({ chunkIndex: 0, data: [], isFinal: 'true' }).valid).toBe(false);
    expect(validateSyncChunk({ chunkIndex: 0, data: [], isFinal: false }).valid).toBe(true);
  });
});

describe('sync chunk sequence', () => {
  it('accepts only a complete unique sequence from zero to the final index', () => {
    expect(hasCompleteChunkSequence([0], 0)).toBe(true);
    expect(hasCompleteChunkSequence([0, 1, 2], 2)).toBe(true);
    expect(hasCompleteChunkSequence([0, 2], 2)).toBe(false);
    expect(hasCompleteChunkSequence([0, 1, 1], 2)).toBe(false);
    expect(hasCompleteChunkSequence([1, 0], 1)).toBe(true);
    expect(hasCompleteChunkSequence([0, 1], 0)).toBe(false);
  });
});
