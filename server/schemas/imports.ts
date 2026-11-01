import { z } from 'zod';

export const processImportSchema = z.object({
  // Extension sends a structured JSON object; manual CSV/TSV is a string.
  // Both must be accepted and validated before attempting reconciliation.
  payload: z.union([
    z.string().trim().min(1).max(1_900_000),
    z.array(z.unknown()).min(1).max(2000),
    z.record(z.string(), z.unknown()),
  ]),
  termId: z.string().optional(),
  campusId: z.string().optional(),
});

export const reviewImportRecordSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('CONFIRM_MATCH'),
    courseId: z.string().min(1).max(128),
    reason: z.string().trim().min(10).max(500),
  }).strict(),
  z.object({
    action: z.literal('REJECT_MATCH'),
    reason: z.string().trim().min(10).max(500),
  }).strict(),
]);
