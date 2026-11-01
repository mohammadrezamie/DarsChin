import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../utils/api';
import { createRequestEpoch } from '../utils/request-epoch';
import { Trash2, Edit2, Plus, Search, Check, X, RefreshCw } from 'lucide-react';

export interface Column {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'boolean' | 'select';
  options?: { label: string; value: string }[];
  lookupEndpoint?: string;
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
  const saveLock = useRef(false);
  const requestEpoch = useRef(createRequestEpoch());
  const mutationEpoch = useRef(createRequestEpoch());
  // This ref follows the rendered workspace before effect cleanup, so late
  // HTTP results from another admin section cannot commit to the current UI.
  const currentEndpoint = useRef(endpoint);
  const endpointGeneration = useRef({ endpoint, version: 0 });
  if (endpointGeneration.current.endpoint !== endpoint) {
    endpointGeneration.current = { endpoint, version: endpointGeneration.current.version + 1 };
  }
  currentEndpoint.current = endpoint;
  const currentContext = `${endpoint}#${endpointGeneration.current.version}`;
  const [loadedContext, setLoadedContext] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lookupOptions, setLookupOptions] = useState<Record<string, { label: string; value: string }[]>>({});
  const lookupKey = columns.filter(column => column.lookupEndpoint)
    .map(column => column.key + ':' + column.lookupEndpoint).join('|');
  useEffect(() => {
    let active = true;
    for (const column of columns.filter(item => item.lookupEndpoint)) {
      void apiRequest<any[]>(column.lookupEndpoint!).then(response => {
        if (!active) return;
        const choices = response.success && Array.isArray(response.data)
          ? response.data.filter(row => row && row.id && row.active !== false).map(row => ({
              value: String(row.id),
              label: String(row.name || row.code || row.id) +
                (row.code ? ' · ' + String(row.code) : ''),
            }))
          : [];
        setLookupOptions(previous => ({ ...previous, [column.key]: choices }));
      });
    }
    return () => { active = false; };
  }, [lookupKey]);
  const getOptions = (column: Column) => column.options ?? lookupOptions[column.key] ?? [];

  const fetchData = async () => {
    const requestedEndpoint = endpoint;
    const requestedContext = currentContext;
    const epoch = requestEpoch.current.begin();
    const stillCurrent = () => requestEpoch.current.isCurrent(epoch) &&
      currentEndpoint.current === requestedEndpoint &&
      `${endpointGeneration.current.endpoint}#${endpointGeneration.current.version}` === requestedContext;
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<unknown>(requestedEndpoint);
      if (!stillCurrent()) return;
      if (res.success && Array.isArray(res.data)) {
        setData(res.data);
        setLoadedContext(requestedContext);
      } else {
        setData([]);
        setLoadedContext('');
        setError(res.success ? 'ساختار اطلاعات دریافت‌شده معتبر نیست.' :
          (res.error || 'بارگذاری اطلاعات انجام نشد. دوباره تلاش کنید.'));
      }
    } catch {
      if (stillCurrent()) {
        setData([]);
        setLoadedContext('');
        setError('ارتباط با سامانه برقرار نشد. دوباره تلاش کنید.');
      }
    } finally {
      if (stillCurrent()) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    setEditingId(null);
    setConfirmDeleteId(null);
    setNotice('');
    setSaving(false);
    saveLock.current = false;
    return () => {
      requestEpoch.current.invalidate();
      mutationEpoch.current.invalidate();
    };
  }, [endpoint]);

  const handleDelete = async (id: string) => {
    if (saveLock.current || confirmDeleteId !== id) return;
    const requestedEndpoint = endpoint;
    const requestedContext = currentContext;
    const epoch = mutationEpoch.current.begin();
    const stillCurrent = () => mutationEpoch.current.isCurrent(epoch) &&
      currentEndpoint.current === requestedEndpoint &&
      `${endpointGeneration.current.endpoint}#${endpointGeneration.current.version}` === requestedContext;
    saveLock.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await apiRequest(`${requestedEndpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!stillCurrent()) return;
      if (res.success) {
        setConfirmDeleteId(null);
        setNotice('رکورد انتخاب‌شده حذف شد.');
        void fetchData();
      } else {
        setError(res.error || 'حذف رکورد انجام نشد.');
      }
    } catch {
      if (stillCurrent()) setError('اتصال برای حذف رکورد برقرار نشد.');
    } finally {
      if (mutationEpoch.current.isCurrent(epoch)) {
        saveLock.current = false;
        if (stillCurrent()) setSaving(false);
      }
    }
  };

  const handleSave = async (id: string) => {
    if (saveLock.current) return;
    const requestedEndpoint = endpoint;
    const requestedContext = currentContext;
    const epoch = mutationEpoch.current.begin();
    const stillCurrent = () => mutationEpoch.current.isCurrent(epoch) &&
      currentEndpoint.current === requestedEndpoint &&
      `${endpointGeneration.current.endpoint}#${endpointGeneration.current.version}` === requestedContext;
    saveLock.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const isNew = id === 'new';
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? requestedEndpoint : `${requestedEndpoint}/${encodeURIComponent(id)}`;
      const payload = { ...editForm };
      columns.forEach(column => {
        if (column.type === 'number' && payload[column.key] !== undefined && payload[column.key] !== '') {
          payload[column.key] = Number(payload[column.key]);
        }
        if (column.type === 'boolean') {
          payload[column.key] = Boolean(payload[column.key]);
        }
      });
      const res = await apiRequest(url, { method, body: JSON.stringify(payload) });
      if (!stillCurrent()) return;
      if (res.success) {
        setEditingId(null);
        setNotice(isNew ? 'رکورد جدید با موفقیت ثبت شد.' : 'تغییرات رکورد ذخیره شد.');
        void fetchData();
      } else {
        setError(res.error || 'ذخیرهٔ اطلاعات انجام نشد.');
      }
    } catch {
      if (stillCurrent()) setError('ارتباط برای ذخیرهٔ اطلاعات برقرار نشد.');
    } finally {
      if (mutationEpoch.current.isCurrent(epoch)) {
        saveLock.current = false;
        if (stillCurrent()) setSaving(false);
      }
    }
  };

  const handleAdd = () => {
    if (saving) return;
    setConfirmDeleteId(null);
    setError('');
    setNotice('');
    const initialForm: any = {};
    columns.forEach(c => {
      if (c.type === 'boolean') initialForm[c.key] = true;
      else if (c.type === 'select') initialForm[c.key] = getOptions(c)[0]?.value || '';
      else initialForm[c.key] = '';
    });
    setEditingId('new');
    setEditForm(initialForm);
  };

  const filteredData = (loadedContext === currentContext ? data : []).filter(item => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();
    return columns.some(col => {
      const val = item[col.key];
      return val !== undefined && val !== null && String(val).toLowerCase().includes(query);
    });
  });

  return (
    <div className="darschin-crud bg-liquid-glass min-w-0 rounded-3xl overflow-hidden shadow-xs border border-white/40 dark:border-slate-800/60" dir="rtl">
      {/* Table Header & Controls */}
      <div className="p-5 border-b border-slate-200/60 dark:border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 dark:bg-slate-800/40">
        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          )}
        </div>

        <div className="flex min-w-0 w-full flex-wrap items-center gap-2.5 sm:w-auto sm:flex-nowrap">
          {/* Search bar */}
          <div className="relative min-w-[9rem] flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="جستجو در سطرها..."
              aria-label={`جست‌وجو در ${title}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="darschin-field w-full pr-9 pl-3 py-2 text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <button
            onClick={() => void fetchData()}
            disabled={saving}
            title="بروزرسانی داده‌ها"
            aria-label="به‌روزرسانی جدول"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleAdd}
            disabled={saving || loading}
            className="flex min-h-11 items-center justify-center gap-1.5 text-xs bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 transition-all hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl font-bold shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن مورد جدید</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 bg-white/30 px-4 py-2 text-xs text-slate-500 dark:border-slate-800/60 dark:bg-slate-900/30 dark:text-slate-400">
        <span role="status" aria-live="polite">
          {loading ? 'در حال دریافت اطلاعات…' : error && loadedContext !== currentContext ? 'دریافت اطلاعات نیاز به تلاش مجدد دارد' :
            `${new Intl.NumberFormat('fa-IR').format(filteredData.length)} مورد از ${new Intl.NumberFormat('fa-IR').format(data.length)} رکورد`}
        </span>
        {searchQuery && <button type="button" onClick={() => setSearchQuery('')}
          className="min-h-11 rounded-lg px-3 font-semibold text-blue-700 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-slate-800">
          پاک‌کردن جست‌وجو
        </button>}
      </div>
      {error && <div role="alert" className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
        <span className="min-w-0">{error}</span>
        {loadedContext !== currentContext && <button type="button" onClick={() => void fetchData()} disabled={loading}
          className="min-h-11 rounded-lg border border-rose-300 px-3 focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50">تلاش مجدد</button>}
      </div>}
      {notice && !error && <p role="status" className="mx-3 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}

      {/* Table Content */}
      <div className="darschin-scroll-x" role="region" aria-label={`جدول مدیریت: ${title}`} tabIndex={0}>
        <table className="darschin-crud-table w-full min-w-[640px] text-sm text-right">
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
            {editingId === 'new' && !loading && (
              <tr className="bg-blue-50/60 dark:bg-blue-950/40 animate-in fade-in">
                <td data-label="ردیف" className="py-3 px-4 text-right font-bold text-blue-600 dark:text-blue-400">+</td>
                {columns.map((c) => (
                  <td key={c.key} data-label={c.label} className="py-3 px-4">
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
                        {getOptions(c).map((opt) => (
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
                <td data-label="عملیات" className="py-3 px-4 text-right">
                  <div className="flex flex-wrap items-center justify-start gap-1.5">
                    <button
                      onClick={() => void handleSave('new')}
                      disabled={saving}
                      className="min-h-10 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs"
                    >
                      {saving ? '...' : 'ثبت'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                          disabled={saving}
                      className="min-h-10 px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs"
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
                  {error ? 'دریافت داده‌ها کامل نشد. برای ادامه، دوباره تلاش کنید.' : searchQuery ? 'هیچ رکوردی با این جست‌وجو پیدا نشد.' : 'هنوز رکوردی در این بخش ثبت نشده است.'}
                </td>
              </tr>
            ) : (
              filteredData.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-white/40 dark:hover:bg-slate-800/30 transition-colors">
                  <td data-label="ردیف" className="py-3 px-4 text-right text-slate-400 darschin-numbers">
                    {idx + 1}
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} data-label={c.label} className="py-3 px-4 text-slate-800 dark:text-slate-200">
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
                            {getOptions(c).map((opt) => (
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
                  <td data-label="عملیات" className="py-3 px-4 text-right">
                    {editingId === item.id ? (
                      <div className="flex flex-wrap items-center justify-start gap-1.5">
                        <button
                          onClick={() => void handleSave(item.id)}
                          disabled={saving}
                          className="min-h-10 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs"
                        >
                          {saving ? '...' : 'ذخیره'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={saving}
                          className="min-h-10 px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs"
                        >
                          لغو
                        </button>
                      </div>
                    ) : confirmDeleteId === item.id ? (
                      <div role="group" aria-label={`تأیید حذف ${String(item.name || item.title || item.code || item.id)}`}
                        className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2 dark:border-rose-900 dark:bg-rose-950/40">
                        <span className="text-xs font-bold text-rose-800 dark:text-rose-200">این رکورد حذف شود؟</span>
                        <button type="button" onClick={() => void handleDelete(item.id)} disabled={saving}
                          aria-label={`حذف قطعی ${String(item.name || item.title || item.code || item.id)}`}
                          className="min-h-11 rounded-lg bg-rose-700 px-3 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50">حذف قطعی</button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={saving}
                          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">انصراف</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-start gap-2">
                        <button type="button" disabled={saving} onClick={() => {
                            setConfirmDeleteId(null);
                            setEditingId(item.id);
                            setEditForm({ ...item });
                          }}
                          aria-label={`ویرایش ${String(item.name || item.title || item.code || item.id)}`}
                          title="ویرایش"
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                          <Edit2 aria-hidden="true" className="h-4 w-4" />
                        </button>
                        <button type="button" disabled={saving} onClick={() => { setConfirmDeleteId(item.id); setNotice(''); }}
                          aria-label={`درخواست حذف ${String(item.name || item.title || item.code || item.id)}`}
                          title="حذف"
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-40 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
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
