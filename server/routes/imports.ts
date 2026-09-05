// ============================================================================
// DARSCHYN (درس‌چین) - Extension Import & Course Matching Routes
// ============================================================================

import { Router } from 'express';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { processImportPayload } from '../../src/domain/import-validator';
import { ImportBatch, CourseOffering } from '../../src/types';

export const importsRouter = Router();

// Process uploaded JSON from Chrome Extension
importsRouter.post('/process', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { payload, termId, campusId } = req.body;

    const studentProfile = db.studentProfiles.find((p) => p.userId === userId);
    const activeTermId = termId || studentProfile?.currentTermId || db.academicTerms.find((t) => t.isCurrent)?.id || 'term-1405-1';
    const activeCampusId = campusId || studentProfile?.campusId || db.campuses[0]?.id || 'camp-srbiau';

    const batchId = `batch-${Date.now()}`;

    // Execute matching engine
    const validationResult = processImportPayload(
      payload,
      batchId,
      activeTermId,
      activeCampusId,
      db.courses
    );

    if (!validationResult.isValid && validationResult.matchedCount === 0) {
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
      rawJson: typeof payload === 'string' ? payload : JSON.stringify(payload),
      createdAt: new Date().toISOString(),
    };

    db.importBatches.unshift(newBatch);
    db.importRecords.push(...validationResult.importRecords);

    // Add matched offerings to database
    const newOfferings: CourseOffering[] = validationResult.preparedOfferings.map((po, idx) => ({
      ...po,
      id: `off-imp-${batchId}-${idx + 1}`,
    }));

    db.courseOfferings.push(...newOfferings);
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
        createdOfferingsCount: newOfferings.length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get import batches history
importsRouter.get('/batches', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const isSuperAdmin = req.user!.roles?.includes('admin');
  const list = isSuperAdmin
    ? db.importBatches
    : db.importBatches.filter((b) => b.userId === userId);

  res.json({ success: true, data: list });
});

// Get detailed records for a batch
importsRouter.get('/batches/:id', authenticate, (req, res) => {
  const batch = db.importBatches.find((b) => b.id === req.params.id);
  if (!batch) return res.status(404).json({ success: false, error: 'شناسه بسته واردشده یافت نشد.' });

  const records = db.importRecords.filter((r) => r.batchId === req.params.id);

  res.json({
    success: true,
    data: {
      batch,
      records,
    },
  });
});
