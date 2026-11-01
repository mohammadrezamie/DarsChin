import { beforeEach, describe, expect, it } from 'vitest';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';

beforeEach(() => resetBrowserDemo());

describe('isolated admin demo workflows', () => {
  it('loads a synthetic student and changes final-semester override in local preview only', async () => {
    const before = await browserDemoRequest<any[]>('/api/admin/students-overview');
    expect(before.success).toBe(true);
    expect(before.data).toHaveLength(1);
    expect(before.data?.[0].profile?.isFinalSemesterOverride).toBeUndefined();
    const edited = await browserDemoRequest<any>('/api/admin/students/demo-student/final-semester-override', {
      method: 'PUT',
      body: JSON.stringify({
        isFinalSemesterOverride: true,
        finalSemesterNotes: 'فقط تست رابط مدیریت؛ نه مجوز تحصیلی معتبر.',
      }),
    });
    expect(edited.success).toBe(true);
    const after = await browserDemoRequest<any[]>('/api/admin/students-overview');
    expect(after.data?.[0].profile.isFinalSemesterOverride).toBe(true);
    expect(after.data?.[0].limits.isFinalSemester).toBe(true);
  });

  it('lets a fake manager test role and permission changes without any JWT or actual users', async () => {
    const initial = await browserDemoRequest<any[]>('/api/admin-management');
    expect(initial.success).toBe(true);
    expect(initial.data?.some(user => user.id === 'demo-student')).toBe(true);
    const changedRole = await browserDemoRequest<any>('/api/admin/users/demo-student/role', {
      method: 'PUT', body: JSON.stringify({ role: 'admin' }),
    });
    expect(changedRole.data?.roles).toEqual(['admin']);
    const changedPermission = await browserDemoRequest<any>('/api/admin-management/demo-student', {
      method: 'PUT', body: JSON.stringify({ permissions: ['student.access', 'support.manage'] }),
    });
    expect(changedPermission.data?.permissions).toContain('support.manage');
    const denied = await browserDemoRequest('/api/admin/users/demo-student/role', {
      method: 'PUT', body: JSON.stringify({ role: 'super-admin' }),
    });
    expect(denied.success).toBe(false);
    resetBrowserDemo();
    const original = await browserDemoRequest<any[]>('/api/admin-management');
    expect(original.data?.find(user => user.id === 'demo-student')?.roles).toEqual(['student']);
  });
});
