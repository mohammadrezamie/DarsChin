// ============================================================================
// DARSCHYN (درس‌چین) - Extension Import & Course Matching Routes
// ============================================================================

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { processImportPayload } from '../../src/domain/import-validator';
import { ImportBatch } from '../../src/types';
import { validate } from '../middleware/validate';
import { processImportSchema } from '../schemas/imports';

export const importsRouter = Router();

// Process uploaded JSON from Chrome Extension
importsRouter.post('/process', authenticate, validate(processImportSchema), (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { payload, termId, campusId } = req.body;

    const studentProfile = db.studentProfiles.find((p) => p.userId === userId);
    const isCatalogEditor = req.user!.roles?.includes('super-admin') ||
      req.user!.permissions?.includes('offering.manage');
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get import batches history
importsRouter.get('/batches', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const isSuperAdmin = req.user!.roles?.includes('super-admin') ||
    req.user!.permissions?.includes('admin.panel.access');
  const list = isSuperAdmin
    ? db.importBatches
    : db.importBatches.filter((b) => b.userId === userId);

  res.json({ success: true, data: list });
});

// Get detailed records for a batch
importsRouter.get('/batches/:id', authenticate, (req: AuthenticatedRequest, res) => {
  const batch = db.importBatches.find((b) => b.id === req.params.id);
  if (!batch) return res.status(404).json({ success: false, error: 'شناسه بسته واردشده یافت نشد.' });

  const isSuperAdmin = req.user!.roles?.includes('admin') || req.user!.roles?.includes('super-admin');
  if (batch.userId !== req.user!.id && !isSuperAdmin) {
    return res.status(403).json({ success: false, error: 'عدم دسترسی' });
  }

  const records = db.importRecords.filter((r) => r.batchId === req.params.id);

  res.json({
    success: true,
    data: {
      batch,
      records,
    },
  });
});
