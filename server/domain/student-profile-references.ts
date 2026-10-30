import type {
  AcademicTerm, Campus, DegreeLevel, EntryYear, Major, Province,
  StudentAcademicProfile, Track, University,
} from '../../src/types';

export interface AcademicProfileCatalog {
  universities: University[];
  provinces: Province[];
  campuses: Campus[];
  degreeLevels: DegreeLevel[];
  majors: Major[];
  entryYears: EntryYear[];
  academicTerms: AcademicTerm[];
  tracks: Track[];
}

/** Checks relationships in the active catalogue; never invents academic policy. */
export function validateAcademicProfileReferences(
  profile: StudentAcademicProfile, catalog: AcademicProfileCatalog,
): string | null {
  const active = <T extends { id: string; active: boolean }>(rows: T[], id: string) =>
    rows.find(row => row.id === id && row.active !== false);

  if (profile.universityId && !active(catalog.universities, profile.universityId))
    return 'دانشگاه انتخاب‌شده در فهرست فعال وجود ندارد.';
  const campus = profile.campusId ? active(catalog.campuses, profile.campusId) : undefined;
  if (profile.campusId && !campus)
    return 'پردیس یا واحد دانشگاهی انتخاب‌شده معتبر یا فعال نیست.';
  if (campus && campus.universityId !== profile.universityId)
    return 'واحد دانشگاهی به دانشگاه پرونده تعلق ندارد.';
  if (profile.provinceId && !active(catalog.provinces, profile.provinceId))
    return 'استان انتخاب‌شده معتبر یا فعال نیست.';
  if (campus?.provinceId && profile.provinceId && campus.provinceId !== profile.provinceId)
    return 'استان و واحد دانشگاهی با هم مطابقت ندارند.';
  if (profile.degreeLevelId && !active(catalog.degreeLevels, profile.degreeLevelId))
    return 'مقطع تحصیلی انتخاب‌شده معتبر یا فعال نیست.';
  const major = profile.majorId ? active(catalog.majors, profile.majorId) : undefined;
  if (profile.majorId && !major)
    return 'رشتهٔ انتخاب‌شده معتبر یا فعال نیست.';
  if (major && major.degreeLevelId !== profile.degreeLevelId)
    return 'رشته به مقطع انتخاب‌شده تعلق ندارد.';
  if (profile.entryYearId && !active(catalog.entryYears, profile.entryYearId))
    return 'سال ورود انتخاب‌شده معتبر یا فعال نیست.';
  if (profile.currentTermId && !active(catalog.academicTerms, profile.currentTermId))
    return 'نیمسال تحصیلی انتخاب‌شده معتبر یا فعال نیست.';

  const validTracks = new Set(catalog.tracks.filter(t =>
    t.majorId === profile.majorId && t.active !== false).map(t => t.id));
  if (profile.isTrackSelected) {
    if (!profile.selectedTrackId || !validTracks.has(profile.selectedTrackId))
      return 'گرایش رسمی باید فعال و متعلق به همین رشته باشد.';
  } else {
    const desired = profile.desiredTrackIds || [];
    if (!Array.isArray(desired) || desired.some(id => !validTracks.has(id)) ||
        new Set(desired).size !== desired.length)
      return 'گرایش‌های دلخواه باید یکتا، فعال و متعلق به همین رشته باشند.';
  }
  return null;
}
