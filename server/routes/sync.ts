import { Router } from 'express';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest, requirePermission } from '../middleware/auth';
import crypto from 'crypto';

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
}

export interface SyncSnapshot {
  id: string;
  jobId: string;
  chunkIndex: number;
  data: any[]; // The structured data points
  createdAt: string;
}

// 1. Start a new Sync Job
syncRouter.post('/jobs', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { termId } = req.body;

  const job: SyncJob = {
    id: `sync-job-${crypto.randomUUID()}`,
    userId,
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
  const { chunkIndex, data, isFinal } = req.body;
  const userId = req.user!.id;

  const job = (db.syncJobs || []).find((j: SyncJob) => j.id === jobId && j.userId === userId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'کارعملیات همگام‌سازی یافت نشد.' });
  }
  if (job.status !== 'RUNNING') {
    return res.status(400).json({ success: false, error: 'این عملیات قبلاً پایان یافته است.' });
  }

  const snapshot: SyncSnapshot = {
    id: `snap-${crypto.randomUUID()}`,
    jobId,
    chunkIndex,
    data: data || [],
    createdAt: new Date().toISOString(),
  };

  db.syncSnapshots = db.syncSnapshots || [];
  db.syncSnapshots.push(snapshot);
  
  job.processedSnapshots += 1;
  job.totalSnapshots = Math.max(job.totalSnapshots, chunkIndex + 1);

  if (isFinal) {
    job.status = 'COMPLETED';
    job.completedAt = new Date().toISOString();
    // Here we would ideally trigger a background worker to process all snapshots into courseOfferings
  }

  db.save();

  res.json({ success: true, data: { snapshotId: snapshot.id, jobStatus: job.status } });
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
