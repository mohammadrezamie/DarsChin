import { describe, expect, it } from 'vitest';
import { assessCurriculumEvidence, permittedCampusTracks, type AcademicDocumentReference } from '../src/domain/academic-governance';

const approved: AcademicDocumentReference = {
  id: 'document-a', title: 'مصوبه صرفاً آزمایشی', authority: 'MINISTRY_PROGRAM', verification: 'VERIFIED',
};
const evidence = {
  curriculumId: 'chart', campusId: 'campus-a', degreeLevelId: 'BE', majorId: 'EE',
  entryYear: 1403, trackId: null, programDocumentId: approved.id, changes: [],
  verification: 'VERIFIED' as const,
};

describe('academic governance is versioned and refuses unknown evidence', () => {
  it('does not require a fake track for majors without one', () => {
    expect(assessCurriculumEvidence(evidence, [approved]).status).toBe('VERIFIED');
    expect(permittedCampusTracks([], { campusId: 'campus-a', degreeLevelId: 'BE', majorId: 'EE', entryYear: 1403 })).toEqual([]);
  });

  it('does not accept missing or unverified ministry / university documents', () => {
    expect(assessCurriculumEvidence(evidence, []).status).toBe('NEEDS_VERIFICATION');
    expect(assessCurriculumEvidence({ ...evidence, verification: 'DRAFT' }, [approved]).status).toBe('NEEDS_VERIFICATION');
    expect(assessCurriculumEvidence({
      ...evidence,
      changes: [{ type: 'ADD_REQUIRED', courseId: 'general-x', reason: 'دستور محلی نامشخص' }],
    }, [approved]).status).toBe('NEEDS_VERIFICATION');
  });

  it('only exposes a track approved at the specified campus and entry year', () => {
    const base = { campusId: 'campus-a', degreeLevelId: 'BE', majorId: 'EE',
      admissionYearFrom: 1403, permitted: true, verification: 'VERIFIED' as const };
    const options = [
      { ...base, trackId: 'controls' },
      { ...base, campusId: 'campus-b', trackId: 'electronics' },
      { ...base, trackId: 'communications', verification: 'DRAFT' as const },
      { ...base, trackId: null },
      { ...base, trackId: 'old-track', admissionYearTo: 1402, admissionYearFrom: 1400 },
    ];
    expect(permittedCampusTracks(options, { campusId: 'campus-a', degreeLevelId: 'BE', majorId: 'EE', entryYear: 1403 }))
      .toEqual(['controls']);
  });
});
