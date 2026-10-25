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
    <div className="darschin-admin-panel overflow-hidden">
      {/* Table Header & Controls */}
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          )}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="جستجو در سطرها..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-11 w-full pr-8 pl-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <button
            onClick={fetchData}
            title="بروزرسانی داده‌ها"
            className="min-h-11 min-w-11 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleAdd}
            className="flex min-h-11 items-center gap-1.5 text-sm bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 transition-all hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl font-bold shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن مورد جدید</span>
          </button>
        </div>
      </div>

      {/* Mobile: actual responsive CRUD cards instead of a horizontally squeezed table. */}
      <div className="grid gap-3 p-3 sm:p-4 md:hidden" aria-label={`رکوردهای ${title}`}>
        {editingId === 'new' && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30" aria-label="افزودن رکورد">
            <h4 className="mb-4 text-base font-black text-slate-900 dark:text-white">افزودن {title}</h4>
            <div className="grid gap-3">
              {columns.map(col => (
                <label key={col.key} className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span className="mb-1.5 block">{col.label}</span>
                  {col.type === 'boolean' ? (
                    <input type="checkbox" checked={Boolean(editForm[col.key])}
                      onChange={event => setEditForm({ ...editForm, [col.key]: event.target.checked })}
                      className="h-5 w-5 accent-blue-700" />
                  ) : col.type === 'select' && (col.options || col.lookupEndpoint) ? (
                    <select value={editForm[col.key] ?? ''} onChange={event => setEditForm({ ...editForm, [col.key]: event.target.value })}
                      className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                      {columnOptions(col).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  ) : (
                    <input type={col.type === 'number' ? 'number' : 'text'} value={editForm[col.key] ?? ''}
                      onChange={event => setEditForm({ ...editForm, [col.key]: event.target.value })}
                      className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={saving} onClick={() => handleSave('new')} className="min-h-11 rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50">ثبت رکورد</button>
              <button type="button" onClick={() => setEditingId(null)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">انصراف</button>
            </div>
          </section>
        )}
        {loading ? (
          <p role="status" className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-800">در حال دریافت اطلاعات…</p>
        ) : filteredData.length === 0 && editingId !== 'new' ? (
          <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-800">
            {searchQuery ? 'رکوردی با این جست‌وجو پیدا نشد.' : 'هنوز رکوردی ثبت نشده است.'}
          </p>
        ) : (
          filteredData.map((item, index) => (
            <article key={item.id || index} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="min-w-0 truncate text-sm font-black text-slate-900 dark:text-white">
                  {String(item.name || item.rawCourseName || item.subject || item.title || item.code || `رکورد ${index + 1}`)}
                </h4>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-300">#{index + 1}</span>
              </div>
              <div className="space-y-3">
                {columns.map(col => (
                  <div key={col.key}>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">{col.label}</label>
                    {editingId === item.id ? (
                      col.type === 'boolean' ? (
                        <input aria-label={col.label} type="checkbox" checked={Boolean(editForm[col.key])}
                          onChange={event => setEditForm({ ...editForm, [col.key]: event.target.checked })}
                          className="mt-2 h-5 w-5 accent-blue-700" />
                      ) : col.type === 'select' && (col.options || col.lookupEndpoint) ? (
                        <select aria-label={col.label} value={editForm[col.key] ?? ''}
                          onChange={event => setEditForm({ ...editForm, [col.key]: event.target.value })}
                          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                          {columnOptions(col).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      ) : (
                        <input aria-label={col.label} type={col.type === 'number' ? 'number' : 'text'} value={editForm[col.key] ?? ''}
                          onChange={event => setEditForm({ ...editForm, [col.key]: event.target.value })}
                          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                      )
                    ) : (
                      <div className="mt-1 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {typeof item[col.key] === 'boolean' ? (item[col.key] ? 'فعال' : 'غیرفعال') : String(item[col.key] ?? '—')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                {editingId === item.id ? (
                  <>
                    <button type="button" disabled={saving} onClick={() => handleSave(item.id)} className="min-h-11 rounded-xl bg-blue-700 px-3 text-sm font-black text-white disabled:opacity-50">ذخیره</button>
                    <button type="button" onClick={() => setEditingId(null)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-white">لغو</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => { setEditingId(item.id); setEditForm({ ...item }); }}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                      <Edit2 aria-hidden="true" className="h-4 w-4" /> ویرایش
                    </button>
                    <button type="button" onClick={() => handleDelete(item.id)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                      <Trash2 aria-hidden="true" className="h-4 w-4" /> حذف
                    </button>
                  </>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      {/* Desktop and tablet: retain a dense comparison table where space permits. */}
      <div className="hidden overflow-x-auto md:block">
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
