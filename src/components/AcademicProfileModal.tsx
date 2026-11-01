// ============================================================================
// DARSCHYN (درس‌چین) - Student Academic Profile Setup Modal
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  X,
  GraduationCap,
  Building,
  BookOpen,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  University, Province,
  Campus,
  DegreeLevel,
  Major,
  Track,
  EntryYear,
  AcademicTerm,
  StudentAcademicProfile,
} from '../types';
import { apiRequest } from '../utils/api';

interface AcademicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: () => void;
}

export const AcademicProfileModal: React.FC<AcademicProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const [universities, setUniversities] = useState<University[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [degreeLevels, setDegreeLevels] = useState<DegreeLevel[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [entryYears, setEntryYears] = useState<EntryYear[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);

  const [universityId, setUniversityId] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [degreeLevelId, setDegreeLevelId] = useState('');
  const [majorId, setMajorId] = useState('');
  const [entryYearId, setEntryYearId] = useState('');
  const [currentTermId, setCurrentTermId] = useState('');
  const [previousTermGpa, setPreviousTermGpa] = useState<string>('');

  // Track status logic (Critical Requirement)
  const [isTrackSelected, setIsTrackSelected] = useState<boolean>(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [desiredTrackIds, setDesiredTrackIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadAll = async () => {
      setLoading(true);
      // Fetch metadata and current profile
      const [metaRes, profileRes] = await Promise.all([
        apiRequest<{
          universities: University[];
          provinces: Province[];
          campuses: Campus[];
          degreeLevels: DegreeLevel[];
          majors: Major[];
          tracks: Track[];
          entryYears: EntryYear[];
          academicTerms: AcademicTerm[];
        }>('/api/academic/all-meta'),
        apiRequest<{ profile: StudentAcademicProfile }>('/api/student/profile'),
      ]);

      if (metaRes.success && metaRes.data) {
        setUniversities(metaRes.data.universities);
        setProvinces(metaRes.data.provinces || []);
        setCampuses(metaRes.data.campuses);
        setDegreeLevels(metaRes.data.degreeLevels);
        setMajors(metaRes.data.majors);
        setTracks(metaRes.data.tracks);
        setEntryYears(metaRes.data.entryYears);
        setTerms(metaRes.data.academicTerms);
      }

      if (profileRes.success && profileRes.data?.profile) {
        const p = profileRes.data.profile;
        setUniversityId(p.universityId || '');
        setProvinceId(p.provinceId || '');
        setCampusId(p.campusId || '');
        setDegreeLevelId(p.degreeLevelId || '');
        setMajorId(p.majorId || '');
        setEntryYearId(p.entryYearId || '');
        setCurrentTermId(p.currentTermId || '');
        setPreviousTermGpa(p.previousTermGpa === null || p.previousTermGpa === undefined
          ? '' : String(p.previousTermGpa));
        setIsTrackSelected(Boolean(p.isTrackSelected));
        setSelectedTrackId(p.selectedTrackId || '');
        setDesiredTrackIds(p.desiredTrackIds || []);
      }

      setLoading(false);
    };

    loadAll();
  }, [isOpen]);

  if (!isOpen) return null;

  // Filtered lists based on parent selection
  const filteredCampuses = campuses.filter(c => c.active !== false &&
    (!universityId || c.universityId === universityId) &&
    (!provinceId || !c.provinceId || c.provinceId === provinceId));
  const filteredMajors = majors.filter(m => m.active !== false &&
    (!degreeLevelId || m.degreeLevelId === degreeLevelId));
  const filteredTracks = tracks.filter(t => t.active !== false &&
    (!majorId || t.majorId === majorId));

  const toggleDesiredTrack = (trackId: string) => {
    setDesiredTrackIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  };

  const selectAllTracks = () => {
    setDesiredTrackIds(filteredTracks.map((t) => t.id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    // Validation
    if (!campusId || !degreeLevelId || !majorId || !entryYearId) {
      setMessage({ type: 'error', text: 'لطفاً تمامی مشخصات اصلی پرونده تحصیلی را مشخص فرمایید.' });
      setSaving(false);
      return;
    }

    if (isTrackSelected && !selectedTrackId) {
      setMessage({ type: 'error', text: 'لطفاً گرایش رسمی انتخاب‌شده خود را مشخص نمایید.' });
      setSaving(false);
      return;
    }

    if (!isTrackSelected && desiredTrackIds.length === 0 && filteredTracks.length > 0) {
      setMessage({ type: 'error', text: 'لطفاً حداقل یک گرایش مدنظر جهت بررسی وضعیت چارت انتخاب نمایید.' });
      setSaving(false);
      return;
    }

    const payload: Partial<StudentAcademicProfile> = {
      universityId: universityId || 'univ-azad',


      provinceId,
      campusId,
      degreeLevelId,
      majorId,
      entryYearId,
      currentTermId: currentTermId || terms.find((t) => t.isCurrent)?.id,
      isTrackSelected,
      selectedTrackId: isTrackSelected ? selectedTrackId : null,
      desiredTrackIds: isTrackSelected ? [] : desiredTrackIds,
      previousTermGpa: previousTermGpa ? parseFloat(previousTermGpa) : null,
    };

    const res = await apiRequest('/api/student/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (res.success) {
      setMessage({ type: 'success', text: 'پرونده تحصیلی شما با موفقیت به‌روزرسانی شد.' });
      setTimeout(() => {
        onProfileUpdated();
        onClose();
      }, 700);
    } else {
      setMessage({ type: 'error', text: res.error || 'خطا در ذخیره پروفایل تحصیلی.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        id="academicProfileModalContainer"
        role="dialog"
        aria-modal="true"
        aria-label="تنظیمات پروندهٔ تحصیلی"
        className="darschin-dialog darschin-page bg-liquid-glass w-full max-w-2xl rounded-3xl p-4 shadow-xl sm:p-6 relative my-4"
      >
        <button
          id="btnCloseProfileModal"
          type="button"
          aria-label="بستن تنظیمات پروندهٔ تحصیلی"
          onClick={onClose}
          className="absolute top-3 left-3 flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white sm:top-4 sm:left-4"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              تنظیمات پرونده تحصیلی و گرایش
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              مشخصات تحصیلی شما مبنای تطبیق چارت و بررسی پیش‌نیازهای دروس ارائه‌شده است.
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{message.text}</span>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">در حال بارگذاری اطلاعات تحصیلی...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* University (Read-Only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  دانشگاه
                </label>
                <div className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 text-slate-500 cursor-not-allowed">
                  دانشگاه آزاد اسلامی
                </div>
              </div>

              {/* Province */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  استان / منطقه (اختیاری)
                </label>
                <select
                  id="selectProfileProvince"
                  value={provinceId}
                  onChange={(e) => {setProvinceId(e.target.value);setCampusId('');}}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                >
                  <option value="">-- همه واحدها / واحدهای مستقل --</option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Campus / Unit */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  واحد / پردیس دانشگاهی
                </label>
                <select
                  id="selectProfileCampus"
                  value={campusId}
                  onChange={(e) => setCampusId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                >
                  <option value="">-- انتخاب واحد --</option>
                  {filteredCampuses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Degree Level */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  مقطع تحصیلی
                </label>
                <select
                  id="selectProfileDegree"
                  value={degreeLevelId}
                  onChange={(e) => {setDegreeLevelId(e.target.value);setMajorId('');setSelectedTrackId('');setDesiredTrackIds([]);setIsTrackSelected(false);}}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                >
                  <option value="">-- انتخاب مقطع --</option>
                  {degreeLevels.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Major */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  رشته تحصیلی
                </label>
                <select
                  id="selectProfileMajor"
                  value={majorId}
                  onChange={(e) => {setMajorId(e.target.value);setSelectedTrackId('');setDesiredTrackIds([]);setIsTrackSelected(false);}}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                >
                  <option value="">-- انتخاب رشته --</option>
                  {filteredMajors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entry Year */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  سال ورود
                </label>
                <select
                  id="selectProfileEntryYear"
                  value={entryYearId}
                  onChange={(e) => setEntryYearId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                >
                  <option value="">-- انتخاب سال ورود --</option>
                  {entryYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      ورودی سال {y.year}
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Term */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  نیمسال تحصیلی جاری
                </label>
                <select
                  id="selectProfileCurrentTerm"
                  value={currentTermId}
                  onChange={(e) => setCurrentTermId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                >
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.isCurrent ? '(ترم جاری)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* TRACK SELECTION STATUS (CRITICAL REQUIREMENT) */}
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  وضعیت انتخاب گرایش تخصصی:
                </span>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                آیا گرایش تخصصی خود را به صورت رسمی در آموزش دانشگاه تعیین کرده‌اید؟
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  id="btnTrackSelectedOfficial"
                  onClick={() => setIsTrackSelected(true)}
                  className={`p-3 rounded-xl border text-right transition-all flex items-start gap-2.5 ${
                    isTrackSelected
                      ? 'bg-white dark:bg-slate-800 border-blue-500 text-blue-900 dark:text-blue-200 shadow-xs'
                      : 'bg-transparent border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center ${isTrackSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-400'}`}>
                    {isTrackSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="font-bold text-xs">بله، گرایش رسمی انتخاب شده است</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">یک گرایش مشخص برای ارزیابی چارت لحاظ می‌شود.</div>
                  </div>
                </button>

                <button
                  type="button"
                  id="btnTrackNotSelectedUndeclared"
                  onClick={() => setIsTrackSelected(false)}
                  className={`p-3 rounded-xl border text-right transition-all flex items-start gap-2.5 ${
                    !isTrackSelected
                      ? 'bg-white dark:bg-slate-800 border-blue-500 text-blue-900 dark:text-blue-200 shadow-xs'
                      : 'bg-transparent border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center ${!isTrackSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-400'}`}>
                    {!isTrackSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="font-bold text-xs">خیر، هنوز گرایش تعیین نشده (دانشجوی بدون گرایش)</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">می‌توانید چند گرایش یا همه گرایش‌ها را بررسی کنید.</div>
                  </div>
                </button>
              </div>

              {/* STATE A: Exactly one official track */}
              {isTrackSelected ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    گرایش رسمی ثبت‌شده در آموزش:
                  </label>
                  <select
                    id="selectProfileOfficialTrack"
                    value={selectedTrackId}
                    onChange={(e) => setSelectedTrackId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  >
                    <option value="">-- انتخاب گرایش رسمی --</option>
                    {filteredTracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        گرایش {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* STATE B: Undeclared - Multi-track selection */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      به کدام گرایش‌ها علاقه‌مند هستید؟ (بررسی تطبیقی چندگانه)
                    </label>
                    <button
                      type="button"
                      onClick={selectAllTracks}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      انتخاب همه گرایش‌ها
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredTracks.map((track) => {
                      const isChecked = desiredTrackIds.includes(track.id);
                      return (
                        <div
                          key={track.id}
                          onClick={() => toggleDesiredTrack(track.id)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-white dark:bg-slate-800 border-blue-500 text-blue-900 dark:text-blue-200'
                              : 'bg-white/50 dark:bg-slate-850 border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                          />
                          <span className="text-xs font-medium">{track.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                انصراف
              </button>
              <button
                id="btnSaveAcademicProfile"
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 shadow-lg shadow-blue-500/20 active:scale-95 transition-all hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {saving ? 'در حال ذخیره...' : 'ذخیره پرونده تحصیلی'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
