import React, { useEffect, useState } from 'react';
import { apiRequest } from '../utils/api';
import { User } from '../types';
import { Shield, User as UserIcon, ShieldAlert } from 'lucide-react';

const getHighestRole = (roles?: string[]) => {
  if (roles?.includes('super-admin')) return 'super-admin';
  if (roles?.includes('admin')) return 'admin';
  return 'student';
};

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    const res = await apiRequest<{ data: User[] }>('/api/admin/users');
    if (res.success && res.data) {
      setUsers(res.data);
    } else {
      setError(res.error || 'خطا در دریافت لیست کاربران');
    }
    setLoading(false);
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
    if (res.success) {
      fetchUsers();
    } else {
      alert(res.error || 'خطا در تغییر نقش');
    }
  };

  if (loading) return <div className="p-8 text-center">در حال بارگذاری...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="bg-liquid-glass rounded-3xl p-6">
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-red-500" /> مدیریت کاربران (سطح مدیر ارشد)
      </h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-right">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            <tr>
              <th className="px-4 py-3 rounded-r-xl">نام کاربر</th>
              <th className="px-4 py-3">ایمیل / نام کاربری</th>
              <th className="px-4 py-3">نقش فعلی</th>
              <th className="px-4 py-3 rounded-l-xl">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50 dark:divide-slate-700/50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-white/40 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                <td className="px-4 py-4 text-slate-500 font-mono" dir="ltr">{u.mobile}</td>
                <td className="px-4 py-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                    getHighestRole(u.roles) === 'super-admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    getHighestRole(u.roles) === 'admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {getHighestRole(u.roles) === 'super-admin' ? <ShieldAlert className="w-3 h-3" /> : getHighestRole(u.roles) === 'admin' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                    {getHighestRole(u.roles) === 'super-admin' ? 'مدیر ارشد' : getHighestRole(u.roles) === 'admin' ? 'مدیر سیستم' : 'دانشجو'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {u.mobile !== '09911902465' ? (
                    <select
                      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                      value={getHighestRole(u.roles)}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
                      <option value="student">ارتقا/تنزل به دانشجو</option>
                      <option value="admin">ارتقا به مدیر سیستم</option>
                      <option value="super-admin">ارتقا به مدیر ارشد</option>
                    </select>
                  ) : (
                    <span className="text-xs text-slate-400 italic">غیرقابل تغییر (Root)</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
