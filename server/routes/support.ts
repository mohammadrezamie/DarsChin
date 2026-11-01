import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { db } from '../db/database';
import { authenticate, requirePermission, AuthenticatedRequest, isRootOwner } from '../middleware/auth';
import { SupportTicket, SupportMessage, BugReport } from '../../src/types';
import { validate } from '../middleware/validate';
import { createTicketSchema, addMessageSchema, reportBugSchema, updateStatusSchema } from '../schemas/support';

export const supportRouter = Router();

// Tickets, messages and bug reports can contain personal student information.
supportRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Get Student Tickets
supportRouter.get('/tickets', authenticate, (req: AuthenticatedRequest, res) => {
  const tickets = db.supportTickets.filter(t => t.userId === req.user!.id);
  res.json({ success: true, data: tickets });
});

// Create Ticket
supportRouter.post('/tickets', authenticate, validate(createTicketSchema), (req: AuthenticatedRequest, res) => {
  const newTicket: SupportTicket = {
    id: `tic-${randomUUID()}`,
    userId: req.user!.id,
    subject: req.body.subject,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const index = db.supportTickets.length;
  db.supportTickets.push(newTicket);
  try {
    db.save();
  } catch {
    db.supportTickets.splice(index, 1);
    return res.status(500).json({ success: false, error: 'ذخیرهٔ درخواست پشتیبانی ناموفق بود.' });
  }
  res.json({ success: true, data: newTicket });
});

// Get Messages
supportRouter.get('/tickets/:id/messages', authenticate, (req: AuthenticatedRequest, res) => {
  const ticket = db.supportTickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
  const isAdmin = isRootOwner(req.user) || Boolean(req.user!.roles?.includes('admin') && req.user!.permissions?.includes('support.manage'));

  if (ticket.userId !== req.user!.id && !isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  const msgs = db.supportMessages.filter(m => m.ticketId === req.params.id);
  res.json({ success: true, data: msgs });
});

// Post Message
supportRouter.post('/tickets/:id/messages', authenticate, validate(addMessageSchema), (req: AuthenticatedRequest, res) => {
  const ticket = db.supportTickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: 'Ticket not found' });
  const isAdmin = isRootOwner(req.user) || Boolean(req.user!.roles?.includes('admin') && req.user!.permissions?.includes('support.manage'));

  if (ticket.userId !== req.user!.id && !isAdmin) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  const msg: SupportMessage = {
    id: `msg-${randomUUID()}`,
    ticketId: req.params.id,
    senderId: req.user!.id,
    content: req.body.content,
    createdAt: new Date().toISOString()
  };
  const index = db.supportMessages.length;
  const previousStatus = ticket.status;
  const previousUpdatedAt = ticket.updatedAt;
  db.supportMessages.push(msg);
  ticket.updatedAt = new Date().toISOString();
  ticket.status = req.user!.roles?.includes('student') ? 'OPEN' : 'ANSWERED';
  try {
    db.save();
  } catch {
    db.supportMessages.splice(index, 1);
    ticket.status = previousStatus;
    ticket.updatedAt = previousUpdatedAt;
    return res.status(500).json({ success: false, error: 'ذخیرهٔ پیام پشتیبانی ناموفق بود.' });
  }
  res.json({ success: true, data: msg });
});

// Bug Reports CRUD
supportRouter.get('/bugs', authenticate, (req: AuthenticatedRequest, res) => {
  const bugs = db.bugReports.filter(b => b.userId === req.user!.id);
  res.json({ success: true, data: bugs });
});

supportRouter.post('/bugs', authenticate, validate(reportBugSchema), (req: AuthenticatedRequest, res) => {
  const bug: BugReport = {
    id: `bug-${randomUUID()}`,
    userId: req.user!.id,
    title: req.body.title,
    category: req.body.category,
    description: req.body.description,
    severity: req.body.severity,
    pageContext: req.body.pageContext,
    status: 'OPEN',
    createdAt: new Date().toISOString()
  };
  const index = db.bugReports.length;
  db.bugReports.push(bug);
  try {
    db.save();
  } catch {
    db.bugReports.splice(index, 1);
    return res.status(500).json({ success: false, error: 'ذخیرهٔ گزارش خطا ناموفق بود.' });
  }
  res.json({ success: true, data: bug });
});

// Admin routes
supportRouter.get('/admin/tickets', authenticate, requirePermission('support.manage'), (req, res) => {
  res.json({ success: true, data: db.supportTickets });
});
supportRouter.get('/admin/bugs', authenticate, requirePermission('support.manage'), (req, res) => {
  res.json({ success: true, data: db.bugReports });
});
supportRouter.put('/admin/tickets/:id/status', authenticate, requirePermission('support.manage'), validate(updateStatusSchema), (req, res) => {
  const t = db.supportTickets.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ success: false, error: 'Ticket not found' });
  const previousStatus = t.status;
  t.status = req.body.status;
  try {
    db.save();
  } catch {
    t.status = previousStatus;
    return res.status(500).json({ success: false, error: 'ذخیرهٔ وضعیت تیکت ناموفق بود.' });
  }
  res.json({ success: true, data: t });
});
supportRouter.put('/admin/bugs/:id/status', authenticate, requirePermission('support.manage'), validate(updateStatusSchema), (req, res) => {
  const b = db.bugReports.find(x => x.id === req.params.id);
  if (!b) return res.status(404).json({ success: false, error: 'Bug report not found' });
  const previousStatus = b.status;
  b.status = req.body.status;
  try {
    db.save();
  } catch {
    b.status = previousStatus;
    return res.status(500).json({ success: false, error: 'ذخیرهٔ وضعیت گزارش خطا ناموفق بود.' });
  }
  res.json({ success: true, data: b });
});
