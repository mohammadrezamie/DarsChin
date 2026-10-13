import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest, requirePermission } from '../middleware/auth';
import { hasCompleteChunkSequence, validateSyncChunk } from '../sync/validation';
import { reconcileSyncRecords } from '../sync/reconciliation';

export const syncRouter = Router();

export interface SyncJob {
  id: string;
  userId: string;
  termId: string;
  campusId: string;
  status: 'PENDING' | 'RUNNING' | 'RECEIVED' | 'RECONCILED' | 'FAILED';
  startedAt: string;
  receivedAt?: string;
  completedAt?: string;
  reconciledAt?: string;
  totalSnapshots: number;
  processedSnapshots: number;
  reconciledOfferings?: number;
  duplicateRecords?: number;
  reconciliationErrors?: string[];
  error?: string;
}

export interface SyncSnapshot {
  id: string;
  jobId: string;
  chunkIndex: number;
  data: Record<string, unknown>[];
  createdAt: string;
}

function reconcileJob(job: SyncJob): { ok: boolean; errors: string[] } {
  const snapshots = (db.syncSnapshots as SyncSnapshot[])
    .filter((snapshot) => snapshot.jobId === job.id)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);
  const records = snapshots.flatMap((snapshot) => snapshot.data);

  job.status = 'RECEIVED';
  job.receivedAt = job.receivedAt || new Date().toISOString();

  const result = reconcileSyncRecords({
    records,
    termId: job.termId,
    campusId: job.campusId,
    courses: db.courses,
  });

  if (!result.ok) {
    job.status = 'FAILED';
    job.completedAt = new Date().toISOString();
    job.error = 'داده دریافت شد، اما تطبیق امن همه رکوردها ناموفق بود؛ هیچ ارائه‌ای تغییر نکرد.';
    job.reconciliationErrors = result.errors.slice(0, 50);
    db.save();
    return { ok: false, errors: result.errors };
  }

  // Apply only after every record has passed validation. Missing source records never
  // deactivate existing offerings because an incomplete extract cannot prove removal.
  for (const incoming of result.offerings) {
    const index = db.courseOfferings.findIndex(
      (existing) =>
        existing.sourceIdentity === incoming.sourceIdentity || existing.id === incoming.id,
    );

    if (index >= 0) {
      const existing = db.courseOfferings[index];
      db.courseOfferings[index] = { ...existing, ...incoming, id: existing.id };
    } else {
      db.courseOfferings.push(incoming);
    }
  }

  job.status = 'RECONCILED';
  job.completedAt = new Date().toISOString();
  job.reconciledAt = job.completedAt;
  job.reconciledOfferings = result.acceptedRecords;
  job.duplicateRecords = result.duplicateRecords;
  job.reconciliationErrors = [];
  job.error = undefined;
  db.save();

  return { ok: true, errors: [] };
}

// 1. Start a new sync job. Term/campus are resolved only from explicit input or the
// authenticated student's profile/current term; no hard-coded academic context is invented.
syncRouter.post('/jobs', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const body = req.body ?? {};
  const studentProfile = db.studentProfiles.find((profile) => profile.userId === userId);
  const currentTerm = db.academicTerms.find((term) => term.isCurrent);
  const termId = body.termId ?? studentProfile?.currentTermId ?? currentTerm?.id;
  const requestedCampusId = body.campusId;
  const campusOverrideAllowed =
    Array.isArray(req.user?.roles) && req.user.roles.includes('super-admin') ||
    Boolean(req.user?.permissions?.includes('admin.panel.access'));

  // Student syncs must stay within the campus attached to their own profile.
  // The browser extension normally omits campusId and relies on this profile value.
  if (
    requestedCampusId !== undefined &&
    studentProfile?.campusId &&
    requestedCampusId !== studentProfile.campusId &&
    !campusOverrideAllowed
  ) {
    return res.status(403).json({ success: false, error: 'همگام‌سازی خارج از واحد دانشگاهی پروفایل مجاز نیست.' });
  }
  if (requestedCampusId !== undefined && !campusOverrideAllowed && !studentProfile?.campusId) {
    return res.status(403).json({ success: false, error: 'برای همگام‌سازی، واحد دانشگاهی باید در پروفایل دانشجو مشخص شده باشد.' });
  }
  const campusId = campusOverrideAllowed
    ? requestedCampusId ?? studentProfile?.campusId
    : studentProfile?.campusId;

  if (termId !== undefined && (typeof termId !== 'string' || !termId.trim() || termId.length > 100)) {
    return res.status(400).json({ success: false, error: 'شناسه ترم نامعتبر است.' });
  }
  if (campusId !== undefined && (typeof campusId !== 'string' || !campusId.trim() || campusId.length > 100)) {
    return res.status(400).json({ success: false, error: 'شناسه واحد دانشگاهی نامعتبر است.' });
  }
  if (!termId) {
    return res.status(400).json({ success: false, error: 'برای همگام‌سازی، ترم تحصیلی باید مشخص باشد.' });
  }
  if (!campusId) {
    return res.status(400).json({ success: false, error: 'برای همگام‌سازی، واحد دانشگاهی باید مشخص باشد.' });
  }

  const job: SyncJob = {
    id: `sync-job-${crypto.randomUUID()}`,
    userId,
    termId,
    campusId,
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
    totalSnapshots: 0,
    processedSnapshots: 0,
  };

  db.syncJobs.push(job);
  db.save();
  return res.status(201).json({ success: true, data: job });
});

// 2. Upload a snapshot. A final chunk means "all chunks received", not "reconciled";
// reconciliation is recorded separately and applied atomically only after full validation.
syncRouter.post('/jobs/:jobId/snapshots', authenticate, (req: AuthenticatedRequest, res) => {
  const { jobId } = req.params;
  const { chunkIndex, data, isFinal } = req.body ?? {};
  const userId = req.user!.id;
  const job = (db.syncJobs as SyncJob[]).find((candidate) => candidate.id === jobId && candidate.userId === userId);

  if (!job) {
    return res.status(404).json({ success: false, error: 'عملیات همگام‌سازی یافت نشد.' });
  }

  const validation = validateSyncChunk({ chunkIndex, data, isFinal });
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  const allSnapshots = db.syncSnapshots as SyncSnapshot[];
  const existingForJob = allSnapshots.filter((snapshot) => snapshot.jobId === jobId);
  const existingChunk = existingForJob.find((snapshot) => snapshot.chunkIndex === chunkIndex);

  if (existingChunk && JSON.stringify(existingChunk.data) !== validation.serialized) {
    return res.status(409).json({ success: false, error: 'این شماره بخش قبلاً با داده متفاوت ثبت شده است.' });
  }

  if (existingChunk) {
    if (isFinal && !hasCompleteChunkSequence(existingForJob.map((snapshot) => snapshot.chunkIndex), chunkIndex as number)) {
      return res.status(409).json({ success: false, error: 'بخش‌های همگام‌سازی ناقص‌اند؛ همه بخش‌ها را پیش از بخش نهایی ارسال کنید.' });
    }

    // A retry of the final request can recover a job left in RECEIVED after a process restart.
    if (isFinal && (job.status === 'RUNNING' || job.status === 'RECEIVED')) {
      job.status = 'RECEIVED';
      job.receivedAt = job.receivedAt || new Date().toISOString();
      job.totalSnapshots = chunkIndex as number + 1;
      const result = reconcileJob(job);
      return res.status(result.ok ? 200 : 422).json({
        success: result.ok,
        data: {
          snapshotId: existingChunk.id,
          jobStatus: job.status,
          duplicate: true,
          reconciledOfferings: job.reconciledOfferings ?? 0,
          duplicateRecords: job.duplicateRecords ?? 0,
          errors: result.errors,
        },
        ...(!result.ok ? { error: job.error } : {}),
      });
    }

    return res.status(job.status === 'FAILED' ? 422 : 200).json({
      success: job.status !== 'FAILED',
      data: {
        snapshotId: existingChunk.id,
        jobStatus: job.status,
        duplicate: true,
        reconciledOfferings: job.reconciledOfferings ?? 0,
        duplicateRecords: job.duplicateRecords ?? 0,
      },
      ...(job.status === 'FAILED' ? { error: job.error, errors: job.reconciliationErrors ?? [] } : {}),
    });
  }

  if (job.status !== 'RUNNING') {
    return res.status(400).json({ success: false, error: 'این عملیات قبلاً پایان یافته است.' });
  }

  const proposedIndices = [...existingForJob.map((snapshot) => snapshot.chunkIndex), chunkIndex as number];
  if (isFinal && !hasCompleteChunkSequence(proposedIndices, chunkIndex as number)) {
    return res.status(409).json({ success: false, error: 'بخش‌های همگام‌سازی ناقص‌اند؛ بخش‌های مفقود را پیش از پایان ارسال کنید.' });
  }

  const snapshot: SyncSnapshot = {
    id: `snap-${crypto.randomUUID()}`,
    jobId,
    chunkIndex: chunkIndex as number,
    data: validation.data,
    createdAt: new Date().toISOString(),
  };

  allSnapshots.push(snapshot);
  job.processedSnapshots = new Set([...existingForJob.map((item) => item.chunkIndex), chunkIndex as number]).size;
  job.totalSnapshots = Math.max(job.totalSnapshots, (chunkIndex as number) + 1);

  if (!isFinal) {
    db.save();
    return res.json({
      success: true,
      data: { snapshotId: snapshot.id, jobStatus: job.status, duplicate: false },
    });
  }

  job.status = 'RECEIVED';
  job.receivedAt = new Date().toISOString();
  job.totalSnapshots = (chunkIndex as number) + 1;
  db.save();

  const result = reconcileJob(job);
  return res.status(result.ok ? 200 : 422).json({
    success: result.ok,
    data: {
      snapshotId: snapshot.id,
      jobStatus: job.status,
      duplicate: false,
      reconciledOfferings: job.reconciledOfferings ?? 0,
      duplicateRecords: job.duplicateRecords ?? 0,
      errors: result.errors,
    },
    ...(!result.ok ? { error: job.error } : {}),
  });
});

// Admin-only sync history. Never return raw snapshots or extracted student-facing data.
syncRouter.get('/jobs', authenticate, requirePermission('admin.panel.access'), (req, res) => {
  const jobs = [...(db.syncJobs as SyncJob[])]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 100)
    .map((job) => ({
      id: job.id,
      userId: job.userId,
      termId: job.termId,
      campusId: job.campusId,
      status: job.status,
      startedAt: job.startedAt,
      receivedAt: job.receivedAt,
      completedAt: job.completedAt,
      reconciledAt: job.reconciledAt,
      totalSnapshots: job.totalSnapshots,
      processedSnapshots: job.processedSnapshots,
      reconciledOfferings: job.reconciledOfferings ?? 0,
      duplicateRecords: job.duplicateRecords ?? 0,
      reconciliationErrors: job.reconciliationErrors ?? [],
      error: job.error,
    }));

  return res.json({ success: true, data: jobs });
});

// 3. Get the authenticated student's most recent sync state.
syncRouter.get('/state', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const jobs = (db.syncJobs as SyncJob[])
    .filter((job) => job.userId === userId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const lastJob = jobs[0];

  return res.json({
    success: true,
    data: {
      lastSyncDate: lastJob?.completedAt || lastJob?.receivedAt || null,
      lastSyncStatus: lastJob?.status || null,
      totalSyncs: jobs.length,
      reconciledOfferings: lastJob?.reconciledOfferings ?? 0,
      reconciliationErrors: lastJob?.reconciliationErrors ?? [],
    },
  });
});
