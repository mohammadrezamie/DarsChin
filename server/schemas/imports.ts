import { z } from 'zod';

export const processImportSchema = z.object({
  payload: z.string().min(1, 'Payload الزامی است'),
  termId: z.string().optional(),
  campusId: z.string().optional(),
});
