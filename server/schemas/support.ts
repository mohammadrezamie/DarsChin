import { z } from 'zod';

export const createTicketSchema = z.object({
  subject: z.string().min(1, 'موضوع الزامی است'),
});

export const addMessageSchema = z.object({
  content: z.string().min(1, 'متن پیام الزامی است'),
});

export const reportBugSchema = z.object({
  title: z.string().min(1, 'عنوان الزامی است'),
  category: z.string().optional(),
  description: z.string().min(1, 'توضیحات الزامی است'),
  severity: z.string().optional(),
  pageContext: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['OPEN', 'CLOSED', 'IN_PROGRESS', 'RESOLVED']),
});
