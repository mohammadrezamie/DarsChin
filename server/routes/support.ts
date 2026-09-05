import { Router } from 'express';
import { db } from '../db/database';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { SupportTicket, SupportMessage, BugReport } from '../../src/types';

export const supportRouter = Router();

// Get Student Tickets
supportRouter.get('/tickets', authenticate, (req: AuthenticatedRequest, res) => {
  const tickets = db.supportTickets.filter(t => t.userId === req.user!.id);
  res.json({ success: true, data: tickets });
});

// Create Ticket
supportRouter.post('/tickets', authenticate, (req: AuthenticatedRequest, res) => {
  const newTicket: SupportTicket = {
    id: `tic-${Date.now()}`,
    userId: req.user!.id,
    subject: req.body.subject,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.supportTickets.push(newTicket);
  db.save();
  res.json({ success: true, data: newTicket });
});

// Get Messages
supportRouter.get('/tickets/:id/messages', authenticate, (req: AuthenticatedRequest, res) => {
  const msgs = db.supportMessages.filter(m => m.ticketId === req.params.id);
  res.json({ success: true, data: msgs });
});

// Post Message
supportRouter.post('/tickets/:id/messages', authenticate, (req: AuthenticatedRequest, res) => {
  const msg: SupportMessage = {
    id: `msg-${Date.now()}`,
    ticketId: req.params.id,
    senderId: req.user!.id,
    content: req.body.content,
    createdAt: new Date().toISOString()
  };
  db.supportMessages.push(msg);
  
  const ticket = db.supportTickets.find(t => t.id === req.params.id);
  if (ticket) {
    ticket.updatedAt = new Date().toISOString();
    ticket.status = req.user!.roles?.includes('student') ? 'OPEN' : 'ANSWERED';
  }
  
  db.save();
  res.json({ success: true, data: msg });
});

// Bug Reports CRUD
supportRouter.get('/bugs', authenticate, (req: AuthenticatedRequest, res) => {
  const bugs = db.bugReports.filter(b => b.userId === req.user!.id);
  res.json({ success: true, data: bugs });
});

supportRouter.post('/bugs', authenticate, (req: AuthenticatedRequest, res) => {
  const bug: BugReport = {
    id: `bug-${Date.now()}`,
    userId: req.user!.id,
    title: req.body.title,
    category: req.body.category,
    description: req.body.description,
    severity: req.body.severity,
    pageContext: req.body.pageContext,
    status: 'OPEN',
    createdAt: new Date().toISOString()
  };
  db.bugReports.push(bug);
  db.save();
  res.json({ success: true, data: bug });
});

// Admin routes
supportRouter.get('/admin/tickets', authenticate, requireAdmin, (req, res) => {
  res.json({ success: true, data: db.supportTickets });
});
supportRouter.get('/admin/bugs', authenticate, requireAdmin, (req, res) => {
  res.json({ success: true, data: db.bugReports });
});
supportRouter.put('/admin/tickets/:id/status', authenticate, requireAdmin, (req, res) => {
  const t = db.supportTickets.find(x => x.id === req.params.id);
  if (t) { t.status = req.body.status; db.save(); }
  res.json({ success: true, data: t });
});
supportRouter.put('/admin/bugs/:id/status', authenticate, requireAdmin, (req, res) => {
  const b = db.bugReports.find(x => x.id === req.params.id);
  if (b) { b.status = req.body.status; db.save(); }
  res.json({ success: true, data: b });
});
