import { describe, expect, it } from 'vitest';
import { validateAcademicProfileReferences, type AcademicProfileCatalog }
  from '../server/domain/student-profile-references';
import type { StudentAcademicProfile } from '../src/types';

const catalog = (): AcademicProfileCatalog => ({
  universities: [{ id: 'u', name: 'Synthetic U', code: 'U', active: true },
    { id: 'u2', name: 'Other U', code: 'U2', active: true }],
  provinces: [{ id: 'p', name: 'Synthetic Province', active: true },
    { id: 'p2', name: 'Other Province', active: true }],
  campuses: [{ id: 'camp', universityId: 'u', provinceId: 'p',
    type: 'PROVINCE_UNIT', name: 'Synthetic Campus', code: 'C', active: true }],
  degreeLevels: [{ id: 'degree', name: 'Bachelor', code: 'B', active: true },
    { id: 'degree2', name: 'Master', code: 'M', active: true }],
  majors: [{ id: 'major', degreeLevelId: 'degree', name: 'Electrical', code: 'EE', active: true }],
  entryYears: [{ id: 'year', year: 1405, active: true }],
  academicTerms: [{ id: 'term', year: 1405, termNumber: 1,
    name: 'Synthetic Term', isCurrent: true, active: true }],
  tracks: [{ id: 'track', majorId: 'major', name: 'Power', code: 'P', active: true }],
});
const profile=(): StudentAcademicProfile=>({
  userId:'synthetic', universityId:'u', provinceId:'p',campusId:'camp',
  degreeLevelId:'degree', majorId:'major',entryYearId:'year',
  currentTermId:'term',isTrackSelected:true, selectedTrackId:'track',
  desiredTrackIds:[],updatedAt:'synthetic',
});

describe('academic catalogue relationships at the student write boundary',()=>{
  it('accepts a completely consistent student scope and temporary blank onboarding choices',()=>{
    expect(validateAcademicProfileReferences(profile(),catalog())).toBeNull();
    const incomplete={...profile(),campusId:'',degreeLevelId:'',
      majorId:'',entryYearId:'',isTrackSelected:false,selectedTrackId:null,desiredTrackIds:[]};
    expect(validateAcademicProfileReferences(incomplete,catalog())).toBeNull();
  });
  it('rejects a campus that belongs to a different university',()=>{
    const chosen=profile(), data=catalog();
    data.campuses[0].universityId='u2';
    expect(validateAcademicProfileReferences(chosen,data)).toContain('دانشگاه');
  });
  it('rejects a major belonging to another degree',()=>{
    const data=catalog();data.majors[0].degreeLevelId='degree2';
    expect(validateAcademicProfileReferences(profile(),data)).toContain('مقطع');
  });
  it('rejects a province and campus mismatch',()=>{
    expect(validateAcademicProfileReferences({...profile(),provinceId:'p2'},catalog()))
      .toContain('استان');
  });
  it('rejects a disabled official track and one from another major',()=>{
    const data=catalog();data.tracks[0].active=false;
    expect(validateAcademicProfileReferences(profile(),data)).toContain('گرایش');
    data.tracks[0].active=true;data.tracks[0].majorId='another-major';
    expect(validateAcademicProfileReferences(profile(),data)).toContain('گرایش');
  });
  it('rejects duplicates and invalid interested tracks, but allows track-free majors',()=>{
    const data=catalog();
    expect(validateAcademicProfileReferences({...profile(),
      isTrackSelected:false,selectedTrackId:null,desiredTrackIds:['track','track']},data))
      .toContain('گرایش');
    data.tracks=[];
    expect(validateAcademicProfileReferences({...profile(),
      isTrackSelected:false,selectedTrackId:null,desiredTrackIds:[]},data)).toBeNull();
  });
  it('rejects missing and inactive term, campus and year',()=>{
    const data=catalog();data.academicTerms[0].active=false;
    expect(validateAcademicProfileReferences(profile(),data)).toContain('نیمسال');
    data.academicTerms[0].active=true;data.campuses[0].active=false;
    expect(validateAcademicProfileReferences(profile(),data)).toContain('پردیس');
    data.campuses[0].active=true;data.entryYears[0].active=false;
    expect(validateAcademicProfileReferences(profile(),data)).toContain('سال ورود');
  });
});
