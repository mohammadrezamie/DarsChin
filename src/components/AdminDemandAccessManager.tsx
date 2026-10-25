import React, { useEffect, useMemo, useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import type { DemandManagerScope, User } from '../types';

type AcademicEntity = { id: string; name: string; degreeLevelId?: string; active?: boolean };
type Meta = { campuses: AcademicEntity[]; degreeLevels: AcademicEntity[]; majors: AcademicEntity[] };
const keyFor = (s: DemandManagerScope) => `${s.campusId}|${s.degreeLevelId}|${s.majorId}`;

/** Root-only administrative assignment, independent from general panel permissions. */
export const AdminDemandAccessManager: React.FC<{
  admins: User[];
  onChanged: () => Promise<void> | void;
}> = ({ admins, onChanged }) => {
  const { user } = useAuth();
  const [meta, setMeta] = useState<Meta>({ campuses: [], degreeLevels: [], majors: [] });
  const [managerId, setManagerId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [degreeLevelId, setDegreeLevelId] = useState('');
  const [majorId, setMajorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const isRoot = user?.roles.includes('super-admin');

  useEffect(() => {
    if (!isRoot) return;
    let alive = true;
    void apiRequest<Meta>('/api/academic/all-meta').then(result => {
      if (alive && result.success && result.data) setMeta(result.data);
    });
    return () => { alive = false; };
  }, [isRoot]);

  const managers = admins.filter(entry =>
    entry.roles.includes('admin') && !entry.roles.includes('super-admin'));
  const selected = managers.find(entry => entry.id === managerId) || managers[0];
  const effectiveDegreeLevelId = degreeLevelId || meta.degreeLevels.find(d => d.active !== false)?.id || '';
  const validMajors = useMemo(() =>
    meta.majors.filter(m => m.active !== false && m.degreeLevelId === effectiveDegreeLevelId),
    [meta.majors, effectiveDegreeLevelId]);
  const candidate = {
    campusId: campusId || meta.campuses.find(c => c.active !== false)?.id || '',
    degreeLevelId: effectiveDegreeLevelId,
    majorId: majorId || validMajors[0]?.id || '',
  };
  const scopes = selected?.demandScopes || [];

  const update = async (next: DemandManagerScope[]) => {
    if (!selected) return;
    setBusy(true);
    setMessage('');
    try {
      const r = await apiRequest(`/api/admin-management/${selected.id}/demand-scopes`, {
        method: 'PUT', body: JSON.stringify({ scopes: next }),
      });
      if (!r.success) {
        setMessage(r.error || 'تغییر محدودهٔ مدیریتی ثبت نشد.');
        return;
      }
      setMessage('محدوده‌های نیازسنجی ذخیره و در گزارش حسابرسی ثبت شدند.');
      await onChanged();
    } finally {
      setBusy(false);
    }
  };
  if (!isRoot) return null;
  return (
    <section dir="rtl" className="mt-7 rounded-2xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20" aria-label="محدودهٔ دسترسی مدیر گروه">
      <h4 className="flex items-center gap-2 text-base font-black text-slate-900 dark:text-white">
        <ShieldCheck className="h-5 w-5 text-blue-700 dark:text-blue-300" /> دسترسی نیازسنجی مدیر گروه
      </h4>
      <p className="mt-2 text-xs leading-7 text-slate-600 dark:text-slate-300">
        فقط مدیر ارشد مجاز است محدوده را تعیین کند. مجوز «مدیریت نیازسنجی» یا «دریافت گزارش شخصی» بدون محدودهٔ واحد، مقطع و رشته هیچ دسترسی عملی ایجاد نمی‌کند.
      </p>
      {!managers.length ? (
        <p className="mt-3 rounded-xl bg-white p-3 text-sm dark:bg-slate-900">ابتدا از بخش کاربران، یک مدیر عادی ایجاد یا انتخاب کن.</p>
      ) : (
        <>
          <label className="mt-4 block text-xs font-bold">مدیر مورد نظر
            <select value={selected?.id || ''} onChange={e => setManagerId(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
              {managers.map(m => <option key={m.id} value={m.id}>{m.name} · {m.mobile}</option>)}
            </select>
          </label>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-xs font-bold">واحد دانشگاهی
              <select value={candidate.campusId} onChange={e => setCampusId(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900">
                {meta.campuses.filter(c=>c.active!==false).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold">مقطع
              <select value={candidate.degreeLevelId} onChange={e=>{setDegreeLevelId(e.target.value);setMajorId('')}}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900">
                {meta.degreeLevels.filter(d=>d.active!==false).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold">رشته
              <select value={candidate.majorId} onChange={e=>setMajorId(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900">
                {validMajors.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>
          <button type="button" disabled={busy || !candidate.campusId || !candidate.majorId || !candidate.degreeLevelId ||
              scopes.some(scope=>keyFor(scope)===keyFor(candidate))}
            onClick={()=>void update([...scopes,candidate])}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-black text-white disabled:opacity-50">
            <Plus className="h-4 w-4" /> افزودن محدوده
          </button>
          <h5 className="mt-5 text-sm font-black">محدوده‌های ثبت‌شده برای این مدیر</h5>
          <div className="mt-2 space-y-2">
            {!scopes.length && <p className="text-xs text-slate-500">هنوز محدوده‌ای تعیین نشده؛ این مدیر اجازهٔ مشاهدهٔ پاسخ‌های دانشجویان را ندارد.</p>}
            {scopes.map(scope => (
              <div key={keyFor(scope)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
                <span className="font-semibold">
                  {meta.campuses.find(c=>c.id===scope.campusId)?.name || scope.campusId}
                  {' · '}
                  {meta.degreeLevels.find(d=>d.id===scope.degreeLevelId)?.name || scope.degreeLevelId}
                  {' · '}
                  {meta.majors.find(m=>m.id===scope.majorId)?.name || scope.majorId}
                </span>
                <button type="button" disabled={busy} onClick={()=>void update(scopes.filter(item=>keyFor(item)!==keyFor(scope)))}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-rose-200 px-3 text-rose-700 dark:border-rose-900 dark:text-rose-300">
                  <Trash2 className="h-3.5 w-3.5"/> حذف دسترسی
                </button>
              </div>
            ))}
          </div>
          {message && <p role="status" className="mt-3 text-xs font-bold text-blue-800 dark:text-blue-200">{message}</p>}
        </>
      )}
    </section>
  );
};