import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Trash2, Edit2, Plus, Search, Check, X, RefreshCw } from 'lucide-react';

export interface Column {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'boolean' | 'select';
  options?: { label: string; value: string }[];
  /** Resolve select choices from an API collection, e.g. live course catalog. */
  lookupEndpoint?: string;
  lookupLabelKey?: string;
  lookupValueKey?: string;
}

interface AdminCrudTableProps {
  title: string;
  description?: string;
  endpoint: string;
  columns: Column[];
}

export const AdminCrudTable: React.FC<AdminCrudTableProps> = ({ title, description, endpoint, columns }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [lookupOptions, setLookupOptions] = useState<Record<string, { label: string; value: string }[]>>({});

  useEffect(() => {
    let current = true;
    const lookupCols = columns.filter(c => c.type === 'select' && c.lookupEndpoint);
    if (lookupCols.length === 0) return;

    Promise.all(lookupCols.map(async (col) => {
      const response = await apiRequest<Record<string, unknown>[]>(col.lookupEndpoint!);
      const values = response.success && Array.isArray(response.data) ? response.data : [];
      return [col.key, values.filter(item =>
        item[col.lookupValueKey || 'id'] !== undefined &&
        typeof item[col.lookupLabelKey || 'name'] === 'string',
      ).map(item => ({
        value: String(item[col.lookupValueKey || 'id']),
        label: String(item[col.lookupLabelKey || 'name']),
      }))] as const;
    })).then(entries => {
      if (current) setLookupOptions(Object.fromEntries(entries));
    }).catch(() => {
      if (current) setLookupOptions({});
    });
    return () => { current = false; };
  }, [endpoint]);

  const columnOptions = (col: Column) => col.lookupEndpoint
    ? (lookupOptions[col.key] || [])
    : (col.options || []);


  const fetchData = async () => {
    setLoading(true);
    const res = await apiRequest(endpoint);
    if (res.success && res.data) {
      setData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    setEditingId(null);
  }, [endpoint]);

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این مورد اطمینان دارید؟')) return;
    const res = await apiRequest(`${endpoint}/${id}`, { method: 'DELETE' });
    if (res.success) {
      fetchData();
    } else {
      alert(res.error || 'خطا در حذف آیتم');
    }
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    const isNew = id === 'new';
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? endpoint : `${endpoint}/${id}`;
    
    const payload = { ...editForm };
    columns.forEach(c => {
      if (c.type === 'number' && payload[c.key] !== undefined && payload[c.key] !== '') {
        payload[c.key] = Number(payload[c.key]);
      }
      if (c.type === 'boolean') {
        payload[c.key] = Boolean(payload[c.key]);
      }
    });

    const res = await apiRequest(url, { method, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.success) {
      setEditingId(null);
      fetchData();
    } else {
      alert(res.error || 'خطا در ذخیره سازی اطلاعات');
    }
  };

  const handleAdd = () => {
    const initialForm: any = {};
    columns.forEach(c => {
      if (c.type === 'boolean') initialForm[c.key] = true;
      else if (c.type === 'select' && columnOptions(c).length > 0) initialForm[c.key] = columnOptions(c)[0].value;
      else initialForm[c.key] = '';
    });
    setEditingId('new');
    setEditForm(initialForm);
  };

  const filteredData = data.filter(item => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return columns.some(col => {
      const val = item[col.key];
      return val !== undefined && val !== null && String(val).toLowerCase().includes(query);
    });
  });

  return (
    <div className="bg-liquid-glass rounded-3xl overflow-hidden shadow-xs border border-white/40 dark:border-slate-800/60">
      {/* Table Header & Controls */}
      <div className="p-5 border-b border-slate-200/60 dark:border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-800/40">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="جستجو در سطرها..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <button
            onClick={fetchData}
            title="بروزرسانی داده‌ها"
            className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 text-xs bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 transition-all hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl font-bold shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن مورد جدید</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-right">
          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            <tr>
              <th className="py-3 px-4 border-b border-slate-200/60 dark:border-slate-700/50 font-semibold w-12 text-center">
                #
              </th>
              {columns.map((c) => (
                <th key={c.key} className="py-3 px-4 border-b border-slate-200/60 dark:border-slate-700/50 font-semibold">
                  {c.label}
                </th>
              ))}
              <th className="py-3 px-4 border-b border-slate-200/60 dark:border-slate-700/50 font-semibold text-center w-28">
                عملیات
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/50">
            {/* New Item Form Row */}
            {editingId === 'new' && (
              <tr className="bg-blue-50/60 dark:bg-blue-950/40 animate-in fade-in">
                <td className="py-3 px-4 text-center font-bold text-blue-600 dark:text-blue-400">+</td>
                {columns.map((c) => (
                  <td key={c.key} className="py-3 px-4">
                    {c.type === 'boolean' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(editForm[c.key])}
                          onChange={(e) => setEditForm({ ...editForm, [c.key]: e.target.checked })}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span className="text-xs text-slate-700 dark:text-slate-300">
                          {editForm[c.key] ? 'فعال' : 'غیرفعال'}
                        </span>
                      </label>
                    ) : c.type === 'select' && (c.options || c.lookupEndpoint) ? (
                      <select
                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500"
                        value={editForm[c.key] || ''}
                        onChange={(e) => setEditForm({ ...editForm, [c.key]: e.target.value })}
                      >
                        {columnOptions(c).map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={c.type === 'number' ? 'number' : 'text'}
                        placeholder={`ورود ${c.label}...`}
                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editForm[c.key] !== undefined ? editForm[c.key] : ''}
                        onChange={(e) => setEditForm({ ...editForm, [c.key]: e.target.value })}
                      />
                    )}
                  </td>
                ))}
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => handleSave('new')}
                      disabled={saving}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs"
                    >
                      {saving ? '...' : 'ثبت'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs"
                    >
                      انصراف
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty or Loading States */}
            {loading ? (
              <tr>
                <td colSpan={columns.length + 2} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                    <span>در حال بارگذاری داده‌های سامانه...</span>
                  </div>
                </td>
              </tr>
            ) : filteredData.length === 0 && editingId !== 'new' ? (
              <tr>
                <td colSpan={columns.length + 2} className="py-12 text-center text-slate-400">
                  {searchQuery ? 'هیچ رکوردی منطبق با جستجو یافت نشد.' : 'داده‌ای در این بخش ثبت نشده است.'}
                </td>
              </tr>
            ) : (
              filteredData.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-white/40 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-center text-slate-400 font-mono">
                    {idx + 1}
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className="py-3 px-4 text-slate-800 dark:text-slate-200">
                      {editingId === item.id ? (
                        c.type === 'boolean' ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(editForm[c.key])}
                              onChange={(e) => setEditForm({ ...editForm, [c.key]: e.target.checked })}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                            />
                            <span className="text-xs">{editForm[c.key] ? 'فعال' : 'غیرفعال'}</span>
                          </label>
                        ) : c.type === 'select' && (c.options || c.lookupEndpoint) ? (
                          <select
                            className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                            value={editForm[c.key] || ''}
                            onChange={(e) => setEditForm({ ...editForm, [c.key]: e.target.value })}
                          >
                            {columnOptions(c).map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={c.type === 'number' ? 'number' : 'text'}
                            className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={editForm[c.key] !== undefined ? editForm[c.key] : ''}
                            onChange={(e) => setEditForm({ ...editForm, [c.key]: e.target.value })}
                          />
                        )
                      ) : (
                        typeof item[c.key] === 'boolean' ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            item[c.key]
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                          }`}>
                            {item[c.key] ? 'فعال' : 'غیرفعال'}
                          </span>
                        ) : (
                          <span className="font-medium">{item[c.key] !== undefined ? String(item[c.key]) : '---'}</span>
                        )
                      )}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-center">
                    {editingId === item.id ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleSave(item.id)}
                          disabled={saving}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs"
                        >
                          {saving ? '...' : 'ذخیره'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs"
                        >
                          لغو
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setEditForm({ ...item });
                          }}
                          title="ویرایش"
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          title="حذف"
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
