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

// Ticket and bug reports have different status lifecycles.
export const updateTicketStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'ANSWERED', 'CLOSED']),
});

export const updateBugStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
});
