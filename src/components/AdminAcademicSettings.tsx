// ============================================================================
// DARSCHYN (درس‌چین) - Admin Academic Policy & Final Semester Management
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Save,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  UserCheck,
  UserX,
  FileText,
  HelpCircle,
  GraduationCap,
} from 'lucide-react';
import { AcademicPolicySettings, AcademicLimitInfo } from '../types';
import { apiRequest } from '../utils/api';

interface StudentOverviewItem {
  userId: string;
  name: string;
  mobile: string;
  majorName: string;
  profile: any;
  limits: AcademicLimitInfo;
}

export const AdminAcademicSettings: React.FC = () => {
  const [settings, setSettings] = useState<AcademicPolicySettings | null>(null);
  const [students, setStudents] = useState<StudentOverviewItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedStudentForOverride, setSelectedStudentForOverride] = useState<StudentOverviewItem | null>(null);
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overrideStatus, setOverrideStatus] = useState<boolean | null>(null);
  const [savingOverride, setSavingOverride] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [settingsRes, studentsRes] = await Promise.all([
      apiRequest<AcademicPolicySettings>('/api/admin/academic-settings'),
      apiRequest<StudentOverviewItem[]>('/api/admin/students-overview'),
    ]);

    if (settingsRes.success && settingsRes.data) {
      setSettings(settingsRes.data);
    }
    if (studentsRes.success && studentsRes.data) {
      setStudents(studentsRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    setMessage(null);

    const res = await apiRequest('/api/admin/academic-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });

    setSavingSettings(false);
    if (res.success) {
      setMessage({ type: 'success', text: 'تنظیمات سقف واحدهای آموزشی با موفقیت ذخیره گردید.' });
      fetchData();
    } else {
      setMessage({ type: 'error', text: res.error || 'خطا در ذخیره تنظیمات.' });
    }
  };

  const handleSaveOverride = async () => {
    if (!selectedStudentForOverride) return;
    setSavingOverride(true);
    const res = await apiRequest(`/api/admin/students/${selectedStudentForOverride.userId}/final-semester-override`, {
      method: 'PUT',
      body: JSON.stringify({
        isFinalSemesterOverride: overrideStatus,
        finalSemesterNotes: overrideNotes,
      }),
    });

    setSavingOverride(false);
    if (res.success) {
      setSelectedStudentForOverride(null);
      fetchData();
    } else {
      alert(res.error || 'خطا در ذخیره مجوز دستی دانشجو');
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.mobile.includes(searchTerm) ||
      s.majorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading || !settings) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="text-xs text-slate-500">در حال دریافت تنظیمات آیین‌نامه و وضعیت دانشجویان...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 bg-liquid-glass rounded-3xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              تنظیمات سقف واحدهای آموزشی و مجوز ترم آخری
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              پیکربندی سقف مجاز عادی، سقف دانشجویان ممتاز، ترم تابستان و قانون ترم آخری (۲۴ واحد)
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all self-end md:self-center"
        >
          <RefreshCw className="w-4 h-4" />
          <span>بروزرسانی داده‌ها</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Global Academic Rules Form */}
      <form onSubmit={handleSaveSettings} className="p-6 bg-liquid-glass rounded-3xl shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-700/80 pb-4">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>قوانین سراسری آیین‌نامه آموزشی</span>
          </div>
          <button
            type="submit"
            disabled={savingSettings}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingSettings ? 'در حال ذخیره...' : 'ذخیره تغییرات آیین‌نامه'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Normal Semester */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
              نیمسال عادی (ترم پاییز / بهار)
            </span>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">حداقل واحد مجاز</label>
              <input
                type="number"
                value={settings.normalMinUnits}
                onChange={(e) => setSettings({ ...settings, normalMinUnits: parseInt(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">سقف عادی انتخاب واحد</label>
              <input
                type="number"
                value={settings.normalMaxUnits}
                onChange={(e) => setSettings({ ...settings, normalMaxUnits: parseInt(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
              />
            </div>
          </div>

          {/* GPA Bonus */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
              دانشجویان ممتاز (معدل الف)
            </span>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">حداقل معدل مشمول</label>
              <input
                type="number"
                step="0.01"
                value={settings.gpaBonusThreshold}
                onChange={(e) => setSettings({ ...settings, gpaBonusThreshold: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">سقف واحد دانشجوی ممتاز</label>
              <input
                type="number"
                value={settings.gpaBonusMaxUnits}
                onChange={(e) => setSettings({ ...settings, gpaBonusMaxUnits: parseInt(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
              />
            </div>
          </div>

          {/* Summer Term */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
              دوره تابستان
            </span>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">حداقل واحد مجاز تابستان</label>
              <input
                type="number"
                value={settings.summerMinUnits}
                onChange={(e) => setSettings({ ...settings, summerMinUnits: parseInt(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">سقف واحد تابستان</label>
              <input
                type="number"
                value={settings.summerMaxUnits}
                onChange={(e) => setSettings({ ...settings, summerMaxUnits: parseInt(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
              />
            </div>
          </div>

          {/* Final Semester Policy */}
          <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                مجوز ترم آخری («آخرین ترم»)
              </span>
              <input
                type="checkbox"
                checked={settings.finalSemesterRuleEnabled}
                onChange={(e) => setSettings({ ...settings, finalSemesterRuleEnabled: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded-sm"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">حداکثر واحدهای باقیمانده مجاز</label>
              <input
                type="number"
                value={settings.finalSemesterThresholdUnits}
                onChange={(e) => setSettings({ ...settings, finalSemesterThresholdUnits: parseInt(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">سقف مجاز انتخاب واحد ترم آخری</label>
              <input
                type="number"
                value={settings.finalSemesterMaxUnits}
                onChange={(e) => setSettings({ ...settings, finalSemesterMaxUnits: parseInt(e.target.value) || 0 })}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Student List & Final Semester Status Monitor */}
      <div className="p-6 bg-liquid-glass rounded-3xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              وضعیت فارغ‌التحصیلی و مجوز ترم آخری دانشجویان ({students.length} دانشجو)
            </h4>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="جستجوی دانشجو، شماره یا رشته..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3">نام دانشجو</th>
                <th className="py-3 px-3">شماره تماس</th>
                <th className="py-3 px-3">رشته</th>
                <th className="py-3 px-3 text-center">واحدهای گذرانده</th>
                <th className="py-3 px-3 text-center">واحدهای باقیمانده</th>
                <th className="py-3 px-3 text-center">وضعیت ترم آخری</th>
                <th className="py-3 px-3 text-center">سقف مجاز فعلی</th>
                <th className="py-3 px-3 text-center">عملیات دستی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
              {filteredStudents.map((s) => {
                const limits = s.limits;
                const isFinal = limits?.isFinalSemester;
                const hasOverride = s.profile?.isFinalSemesterOverride !== undefined && s.profile?.isFinalSemesterOverride !== null;

                return (
                  <tr key={s.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{s.name}</td>
                    <td className="py-3 px-3 text-slate-500 font-mono">{s.mobile}</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">{s.majorName}</td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {limits?.passedUnits ?? 0} واحد
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                      {limits?.remainingUnits ?? '-'} واحد
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isFinal ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                          <CheckCircle2 className="w-3 h-3" />
                          ترم آخری (مجاز ۲۴ واحد)
                          {hasOverride && <span className="text-[10px] text-emerald-600">(دستی)</span>}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          عادی
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-black text-blue-600 dark:text-blue-400">
                      {limits?.effectiveMaxUnits ?? 20} واحد
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedStudentForOverride(s);
                          setOverrideStatus(s.profile?.isFinalSemesterOverride ?? null);
                          setOverrideNotes(s.profile?.finalSemesterNotes ?? '');
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors"
                      >
                        مجوز کمیسیون / دستی
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override Modal */}
      {selectedStudentForOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-liquid-glass rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>ثبت مجوز ترم آخری برای {selectedStudentForOverride.name}</span>
            </h3>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div>واحدهای گذرانده: <strong>{selectedStudentForOverride.limits.passedUnits}</strong></div>
              <div>واحدهای باقیمانده: <strong>{selectedStudentForOverride.limits.remainingUnits}</strong></div>
              <div>وضعیت خودکار سیستمی: <strong>{selectedStudentForOverride.limits.isFinalSemester ? 'ترم آخری' : 'عادی'}</strong></div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                تصمیم کمیسیون / مدیر آموزش:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideStatus(true)}
                  className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                    overrideStatus === true
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  اعطای مجوز (۲۴ واحد)
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideStatus(false)}
                  className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                    overrideStatus === false
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  رد مجوز (سقف عادی)
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideStatus(null)}
                  className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                    overrideStatus === null
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  محاسبه خودکار
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">شماره نامه کمیسیون / توضیحات:</label>
              <textarea
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                placeholder="مثلاً: بر اساس مصوبه شورای آموزشی مورخ ۱۴۰۲/۱۱/۰۱..."
                rows={3}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedStudentForOverride(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                انصراف
              </button>
              <button
                onClick={handleSaveOverride}
                disabled={savingOverride}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
              >
                {savingOverride ? 'در حال ثبت...' : 'ثبت تصمیم'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
