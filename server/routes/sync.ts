import { Router } from 'express';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';
import { hasCompleteChunkSequence, validateSyncChunk } from '../sync/validation';

export const syncRouter = Router();

// Types for Sync Architecture
export interface SyncJob {
  id: string;
  userId: string;
  termId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  totalSnapshots: number;
  processedSnapshots: number;
  error?: string;
}

export interface SyncSnapshot {
  id: string;
  jobId: string;
  chunkIndex: number;
  data: Record<string, unknown>[];
  createdAt: string;
}

// 1. Start a new Sync Job
syncRouter.post('/jobs', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { termId } = req.body ?? {};

  if (termId !== undefined && (typeof termId !== 'string' || termId.trim().length === 0 || termId.length > 100)) {
    return res.status(400).json({ success: false, error: 'شناسه ترم نامعتبر است.' });
  }

  const job: SyncJob = {
    id: `sync-job-${crypto.randomUUID()}`,
    userId,
    // Keep the legacy default for compatibility until clients are migrated to require termId.
    termId: termId || 'term-1405-1',
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
    totalSnapshots: 0,
    processedSnapshots: 0,
  };

  db.syncJobs = db.syncJobs || [];
  db.syncJobs.push(job);
  db.save();

  res.status(201).json({ success: true, data: job });
});

// 2. Upload a Sync Snapshot
syncRouter.post('/jobs/:jobId/snapshots', authenticate, (req: AuthenticatedRequest, res) => {
  const { jobId } = req.params;
  const { chunkIndex, data, isFinal } = req.body ?? {};
  const userId = req.user!.id;

  const job = (db.syncJobs || []).find((j: SyncJob) => j.id === jobId && j.userId === userId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'کارعملیات همگام‌سازی یافت نشد.' });
  }
  if (job.status !== 'RUNNING') {
    return res.status(400).json({ success: false, error: 'این عملیات قبلاً پایان یافته است.' });
  }

  const validation = validateSyncChunk({ chunkIndex, data, isFinal });
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  db.syncSnapshots = db.syncSnapshots || [];
  const existingForJob = (db.syncSnapshots as SyncSnapshot[]).filter((s) => s.jobId === jobId);
  const existingChunk = existingForJob.find((s) => s.chunkIndex === chunkIndex);

  // Retries are idempotent: an identical chunk is acknowledged, conflicting reuse is rejected.
  if (existingChunk) {
    if (JSON.stringify(existingChunk.data) !== validation.serialized) {
      return res.status(409).json({ success: false, error: 'این شماره بخش قبلاً با داده متفاوت ثبت شده است.' });
    }
    if (isFinal && !hasCompleteChunkSequence(existingForJob.map((s) => s.chunkIndex), chunkIndex)) {
      return res.status(409).json({ success: false, error: 'بخش‌های همگام‌سازی ناقص‌اند؛ همه بخش‌ها را به ترتیب کامل ارسال کنید.' });
    }
    if (isFinal) {
      job.status = 'COMPLETED';
      job.completedAt = new Date().toISOString();
      db.save();
    }
    return res.json({ success: true, data: { snapshotId: existingChunk.id, jobStatus: job.status, duplicate: true } });
  }

  // A final marker is accepted only if this chunk closes a complete 0..N sequence.
  const proposedIndices = [...existingForJob.map((s) => s.chunkIndex), chunkIndex as number];
  if (isFinal && !hasCompleteChunkSequence(proposedIndices, chunkIndex as number)) {
    return res.status(409).json({ success: false, error: 'بخش‌های همگام‌سازی ناقص‌اند؛ همه بخش‌ها را پیش از بخش نهایی ارسال کنید.' });
  }

  const snapshot: SyncSnapshot = {
    id: `snap-${crypto.randomUUID()}`,
    jobId,
    chunkIndex: chunkIndex as number,
    data: validation.data,
    createdAt: new Date().toISOString(),
  };

  db.syncSnapshots.push(snapshot);
  job.processedSnapshots = existingForJob.length + 1;
  job.totalSnapshots = Math.max(job.totalSnapshots, (chunkIndex as number) + 1);

  if (isFinal) {
    // NOTE: This status currently means all chunks arrived, not that records were
    // reconciled into canonical courseOfferings. Reconciliation remains a separate
    // required implementation and must not be inferred from this flag alone.
    job.status = 'COMPLETED';
    job.completedAt = new Date().toISOString();
  }

  db.save();

  res.json({ success: true, data: { snapshotId: snapshot.id, jobStatus: job.status, duplicate: false } });
});

// 3. Get Student Sync State
syncRouter.get('/state', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const jobs = (db.syncJobs || []).filter((j: SyncJob) => j.userId === userId);

  const lastJob = jobs.sort((a: SyncJob, b: SyncJob) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

  res.json({
    success: true,
    data: {
      lastSyncDate: lastJob?.completedAt || null,
      lastSyncStatus: lastJob?.status || null,
      totalSyncs: jobs.length,
    }
  });
});
