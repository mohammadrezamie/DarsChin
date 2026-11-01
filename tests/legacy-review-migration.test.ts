import { describe, expect, it } from 'vitest';
import { ensureReviewCollections } from '../server/db/database';
import type { DatabaseSchema } from '../server/db/database';

describe('legacy JSON migration for Educationalyar review queues', () => {
  it('initializes missing review and sync collections without requiring fresh seed data', () => {
    const legacy: Partial<DatabaseSchema> = {};
    ensureReviewCollections(legacy);
    expect(legacy.importBatches).toEqual([]);
    expect(legacy.importRecords).toEqual([]);
    expect(legacy.syncJobs).toEqual([]);
    expect(legacy.syncSnapshots).toEqual([]);
  });

  it('preserves existing decisions and sync history references', () => {
    const batches = [{ id: 'historical-batch' }] as unknown as DatabaseSchema['importBatches'];
    const records = [{
      id: 'historic-record', batchId: 'historical-batch',
      reviewDecision: 'REJECTED', reviewNotes: 'رد شده توسط مدیر',
    }] as unknown as DatabaseSchema['importRecords'];
    const jobs = [{ id: 'historical-job', status: 'AWAITING_REVIEW' }] as unknown as NonNullable<DatabaseSchema['syncJobs']>;
    const snapshots = [{ id: 'partial-snapshot' }] as unknown as NonNullable<DatabaseSchema['syncSnapshots']>;
    const data: Partial<DatabaseSchema> = {
      importBatches: batches, importRecords: records,
      syncJobs: jobs, syncSnapshots: snapshots,
    };
    ensureReviewCollections(data);
    expect(data.importBatches).toBe(batches);
    expect(data.importRecords).toBe(records);
    expect(data.syncJobs).toBe(jobs);
    expect(data.syncSnapshots).toBe(snapshots);
    expect(data.importRecords?.[0].reviewDecision).toBe('REJECTED');
  });

  it('repairs invalid collection shapes in a legacy backup without touching unrelated data', () => {
    const data = {
      importBatches: null,
      importRecords: 'corrupt',
      syncJobs: {},
      syncSnapshots: null,
      academicSettings: { normalMaxUnits: 20 },
    } as unknown as Partial<DatabaseSchema>;
    ensureReviewCollections(data);
    expect(data.importBatches).toEqual([]);
    expect(data.importRecords).toEqual([]);
    expect(data.syncJobs).toEqual([]);
    expect(data.syncSnapshots).toEqual([]);
    expect(data.academicSettings?.normalMaxUnits).toBe(20);
  });
});
