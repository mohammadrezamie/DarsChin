// ============================================================================
// DARSCHYN (درس‌چین) - Extension Import & Course Matching Routes
// ============================================================================

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest, requirePermission, isRootOwner } from '../middleware/auth';
import { processImportPayload } from '../../src/domain/import-validator';
import { ImportBatch } from '../../src/types';
import { validate } from '../middleware/validate';
import { processImportSchema, reviewImportRecordSchema } from '../schemas/imports';

export const importsRouter = Router();

// A legacy import may still retain rawJson; never send that source blob to a
// browser or an admin listing. Review rows already contain the scoped fields.
function publicImportBatch(batch: ImportBatch): ImportBatch {
  const safe = { ...batch };
  delete safe.rawJson;
  return safe;
}

// Process uploaded JSON from Chrome Extension
importsRouter.post('/process', authenticate, validate(processImportSchema), (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { payload, termId, campusId } = req.body;

    const studentProfile = db.studentProfiles.find((p) => p.userId === userId);
    const isCatalogEditor = isRootOwner(req.user) ||
      Boolean(req.user!.roles?.includes('admin') && req.user!.permissions?.includes('offering.manage'));
    if (!studentProfile && !isCatalogEditor) {
      return res.status(403).json({ success: false, error: 'برای واردکردن فایل، پرونده تحصیلی معتبر لازم است.' });
    }
    const activeTermId = termId || studentProfile?.currentTermId || db.academicTerms.find(t => t.isCurrent)?.id;
    const activeCampusId = campusId || studentProfile?.campusId;
    if (!activeTermId || !activeCampusId ||
        !db.academicTerms.some(term => term.id === activeTermId) ||
        !db.campuses.some(campus => campus.id === activeCampusId)) {
      return res.status(400).json({ success: false, error: 'نیمسال یا واحد دانشگاهی معتبر برای این فایل مشخص نشده است.' });
    }
    if (!isCatalogEditor && (activeCampusId !== studentProfile?.campusId ||
        (studentProfile?.currentTermId && activeTermId !== studentProfile.currentTermId))) {
      return res.status(403).json({ success: false, error: 'ورود داده فقط برای واحد و نیمسال پرونده تحصیلی خودتان مجاز است.' });
    }

    const batchId = `batch-${randomUUID()}`;

    // Execute matching engine
    const validationResult = processImportPayload(
      payload,
      batchId,
      activeTermId,
      activeCampusId,
      db.courses
    );

    if (validationResult.totalRecords === 0) {
      return res.status(400).json({
        success: false,
        error: validationResult.errors.join(' | ') || 'هیچ درسی قابل تطبیق یافت نشد.',
        details: validationResult,
      });
    }

    // Save batch info
    const newBatch: ImportBatch = {
      id: batchId,
      userId,
      termId: activeTermId,
      source: 'extension',
      schemaVersion: payload?.schemaVersion || '1.0',
      totalRecords: validationResult.totalRecords,
      matchedRecords: validationResult.matchedCount,
      reviewRecords: validationResult.reviewCount,
      invalidRecords: validationResult.invalidCount,
      // Do not store an unrestricted raw extension blob: only normalized
      // review records are kept to minimize accidental personal-data retention.
      createdAt: new Date().toISOString(),
    };

    db.importBatches.unshift(newBatch);
    db.importRecords.push(...validationResult.importRecords);
    db.save();

    return res.json({
      success: true,
      data: {
        batch: newBatch,
        summary: {
          total: validationResult.totalRecords,
          matched: validationResult.matchedCount,
          review: validationResult.reviewCount,
          invalid: validationResult.invalidCount,
        },
        records: validationResult.importRecords,
        createdOfferingsCount: 0,
        requiresReview: true,
        message: 'فایل تنها در صف تطبیق ثبت شد. هیچ گروهی بدون تأیید مدیر به بانک ارائه‌های اصلی اضافه نشده است.',
      },
    });
  } catch {
    // Import parsing / storage failures can include raw uploaded fields,
    // persisted file paths, or stack fragments; do not echo exceptions.
    return res.status(500).json({
      success: false,
      error: 'پردازش فایل واردشده ناموفق بود؛ لطفاً دوباره تلاش کنید.',
    });
  }
});

// Get import batches history
importsRouter.get('/batches', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  // Never grant access to other students' imports from a stale role or panel flag.
  const isSuperAdmin = isRootOwner(req.user);
  const list = isSuperAdmin
    ? db.importBatches
    : db.importBatches.filter((b) => b.userId === userId);

  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ success: true, data: list.map(publicImportBatch) });
});

// Get detailed records for a batch
importsRouter.get('/batches/:id', authenticate, (req: AuthenticatedRequest, res) => {
  const batch = db.importBatches.find((b) => b.id === req.params.id);
  if (!batch) return res.status(404).json({ success: false, error: 'شناسه بسته واردشده یافت نشد.' });

  // Never grant access to other students' imports from a stale role or panel flag.
  const isSuperAdmin = isRootOwner(req.user);
  if (batch.userId !== req.user!.id && !isSuperAdmin) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی' });
  }

  const records = db.importRecords.filter((r) => r.batchId === req.params.id);

  res.setHeader('Cache-Control', 'private, no-store');
  res.json({
    success: true,
    data: {
      batch: publicImportBatch(batch),
      records,
    },
  });
});


/**
 * This operation records an operator's course-id mapping decision ONLY.
 * Publication of an offering is intentionally a separate, unavailable flow.
 * A course match does not verify term, group, teacher, capacity or regulations.
 */
importsRouter.put(
  '/batches/:batchId/records/:recordId/review',
  authenticate,
  requirePermission('offering.manage'),
  validate(reviewImportRecordSchema),
  (req: AuthenticatedRequest, res) => {
    const batch = db.importBatches.find(item => item.id === req.params.batchId);
    if (!batch) return res.status(404).json({ success: false, error: 'بسته واردات پیدا نشد.' });
    const record = db.importRecords.find(item => item.id === req.params.recordId && item.batchId === batch.id);
    if (!record) return res.status(404).json({ success: false, error: 'ردیف موردنظر در این بسته پیدا نشد.' });

    const { action, reason } = req.body as { action: 'CONFIRM_MATCH' | 'REJECT_MATCH'; reason: string; courseId?: string };
    if (action === 'CONFIRM_MATCH' && !db.courses.some(course => course.id === req.body.courseId && course.active)) {
      return res.status(400).json({ success: false, error: 'درس مقصد در کاتالوگ فعال وجود ندارد.' });
    }
    const before = {
      decision: record.reviewDecision ?? null,
      matchedCourseId: record.matchedCourseId ?? null,
    };
    record.reviewDecision = action === 'CONFIRM_MATCH' ? 'COURSE_MATCH_CONFIRMED' : 'REJECTED';
    record.matchedCourseId = action === 'CONFIRM_MATCH' ? req.body.courseId : null;
    record.reviewNotes = reason.trim();
    record.reviewedBy = req.user!.id;
    record.reviewedAt = new Date().toISOString();

    db.auditLogs.push({
      id: 'audit-' + randomUUID(),
      adminId: req.user!.id,
      action: 'IMPORT_COURSE_MAPPING_REVIEW',
      entityType: 'import-record',
      entityId: record.id,
      details: JSON.stringify({
        batchId: batch.id,
        before,
        after: { decision: record.reviewDecision, matchedCourseId: record.matchedCourseId },
      }),
      createdAt: record.reviewedAt,
    });
    db.save();
    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({ success: true, data: record,
      publicationStatus: 'NOT_PUBLISHED',
      message: 'تصمیم نگاشت ذخیره شد؛ هیچ گروه درسی منتشر نشده است.',
    });
  },
);
