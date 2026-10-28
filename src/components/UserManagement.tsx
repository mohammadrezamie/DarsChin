import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../utils/api';
import { downloadUserExcel } from '../utils/user-excel-download';
import { User } from '../types';
import { Shield, User as UserIcon, ShieldAlert, Search, Download } from 'lucide-react';
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

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all'|'student'|'admin'|'super-admin'>('all');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const { user: currentUser } = useAuth();
  const isRoot = !!currentUser?.roles?.includes('super-admin');
  const isDemo = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo/');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = isRoot ? '/api/admin/users' : '/api/admin-management';
      const result = await apiRequest<User[]>(endpoint);
      if (result.success && Array.isArray(result.data)) setUsers(result.data);
      else setError(result.error || 'خطا در دریافت فهرست کاربران');
    } catch {
      setError('ارتباط با فهرست کاربران برقرار نشد.');
    } finally {
      setLoading(false);
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

  const filteredUsers = useMemo(() => {
    const text = search.trim().toLocaleLowerCase('fa').replace(/ي/g, 'ی').replace(/ك/g, 'ک');
    return users.filter(user => {
      const profile = (user as User & {profile?: {studentNumber?: string}}).profile;
      const fields = [user.name, user.mobile, profile?.studentNumber || ''].join(' ')
        .toLocaleLowerCase('fa').replace(/ي/g, 'ی').replace(/ك/g, 'ک');
      return (roleFilter === 'all' || user.roles?.includes(roleFilter)) &&
        (!text || fields.includes(text));
    });
  }, [users, search, roleFilter]);

  const handleExcel = async () => {
    if (!isRoot || isDemo || exporting) return;
    setExporting(true);
    setExportError('');
    try { await downloadUserExcel(roleFilter); }
    catch (error) { setExportError(error instanceof Error ? error.message : 'دریافت فایل ناموفق بود.'); }
    finally { setExporting(false); }
  };

  if (loading) return <div className="p-8 text-center">در حال بارگذاری...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div dir="rtl" className="darschin-surface min-w-0 p-4 sm:p-6">
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-red-500" /> {isRoot ? 'فهرست کاربران و مجوزها' : 'مدیریت مدیران مجاز'}
      </h3>
      
      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-end">
        <label className="min-w-0 text-sm font-bold text-slate-700 dark:text-slate-200">
          جست‌وجوی کاربر
          <span className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:ring-2 focus-within:ring-blue-500 dark:border-slate-700 dark:bg-slate-950">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
            <input type="search" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="نام، موبایل، شماره دانشجویی" className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none dark:text-white" />
          </span>
        </label>
        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
          نوع دسترسی
          <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value as typeof roleFilter)}
            className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            <option value="all">همه</option><option value="student">دانشجو</option>
            <option value="admin">مدیر</option><option value="super-admin">مدیر ارشد</option>
          </select>
        </label>
        {isRoot && !isDemo && <button type="button" disabled={exporting} onClick={handleExcel}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white disabled:opacity-60">
          <Download aria-hidden="true" className="h-4 w-4" />{exporting ? 'در حال خروجی‌گیری…' : 'دانلود Excel'}
        </button>}
      </div>
      <p role="status" className="mb-3 text-xs leading-6 text-slate-600 dark:text-slate-300">
        {filteredUsers.length.toLocaleString('fa-IR')} کاربر از {users.length.toLocaleString('fa-IR')} رکورد
      </p>
      {exportError && <p role="alert" className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200">{exportError}</p>}
      <div className="darschin-scroll-x">
        <table className="darschin-people-table w-full min-w-[680px] text-sm text-right">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            <tr>
              <th className="px-4 py-3 rounded-r-xl">نام کاربر</th>
              <th className="px-4 py-3">شماره موبایل</th>
              <th className="px-4 py-3">نقش فعلی</th>
              <th className="px-4 py-3">دسترسی‌ها (Delegation)</th>
              <th className="px-4 py-3 rounded-l-xl">عملیات نقش</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-white/40 dark:hover:bg-slate-800/30 transition-colors">
                <td data-label="نام مدیر" className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                <td data-label="شماره تماس" className="px-4 py-4 text-slate-500 darschin-numbers"><span dir="ltr" className="inline-block text-left">{u.mobile}</span></td>
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
                  ) : (
                    <select
                      className="darschin-field bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                      value={getHighestRole(u.roles)}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="student">تنزل به دانشجو</option>
                      <option value="admin">ارتقا به مدیر سیستم</option>
                      {currentUser?.roles?.includes('super-admin') && <option value="super-admin">ارتقا به مدیر ارشد</option>}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AdminDemandAccessManager admins={users} onChanged={fetchUsers} />
    </div>
  );
};
