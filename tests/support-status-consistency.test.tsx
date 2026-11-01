import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, beforeEach } from 'vitest';
import { updateTicketStatusSchema, updateBugStatusSchema } from '../server/schemas/support';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';
import { AdminSupportPanel } from '../src/components/AdminSupportPanel';
import { BugReportPanel } from '../src/components/BugReportPanel';

beforeEach(() => resetBrowserDemo());

describe('support workflow status contracts', () => {
  it('accepts the ticket statuses actually used by the admin interface', () => {
    for (const status of ['OPEN', 'IN_PROGRESS', 'ANSWERED', 'CLOSED']) {
      expect(updateTicketStatusSchema.safeParse({ status }).success).toBe(true);
    }
    for (const status of ['RESOLVED', 'REJECTED', '', 'SUSPENDED']) {
      expect(updateTicketStatusSchema.safeParse({ status }).success).toBe(false);
    }
  });

  it('accepts bug statuses actually supported by the server model', () => {
    for (const status of ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']) {
      expect(updateBugStatusSchema.safeParse({ status }).success).toBe(true);
    }
    for (const status of ['ANSWERED', 'REJECTED', '', 'SUSPENDED']) {
      expect(updateBugStatusSchema.safeParse({ status }).success).toBe(false);
    }
  });

  it('shows seeded synthetic support records to test the admin panel immediately', async () => {
    const tickets = await browserDemoRequest<any[]>('/api/support/admin/tickets');
    const bugs = await browserDemoRequest<any[]>('/api/support/admin/bugs');
    expect(tickets.data?.[0]?.subject).toContain('نمونه');
    expect(bugs.data?.[0]?.title).toContain('نمونه');
  });

  it('applies ticket ANSWERED status changes in the isolated demo', async () => {
    const r = await browserDemoRequest<any>('/api/support/admin/tickets/demo-ticket-1/status', {
      method: 'PUT', body: JSON.stringify({ status: 'ANSWERED' }),
    });
    expect(r.success).toBe(true);
    expect(r.data?.status).toBe('ANSWERED');
    expect((await browserDemoRequest<any[]>('/api/support/admin/tickets')).data?.[0]?.status).toBe('ANSWERED');
  });

  it('applies bug RESOLVED status changes and rejects unknown records', async () => {
    const res = await browserDemoRequest<any>('/api/support/admin/bugs/demo-bug-1/status', {
      method: 'PUT', body: JSON.stringify({ status: 'RESOLVED' }),
    });
    expect(res.success).toBe(true);
    expect((await browserDemoRequest<any[]>('/api/support/admin/bugs')).data?.[0]?.status).toBe('RESOLVED');
    expect((await browserDemoRequest('/api/support/admin/bugs/not-found/status', {
      method: 'PUT', body: JSON.stringify({ status: 'RESOLVED' }),
    })).success).toBe(false);
  });

  it('rejects invalid status transitions and reset restores example state', async () => {
    const rejected = await browserDemoRequest('/api/support/admin/tickets/demo-ticket-1/status', {
      method: 'PUT', body: JSON.stringify({ status: 'RESOLVED' }),
    });
    expect(rejected.success).toBe(false);
    await browserDemoRequest('/api/support/admin/bugs/demo-bug-1/status', {
      method: 'PUT', body: JSON.stringify({ status: 'CLOSED' }),
    });
    resetBrowserDemo();
    expect((await browserDemoRequest<any[]>('/api/support/admin/bugs')).data?.[0]?.status).toBe('OPEN');
  });

  it('renders an aligned admin menu and bug category values', () => {
    const admin = renderToStaticMarkup(<AdminSupportPanel />);
    expect(admin).toContain('در حال بارگذاری'); // The data loads on the client.
    const user = renderToStaticMarkup(<BugReportPanel />);
    expect(user).toContain('value="ACADEMIC_DATA"');
    expect(user).not.toContain('value="FUNCTIONAL"');
    expect(user).not.toContain('value="DATA"');
  });
});
