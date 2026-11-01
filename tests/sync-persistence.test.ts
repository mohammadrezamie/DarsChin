import { describe, expect, it } from 'vitest';
import { LocalDatabase } from '../server/db/database';

describe('sync persistence wiring', () => {
  it('backs sync job accessors with the persisted database schema', () => {
    const database = new LocalDatabase();

    const job = {
      id: 'sync-job-test',
      userId: 'student-test',
      termId: 'term-test',
      status: 'RUNNING',
      startedAt: new Date(0).toISOString(),
      totalSnapshots: 0,
      processedSnapshots: 0,
    };

    database.syncJobs.push(job);
    expect(database.data.syncJobs).toContain(job);

    const snapshot = {
      id: 'snapshot-test',
      jobId: job.id,
      chunkIndex: 0,
      data: [{ code: 'TEST-101' }],
      createdAt: new Date(0).toISOString(),
    };

    database.syncSnapshots.push(snapshot);
    expect(database.data.syncSnapshots).toContain(snapshot);
  });

  it('repairs missing sync arrays without replacing existing history', () => {
    const database = new LocalDatabase();
    const existingJob = { id: 'existing-job', status: 'COMPLETED' };
    const existingSnapshot = { id: 'existing-snapshot', jobId: existingJob.id };

    database.data.syncJobs = [existingJob];
    database.data.syncSnapshots = [existingSnapshot];

    expect(database.syncJobs).toEqual([existingJob]);
    expect(database.syncSnapshots).toEqual([existingSnapshot]);

    database.syncJobs = [];
    expect(database.data.syncJobs).toEqual([]);
    expect(database.data.syncSnapshots).toEqual([existingSnapshot]);
  });
});
