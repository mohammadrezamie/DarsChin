import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest, getStoredToken } from '../utils/api';
import { User } from '../types';
import { Shield, User as UserIcon, ShieldAlert, Search, Download, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AdminDemandAccessManager } from './AdminDemandAccessManager';

const getHighestRole = (roles?: string[]) => {
  if (roles?.includes('super-admin')) return 'super-admin';
  if (roles?.includes('admin')) return 'admin';
  return 'student';
};

const AVAILABLE_PERMISSIONS = [
  { id: 'admin.panel.access', label: 'دسترسی پنل' },
  { id: 'admin.manage', label: 'مدیریت مدیران' },
  { id: 'admin.create', label: 'ایجاد مدیر' },
  { id: 'system.settings.manage', label: 'تنظیمات سیستم' },
  { id: 'student.access', label: 'دسترسی دانشجویی' },
  { id: 'demand.manage', label: 'ساخت و مدیریت نیازسنجیِ محدودهٔ اختصاصی' },
  { id: 'demand.export', label: 'صادرات ریز اطلاعات نیازسنجی در محدودهٔ اختصاصی' },
  { id: 'sms.manage', label: 'مدیریت مرکز پیامک و قالب‌های ارسال' },
];

type DirectoryUser = User & { profile?: { studentNumber?: string } };

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all'|'student'|'admin'|'super-admin'>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<'all'|'yes'|'no'>('all');
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user: currentUser } = useAuth();
  const isRoot = Boolean(currentUser?.roles.includes('super-admin'));
  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('fa');
    return users.filter(entry => {
      if (roleFilter !== 'all' && getHighestRole(entry.roles) !== roleFilter) return false;
      if (isRoot && verifiedFilter !== 'all' && Boolean(entry.mobileVerifiedAt) !== (verifiedFilter === 'yes')) return false;
      return !needle || [entry.name, entry.mobile, entry.profile?.studentNumber || '']
        .some(text => text.toLocaleLowerCase('fa').includes(needle));
    });
  }, [users, search, roleFilter, verifiedFilter, isRoot]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    // Root needs ALL registered users; admin-management only returns admins.
    // A delegated manager still only sees managers they are authorized for.
    const res = await apiRequest<DirectoryUser[]>(isRoot ? '/api/admin/users' : '/api/admin-management');
    if (res.success && res.data) setUsers(res.data);
    else {
      setUsers([]);
      setError(res.error || 'خطا در دریافت فهرست کاربران');
    }
    setLoading(false);
  };

  const exportDirectory = async () => {
    // Never make a live privileged request from a synthetic browser demo.
    if (!isRoot || exporting || window.location.pathname.startsWith('/demo/')) return;
    const token = getStoredToken();
    if (!token) { setError('ابتدا به حساب مدیر ارشد وارد شوید.'); return; }
    setExporting(true);
    setError('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const query = new URLSearchParams({role: roleFilter, verified: verifiedFilter, search: search.trim()});
      const response = await fetch(`/api/admin/users/export?${query.toString()}`, {
        method: 'GET', headers: {Authorization: `Bearer ${token}`},
        cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) {
        throw new Error('دریافت خروجی کاربران امکان‌پذیر نیست.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `darschin-users-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Safari needs the object URL alive briefly after the click.
      window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
    } catch {
      setError('خروجی کاربران دریافت نشد؛ اتصال یا سطح دسترسی را بررسی کنید.');
    } finally {
      clearTimeout(timeout);
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm('آیا از تغییر نقش این کاربر اطمینان دارید؟')) return;
    const res = await apiRequest(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole })
    });
    if (res.success) fetchUsers();
    else alert(res.error || 'خطا در تغییر نقش');
  };

  const handlePermissionChange = async (userId: string, permission: string, grant: boolean) => {
    const userToEdit = users.find(u => u.id === userId);
    if (!userToEdit) return;
    const currentPerms = userToEdit.permissions || [];
    const newPerms = grant 
      ? [...currentPerms, permission] 
      : currentPerms.filter(p => p !== permission);

    const res = await apiRequest(`/api/admin-management/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ permissions: newPerms })
    });
    
    if (res.success) fetchUsers();
    else alert(res.error || 'شما مجاز به تخصیص این دسترسی نیستید.');
  };

  if (loading) return <div className="p-8 text-center">در حال بارگذاری...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div dir="rtl" className="darschin-surface min-w-0 p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
            <Users aria-hidden="true" className="h-5 w-5 text-blue-600" />
            {isRoot ? 'دایرکتوری کاربران و مجوزها' : 'مدیران و سطح دسترسی'}
          </h3>
          <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
            {isRoot ? 'جست‌وجو با نام، شماره موبایل و شماره دانشجویی. اطلاعات این صفحه محرمانه‌اند.' :
              'تنها حساب‌های مدیریتی قابل مشاهده در محدودهٔ مجوزهای شما نمایش داده می‌شوند.'}
          </p>
          <span role="status" className="mt-2 inline-block text-xs font-bold text-blue-700 dark:text-blue-300">
            {filteredUsers.length.toLocaleString('fa-IR')} کاربر از {users.length.toLocaleString('fa-IR')} حساب
          </span>
        </div>
        {isRoot && <button type="button" onClick={exportDirectory}
          disabled={exporting || typeof window !== 'undefined' && window.location.pathname.startsWith('/demo/')}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <Download aria-hidden="true" className="h-4 w-4" />
          {exporting ? 'در حال دریافت…' : 'خروجی CSV قابل بازکردن با Excel'}
        </button>}
      </div>
      <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] dark:border-slate-800 dark:bg-slate-950/50">
        <label className="relative block min-w-0">
          <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">جست‌وجوی کاربر</span>
          <Search aria-hidden="true" className="pointer-events-none absolute right-3 top-[35px] h-4 w-4 text-slate-500" />
          <input type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder="نام، موبایل یا شماره دانشجویی"
            className="min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">نقش کاربر</span>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as typeof roleFilter)}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value="all">همهٔ نقش‌ها</option>
            <option value="student">دانشجو</option>
            <option value="admin">مدیر</option>
            {isRoot && <option value="super-admin">مدیر ارشد</option>}
          </select>
        </label>
        {isRoot && <label className="block">
          <span className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">تأیید شماره</span>
          <select value={verifiedFilter} onChange={e => setVerifiedFilter(e.target.value as typeof verifiedFilter)}
            className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <option value="all">همه</option>
            <option value="yes">تأییدشده</option>
            <option value="no">تأییدنشده</option>
          </select>
        </label>}
      </div>
      <div className="darschin-scroll-x">
        <table className="darschin-people-table w-full min-w-[680px] text-sm text-right">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            <tr>
              <th className="px-4 py-3 rounded-r-xl">نام کاربر</th>
              <th className="px-4 py-3">شماره موبایل</th>
              {isRoot && <th className="px-4 py-3">شماره دانشجویی</th>}
              <th className="px-4 py-3">نقش فعلی</th>
              <th className="px-4 py-3">دسترسی‌ها (Delegation)</th>
              <th className="px-4 py-3 rounded-l-xl">عملیات نقش</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
            {filteredUsers.map(u => (
              <tr key={u.id} className="hover:bg-white/40 dark:hover:bg-slate-800/30 transition-colors">
                <td data-label="نام مدیر" className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                <td data-label="شماره تماس" className="px-4 py-4 text-slate-500 darschin-numbers"><span dir="ltr" className="inline-block text-left">{u.mobile}</span></td>
                {isRoot && <td data-label="شماره دانشجویی" className="px-4 py-4 text-slate-500"><span dir="ltr">{u.profile?.studentNumber || '—'}</span></td>}
                <td data-label="نقش" className="px-4 py-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                    getHighestRole(u.roles) === 'super-admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    getHighestRole(u.roles) === 'admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {getHighestRole(u.roles) === 'super-admin' ? <ShieldAlert className="w-3 h-3" /> : getHighestRole(u.roles) === 'admin' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                    {getHighestRole(u.roles) === 'super-admin' ? 'مدیر ارشد' : getHighestRole(u.roles) === 'admin' ? 'مدیر سیستم' : 'دانشجو'}
                  </span>
                </td>
                <td data-label="مجوزها" className="px-4 py-4">
                  {getHighestRole(u.roles) === 'admin' && (
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_PERMISSIONS.map(perm => {
                        const hasPerm = u.permissions?.includes(perm.id);
                        const canGrant = currentUser?.roles?.includes('super-admin') || currentUser?.permissions?.includes(perm.id);
                        return (
                          <label key={perm.id} className={`flex min-h-10 items-center gap-2 text-xs px-2.5 py-2 rounded-lg border ${hasPerm ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700'} ${canGrant ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700' : 'opacity-50 cursor-not-allowed'}`}>
                            <input 
                              type="checkbox" 
                              checked={hasPerm} 
                              disabled={!canGrant}
                              onChange={(e) => handlePermissionChange(u.id, perm.id, e.target.checked)}
                              className="h-4 w-4 shrink-0 accent-blue-600" 
                            />
                            {perm.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {getHighestRole(u.roles) === 'super-admin' && (
                    <span className="text-xs text-slate-400">دارای تمامی دسترسی‌ها (Root)</span>
                  )}
                </td>
                <td data-label="تغییر نقش" className="px-4 py-4">
                  {u.roles?.includes('super-admin') && u.id === currentUser?.id ? (
                    <span className="text-xs text-slate-400 italic">شما مالک (Root) هستید</span>
                  ) : isRoot ? (
                    <select
                      className="darschin-field bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                      value={getHighestRole(u.roles)}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="student">تنزل به دانشجو</option>
                      <option value="admin">ارتقا به مدیر سیستم</option>
                      
                    </select>
                  ) : <span className="text-xs text-slate-500 dark:text-slate-400">ویرایش نقش فقط با مدیر ارشد</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminDemandAccessManager admins={users.filter(entry => entry.roles.includes('admin') || entry.roles.includes('super-admin'))} onChanged={fetchUsers} />
    </div>
  );
};
