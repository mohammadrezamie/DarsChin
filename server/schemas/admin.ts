import { z } from 'zod';

export const updateRoleSchema = z.object({
  role: z.enum(['student', 'admin', 'super-admin']),
});

export const updateAcademicSettingsSchema = z.object({
  normalMinUnits: z.union([z.string(), z.number()]).optional(),
  normalMaxUnits: z.union([z.string(), z.number()]).optional(),
  gpaBonusThreshold: z.union([z.string(), z.number()]).optional(),
  gpaBonusMaxUnits: z.union([z.string(), z.number()]).optional(),
  summerMinUnits: z.union([z.string(), z.number()]).optional(),
  summerMaxUnits: z.union([z.string(), z.number()]).optional(),
  finalSemesterMaxUnits: z.union([z.string(), z.number()]).optional(),
  finalSemesterThresholdUnits: z.union([z.string(), z.number()]).optional(),
  finalSemesterRuleEnabled: z.boolean().optional(),
});

export const overrideFinalSemesterSchema = z.object({
  isFinalSemesterOverride: z.boolean(),
  finalSemesterNotes: z.string().optional(),
});
